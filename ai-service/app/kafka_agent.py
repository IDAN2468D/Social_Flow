"""
SocialFlow Event-Driven Autonomous Kafka Enrichment & Moderation Agent (A1).
- Shared singleton Kafka producer (reused across agent_workflow.py and enrichment consumer)
- Bounded-concurrency (Semaphore(2)) LangGraph triage pipeline:
    deterministic pre-screen -> Gemini analyze_post -> POST_ENRICHED / CONTENT_FLAGGED
- Dead-Letter Queue routing (ai-enrichment-dlq) on malformed events or processing errors
- Render/test-safe aiokafka lifespan consumer gated by KAFKA_AUTO_STARTUP (default false)
"""

import asyncio
from collections import deque
from datetime import datetime, timezone
import json
import logging
import os
import re
import threading
import time
from typing import Any, Deque, Dict, List, Optional, Set, Tuple, TypedDict
import uuid
import weakref

from kafka import KafkaProducer
from langgraph.graph import END, START, StateGraph

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
except ImportError:  # pragma: no cover - optional in bare environments
    AIOKafkaConsumer = None  # type: ignore[assignment]
    AIOKafkaProducer = None  # type: ignore[assignment]

from app.config import config
from app.gemini_client import gemini_client
from app.guardrails import detect_prompt_injection, redact_pii_text
from app.telemetry import log_structured, telemetry

# Deterministic severe pre-screen patterns (phishing/scam, extreme flood, explicit violent threats)
_SEVERE_PRESCREEN_PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("phishing_scam", re.compile(r"(?i)\b(?:send\s+your\s+seed\s+phrase|free\s+crypto\s+giveaway|click\s+here\s+to\s+claim\s+\$\d+|wire\s+money\s+immediately)\b")),
    ("explicit_threat_en", re.compile(r"(?i)\b(?:kill\s+yourself|i\s+will\s+kill\s+you|bomb\s+threat|doxx\s+your\s+address)\b")),
    ("explicit_threat_he", re.compile(r"(?:מוות\s+ל|איום\s+ברצח|תתאבד|אפרסם\s+את\s+הכתובת\s+שלך)")),
    ("spam_flood", re.compile(r"(.)\1{24,}")),
]

_HIGH_SEVERITY_REASON_TERMS = (
    "hate",
    "violence",
    "harassment",
    "threat",
    "illegal",
    "nsfw",
    "scam",
    "phishing",
    "injection",
    "severe",
    "abuse",
    "malware",
    "self-harm",
    "אלימות",
    "הסתה",
    "איום",
    "הונאה",
)
_MEDIUM_SEVERITY_REASON_TERMS = ("mild", "borderline", "warning", "review", "low", "spam")


def _normalize_tags(raw_tags: Any) -> List[str]:
    if not isinstance(raw_tags, list):
        return []
    seen: Set[str] = set()
    cleaned: List[str] = []
    for tag in raw_tags:
        val = str(tag or "").strip().lstrip("#").strip()
        if val and val.lower() not in seen:
            seen.add(val.lower())
            cleaned.append(val)
    return cleaned[:10]


def _classify_severity(is_safe: bool, reason: str, injection_detected: bool) -> str:
    if is_safe:
        return "NONE"
    if injection_detected:
        return "HIGH"
    lower = (reason or "").lower()
    if any(term in lower for term in _HIGH_SEVERITY_REASON_TERMS):
        return "HIGH"
    if any(term in lower for term in _MEDIUM_SEVERITY_REASON_TERMS):
        return "MEDIUM"
    return "HIGH"


class SharedKafkaProducer:
    """
    Singleton Kafka producer manager reused across agent_workflow.py and the
    autonomous enrichment worker (avoids per-request socket/producer churn).
    """

    def __init__(self) -> None:
        self._sync_lock = threading.Lock()
        self._sync_producer: Optional[KafkaProducer] = None
        self._async_producer: Optional[Any] = None
        self._async_lock: Optional[asyncio.Lock] = None
        self._async_loop: Optional[asyncio.AbstractEventLoop] = None

    def _get_async_lock(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._async_lock is None or self._async_loop is not loop:
            self._async_lock = asyncio.Lock()
            self._async_loop = loop
        return self._async_lock

    def _get_or_create_sync_producer(self) -> KafkaProducer:
        if self._sync_producer is None:
            self._sync_producer = KafkaProducer(
                bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
                key_serializer=lambda k: str(k).encode("utf-8"),
                request_timeout_ms=5000,
            )
        return self._sync_producer

    def send_sync(self, topic: str, key: str, payload: Dict[str, Any]) -> bool:
        """Publishes synchronously using a shared lazy KafkaProducer instance."""
        with self._sync_lock:
            try:
                producer = self._get_or_create_sync_producer()
                future = producer.send(topic, key=str(key), value=payload)
                future.get(timeout=5)
                producer.flush(timeout=5)
                return True
            except Exception as exc:
                log_structured(
                    logging.WARNING,
                    "kafka_sync_send_failed",
                    topic=topic,
                    key=str(key),
                    error=redact_pii_text(str(exc), record_metric=False),
                )
                self._reset_sync_producer_locked()
                return False

    def _reset_sync_producer_locked(self) -> None:
        if self._sync_producer is not None:
            try:
                self._sync_producer.close(timeout=2)
            except Exception as close_exc:
                log_structured(
                    logging.WARNING,
                    "kafka_sync_producer_close_failed",
                    error=str(close_exc),
                )
            self._sync_producer = None

    async def start_async(self) -> None:
        """Starts the shared AIOKafkaProducer if aiokafka is installed."""
        if AIOKafkaProducer is None:
            return
        async with self._get_async_lock():
            if self._async_producer is not None:
                return
            producer = AIOKafkaProducer(
                bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
                key_serializer=lambda k: str(k).encode("utf-8"),
                request_timeout_ms=5000,
            )
            await producer.start()
            self._async_producer = producer
            log_structured(
                logging.INFO,
                "aiokafka_producer_started",
                bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS,
            )

    async def send(self, topic: str, key: str, payload: Dict[str, Any]) -> bool:
        """Publishes asynchronously using shared AIOKafkaProducer or sync singleton fallback."""
        if self._async_producer is not None:
            try:
                await self._async_producer.send_and_wait(
                    topic,
                    value=payload,
                    key=str(key),
                )
                return True
            except Exception as exc:
                log_structured(
                    logging.WARNING,
                    "aiokafka_send_failed",
                    topic=topic,
                    key=str(key),
                    error=redact_pii_text(str(exc), record_metric=False),
                )
                return False
        return await asyncio.to_thread(self.send_sync, topic, key, payload)

    async def close(self) -> None:
        """Cleanly closes both async and sync singleton producers on shutdown."""
        if self._async_producer is not None:
            try:
                await self._async_producer.stop()
            except Exception as exc:
                log_structured(
                    logging.WARNING,
                    "aiokafka_producer_stop_failed",
                    error=str(exc),
                )
            self._async_producer = None

        with self._sync_lock:
            self._reset_sync_producer_locked()


kafka_producer_manager = SharedKafkaProducer()


# =========================================================================
# Autonomous Triage & Enrichment LangGraph
# =========================================================================


class EnrichmentTriageState(TypedDict):
    source_event_id: Optional[str]
    post_id: int
    author_id: Optional[int]
    author_username: Optional[str]
    content: str
    existing_tags: List[str]
    emit_kafka: bool
    prescreen_blocked: bool
    prescreen_severity: str
    prescreen_reason: str
    prompt_injection_detected: bool
    analysis: Dict[str, Any]
    decision_event_type: str
    severity: str
    is_safe: bool
    enrichment_payload: Dict[str, Any]
    published: bool
    published_topic: Optional[str]
    error: Optional[str]


async def pre_screen_node(state: EnrichmentTriageState) -> Dict[str, Any]:
    """Node 1: Deterministic fast safety & prompt-injection pre-screen (zero LLM tokens)."""
    started = time.perf_counter()
    content = (state.get("content") or "").strip()
    if not content:
        raise ValueError("POST_CREATED event content cannot be empty")

    injection = detect_prompt_injection(content)
    prescreen_blocked = False
    prescreen_severity = "NONE"
    prescreen_reason = "Passed deterministic pre-screen"

    if injection.risk_level == "high":
        prescreen_blocked = True
        prescreen_severity = "HIGH"
        prescreen_reason = (
            f"High-risk prompt injection detected ({', '.join(injection.matched_patterns)})"
        )
    else:
        for rule_name, pattern in _SEVERE_PRESCREEN_PATTERNS:
            if pattern.search(content):
                prescreen_blocked = True
                prescreen_severity = "HIGH"
                prescreen_reason = f"Deterministic safety rule triggered: {rule_name}"
                break

    telemetry.record_node_span(
        graph_name="enrichment_triage",
        node_name="pre_screen",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="flagged" if prescreen_blocked else "success",
        user_id=state.get("author_id"),
    )
    return {
        "prescreen_blocked": prescreen_blocked,
        "prescreen_severity": prescreen_severity,
        "prescreen_reason": prescreen_reason,
        "prompt_injection_detected": injection.detected,
    }


def route_after_prescreen(state: EnrichmentTriageState) -> str:
    """Short-circuits LLM analysis when deterministic pre-screen already flags severe violations."""
    if state.get("prescreen_blocked", False):
        return "publish_enrichment"
    return "analyze_content"


async def analyze_content_node(state: EnrichmentTriageState) -> Dict[str, Any]:
    """Node 2: Runs Gemini content analysis (sentiment, category, tags, safety, summary)."""
    started = time.perf_counter()
    analysis = await gemini_client.analyze_post(
        state["content"], user_id=state.get("author_id")
    )

    if "error" in analysis and "is_safe" not in analysis:
        telemetry.record_node_span(
            graph_name="enrichment_triage",
            node_name="analyze_content",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            status="error",
            error_type="ANALYZE_ERROR",
            user_id=state.get("author_id"),
        )
        raise RuntimeError(f"Gemini analyze_post failed: {analysis['error']}")

    is_safe = bool(analysis.get("is_safe", True))
    reason = str(analysis.get("moderation_reason") or ("Safe" if is_safe else "Unsafe content"))
    injection_detected = bool(
        state.get("prompt_injection_detected", False)
        or analysis.get("prompt_injection_detected", False)
    )
    severity = _classify_severity(is_safe, reason, injection_detected)
    decision_event_type = "POST_ENRICHED" if is_safe else "CONTENT_FLAGGED"

    telemetry.record_node_span(
        graph_name="enrichment_triage",
        node_name="analyze_content",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="success" if is_safe else "flagged",
        user_id=state.get("author_id"),
    )
    return {
        "analysis": analysis,
        "is_safe": is_safe,
        "severity": severity,
        "decision_event_type": decision_event_type,
        "prompt_injection_detected": injection_detected,
    }


async def publish_enrichment_node(state: EnrichmentTriageState) -> Dict[str, Any]:
    """Node 3: Builds canonical POST_ENRICHED or CONTENT_FLAGGED event and emits to Kafka."""
    started = time.perf_counter()
    prescreen_blocked = bool(state.get("prescreen_blocked", False))
    analysis = state.get("analysis") or {}

    if prescreen_blocked:
        is_safe = False
        severity = state.get("prescreen_severity") or "HIGH"
        decision_event_type = "CONTENT_FLAGGED"
        sentiment = "NEGATIVE"
        category = "Moderation"
        summary = redact_pii_text(state["content"][:120], record_metric=False)
        moderation_reason = state.get("prescreen_reason") or "Blocked by deterministic pre-screen"
        ai_tags: List[str] = []
        model_used = "deterministic-prescreen"
    else:
        is_safe = bool(state.get("is_safe", analysis.get("is_safe", True)))
        severity = state.get("severity") or _classify_severity(
            is_safe,
            str(analysis.get("moderation_reason") or ""),
            bool(state.get("prompt_injection_detected", False)),
        )
        decision_event_type = state.get("decision_event_type") or (
            "POST_ENRICHED" if is_safe else "CONTENT_FLAGGED"
        )
        sentiment = str(analysis.get("sentiment") or "NEUTRAL").upper()
        category = str(analysis.get("category") or "General")
        summary = str(
            analysis.get("summary")
            or redact_pii_text(state["content"][:120], record_metric=False)
        )
        moderation_reason = str(
            analysis.get("moderation_reason") or ("Safe" if is_safe else "Unsafe content")
        )
        ai_tags = _normalize_tags(analysis.get("suggested_tags"))
        model_used = str(analysis.get("model_used") or gemini_client.model)

    enrichment_payload: Dict[str, Any] = {
        "eventId": str(uuid.uuid4()),
        "eventType": decision_event_type,
        "postId": state["post_id"],
        "authorId": state.get("author_id"),
        "authorUsername": state.get("author_username"),
        "aiTags": ai_tags,
        "tags": ai_tags,
        "category": category,
        "sentiment": sentiment,
        "summary": summary,
        "isSafe": is_safe,
        "severity": severity,
        "moderationReason": moderation_reason,
        "promptInjectionDetected": bool(state.get("prompt_injection_detected", False)),
        "modelUsed": model_used,
        "sourceEventId": state.get("source_event_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    published = False
    published_topic: Optional[str] = None
    if state.get("emit_kafka", True):
        published = await kafka_producer_manager.send(
            config.AI_ENRICHMENT_TOPIC,
            key=str(state["post_id"]),
            payload=enrichment_payload,
        )
        if not published:
            telemetry.record_node_span(
                graph_name="enrichment_triage",
                node_name="publish_enrichment",
                latency_ms=(time.perf_counter() - started) * 1000.0,
                status="error",
                error_type="KAFKA_PUBLISH_FAILED",
                user_id=state.get("author_id"),
            )
            raise RuntimeError(
                f"Failed to publish {decision_event_type} for post #{state['post_id']} to {config.AI_ENRICHMENT_TOPIC}"
            )
        published_topic = config.AI_ENRICHMENT_TOPIC

    telemetry.record_node_span(
        graph_name="enrichment_triage",
        node_name="publish_enrichment",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="success",
        user_id=state.get("author_id"),
    )
    return {
        "is_safe": is_safe,
        "severity": severity,
        "decision_event_type": decision_event_type,
        "enrichment_payload": enrichment_payload,
        "published": published,
        "published_topic": published_topic,
    }


def create_enrichment_triage_graph():
    builder = StateGraph(EnrichmentTriageState)
    builder.add_node("pre_screen", pre_screen_node)
    builder.add_node("analyze_content", analyze_content_node)
    builder.add_node("publish_enrichment", publish_enrichment_node)

    builder.add_edge(START, "pre_screen")
    builder.add_conditional_edges(
        "pre_screen",
        route_after_prescreen,
        {
            "analyze_content": "analyze_content",
            "publish_enrichment": "publish_enrichment",
        },
    )
    builder.add_edge("analyze_content", "publish_enrichment")
    builder.add_edge("publish_enrichment", END)
    return builder.compile()


enrichment_triage_graph = create_enrichment_triage_graph()


# =========================================================================
# Event Orchestrator, Bounded Concurrency, Deduplication & DLQ Routing
# =========================================================================


class KafkaEnrichmentWorker:
    """
    Manages bounded-concurrency processing of POST_CREATED events from Kafka,
    in-memory deduplication, DLQ routing, and Render-safe lifespan consumer lifecycle.
    """

    def __init__(self, max_dedup_ids: int = 1000) -> None:
        self._max_dedup_ids = max_dedup_ids
        self._seen_order: Deque[str] = deque()
        self._seen_set: Set[str] = set()
        self._dedup_lock = threading.Lock()
        self._semaphores: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = (
            weakref.WeakKeyDictionary()
        )
        self._consumer: Optional[Any] = None
        self._task: Optional[asyncio.Task[Any]] = None
        self._stop_event: Optional[asyncio.Event] = None
        self._running: bool = False
        self._stats_lock = threading.Lock()
        self._stats: Dict[str, int] = {
            "processed": 0,
            "enriched": 0,
            "flagged": 0,
            "skipped": 0,
            "duplicates": 0,
            "dlq_routed": 0,
        }

    def reset_state(self) -> None:
        with self._dedup_lock:
            self._seen_order.clear()
            self._seen_set.clear()
        with self._stats_lock:
            for k in self._stats:
                self._stats[k] = 0

    def _get_semaphore(self) -> asyncio.Semaphore:
        loop = asyncio.get_running_loop()
        sem = self._semaphores.get(loop)
        if sem is None:
            sem = asyncio.Semaphore(max(1, config.AI_KAFKA_MAX_CONCURRENCY))
            self._semaphores[loop] = sem
        return sem

    def _mark_seen_if_new(self, dedup_key: str) -> bool:
        with self._dedup_lock:
            if dedup_key in self._seen_set:
                return False
            self._seen_set.add(dedup_key)
            self._seen_order.append(dedup_key)
            while len(self._seen_order) > self._max_dedup_ids:
                evicted = self._seen_order.popleft()
                self._seen_set.discard(evicted)
            return True

    def _inc_stat(self, key: str) -> None:
        with self._stats_lock:
            self._stats[key] = self._stats.get(key, 0) + 1

    def get_status(self) -> Dict[str, Any]:
        with self._stats_lock:
            stats_copy = dict(self._stats)
        return {
            "kafka_auto_startup": is_kafka_auto_startup_enabled(),
            "consumer_running": self._running,
            "source_topic": config.POST_EVENTS_TOPIC,
            "enrichment_topic": config.AI_ENRICHMENT_TOPIC,
            "dlq_topic": config.AI_ENRICHMENT_DLQ_TOPIC,
            "consumer_group": config.KAFKA_CONSUMER_GROUP,
            "max_concurrency": config.AI_KAFKA_MAX_CONCURRENCY,
            "stats": stats_copy,
        }

    async def _send_to_dlq(
        self,
        *,
        raw_event: Any,
        error: Exception,
        post_id: Optional[int] = None,
        author_id: Optional[int] = None,
    ) -> bool:
        safe_err = redact_pii_text(str(error), record_metric=False)
        dlq_payload: Dict[str, Any] = {
            "eventId": str(uuid.uuid4()),
            "eventType": "AI_ENRICHMENT_FAILED",
            "sourceTopic": config.POST_EVENTS_TOPIC,
            "postId": post_id,
            "authorId": author_id,
            "errorType": type(error).__name__,
            "errorMessage": safe_err[:500],
            "rawEvent": raw_event if isinstance(raw_event, dict) else {"raw": str(raw_event)[:500]},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        key = str(post_id) if post_id is not None else dlq_payload["eventId"]
        sent = await kafka_producer_manager.send(
            config.AI_ENRICHMENT_DLQ_TOPIC,
            key=key,
            payload=dlq_payload,
        )
        self._inc_stat("dlq_routed")
        telemetry.record_guardrail_event("kafka_dlq")
        log_structured(
            logging.ERROR,
            "enrichment_routed_to_dlq",
            post_id=post_id,
            dlq_topic=config.AI_ENRICHMENT_DLQ_TOPIC,
            dlq_sent=sent,
            error_type=type(error).__name__,
            error=safe_err[:300],
        )
        return sent

    async def process_event(
        self,
        raw_event: Any,
        *,
        emit_kafka: bool = True,
        bypass_dedup: bool = False,
    ) -> Dict[str, Any]:
        """Processes a single post-events payload under bounded concurrency with DLQ safety."""
        if not isinstance(raw_event, dict):
            err = ValueError("Event payload must be a JSON object")
            dlq_sent = await self._send_to_dlq(raw_event=raw_event, error=err)
            return {
                "status": "dlq",
                "dlq_routed": True,
                "dlq_sent": dlq_sent,
                "error": str(err),
            }

        event_type = str(raw_event.get("eventType") or "").strip().upper()
        is_post_created = event_type == "POST_CREATED" or (
            not event_type
            and raw_event.get("postId") is not None
            and raw_event.get("content") is not None
            and raw_event.get("commentId") is None
        )
        if not is_post_created:
            self._inc_stat("skipped")
            return {
                "status": "skipped",
                "reason": f"Unsupported eventType '{event_type or 'UNKNOWN'}'",
            }

        raw_post_id = raw_event.get("postId")
        if raw_post_id is None:
            raw_post_id = raw_event.get("post_id")
        try:
            post_id = int(raw_post_id)  # type: ignore[arg-type]
        except (TypeError, ValueError) as exc:
            dlq_sent = await self._send_to_dlq(raw_event=raw_event, error=exc)
            return {
                "status": "dlq",
                "dlq_routed": True,
                "dlq_sent": dlq_sent,
                "error": "Invalid or missing postId",
            }

        raw_author_id = raw_event.get("authorId")
        if raw_author_id is None:
            raw_author_id = raw_event.get("author_id")
        author_id: Optional[int] = None
        if raw_author_id is not None:
            try:
                author_id = int(raw_author_id)
            except (TypeError, ValueError):
                author_id = None

        source_event_id = raw_event.get("eventId") or raw_event.get("event_id")
        dedup_key = str(source_event_id) if source_event_id else f"POST_CREATED:{post_id}"
        if not bypass_dedup and not self._mark_seen_if_new(dedup_key):
            self._inc_stat("duplicates")
            return {
                "status": "duplicate",
                "post_id": post_id,
                "dedup_key": dedup_key,
            }

        sem = self._get_semaphore()
        async with sem:
            try:
                initial_state: EnrichmentTriageState = {
                    "source_event_id": str(source_event_id) if source_event_id else None,
                    "post_id": post_id,
                    "author_id": author_id,
                    "author_username": raw_event.get("authorUsername")
                    or raw_event.get("author_username"),
                    "content": str(raw_event.get("content") or ""),
                    "existing_tags": _normalize_tags(raw_event.get("tags")),
                    "emit_kafka": emit_kafka,
                    "prescreen_blocked": False,
                    "prescreen_severity": "NONE",
                    "prescreen_reason": "",
                    "prompt_injection_detected": False,
                    "analysis": {},
                    "decision_event_type": "POST_ENRICHED",
                    "severity": "NONE",
                    "is_safe": True,
                    "enrichment_payload": {},
                    "published": False,
                    "published_topic": None,
                    "error": None,
                }
                result = await enrichment_triage_graph.ainvoke(initial_state)
                self._inc_stat("processed")
                if result.get("decision_event_type") == "CONTENT_FLAGGED":
                    self._inc_stat("flagged")
                else:
                    self._inc_stat("enriched")

                return {
                    "status": "processed",
                    "decision_event_type": result.get("decision_event_type"),
                    "post_id": post_id,
                    "is_safe": result.get("is_safe"),
                    "severity": result.get("severity"),
                    "published": result.get("published", False),
                    "published_topic": result.get("published_topic"),
                    "dlq_routed": False,
                    "event": result.get("enrichment_payload", {}),
                }
            except Exception as exc:
                dlq_sent = await self._send_to_dlq(
                    raw_event=raw_event,
                    error=exc,
                    post_id=post_id,
                    author_id=author_id,
                )
                return {
                    "status": "dlq",
                    "post_id": post_id,
                    "dlq_routed": True,
                    "dlq_sent": dlq_sent,
                    "error": redact_pii_text(str(exc), record_metric=False),
                }

    async def _consume_loop(self) -> None:
        if AIOKafkaConsumer is None:
            log_structured(
                logging.WARNING,
                "aiokafka_not_installed",
                message="Install aiokafka to enable background Kafka consumption",
            )
            return

        backoff = 2.0
        while self._stop_event is not None and not self._stop_event.is_set():
            consumer = AIOKafkaConsumer(
                config.POST_EVENTS_TOPIC,
                bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS,
                group_id=config.KAFKA_CONSUMER_GROUP,
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            self._consumer = consumer
            try:
                await kafka_producer_manager.start_async()
                await consumer.start()
                self._running = True
                backoff = 2.0
                log_structured(
                    logging.INFO,
                    "kafka_enrichment_consumer_started",
                    topic=config.POST_EVENTS_TOPIC,
                    group_id=config.KAFKA_CONSUMER_GROUP,
                    bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS,
                )

                in_flight: Set[asyncio.Task[Any]] = set()
                max_in_flight = max(1, config.AI_KAFKA_MAX_CONCURRENCY)
                async for msg in consumer:
                    if self._stop_event.is_set():
                        break
                    # Apply backpressure so bursts never pile up unbounded tasks in 256MB RAM
                    while len(in_flight) >= max_in_flight:
                        done, _ = await asyncio.wait(
                            in_flight, return_when=asyncio.FIRST_COMPLETED
                        )
                        in_flight.difference_update(done)

                    try:
                        decoded = (
                            msg.value.decode("utf-8")
                            if isinstance(msg.value, (bytes, bytearray))
                            else str(msg.value)
                        )
                        payload = json.loads(decoded)
                    except Exception as decode_err:
                        await self._send_to_dlq(
                            raw_event=str(msg.value)[:500], error=decode_err
                        )
                        continue

                    task = asyncio.create_task(
                        self.process_event(payload, emit_kafka=True)
                    )
                    in_flight.add(task)
                    task.add_done_callback(in_flight.discard)

                if in_flight:
                    await asyncio.gather(*in_flight, return_exceptions=True)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self._running = False
                log_structured(
                    logging.WARNING,
                    "kafka_enrichment_consumer_reconnecting",
                    error=redact_pii_text(str(exc), record_metric=False),
                    retry_in_seconds=backoff,
                )
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=backoff)
                except asyncio.TimeoutError:
                    backoff = min(backoff * 2.0, 30.0)
            finally:
                self._running = False
                try:
                    await consumer.stop()
                except Exception as stop_err:
                    log_structured(
                        logging.WARNING,
                        "kafka_consumer_stop_warning",
                        error=str(stop_err),
                    )
                self._consumer = None

    async def start(self) -> bool:
        """Starts the aiokafka background consumer task if KAFKA_AUTO_STARTUP is enabled."""
        if not is_kafka_auto_startup_enabled():
            log_structured(
                logging.INFO,
                "kafka_enrichment_consumer_skipped",
                reason="KAFKA_AUTO_STARTUP is false",
            )
            return False
        if self._task is not None and not self._task.done():
            return True
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._consume_loop(), name="ai-kafka-enrichment-consumer")
        return True

    async def stop(self) -> None:
        if self._stop_event is not None:
            self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._running = False
        await kafka_producer_manager.close()


def is_kafka_auto_startup_enabled() -> bool:
    env_val = os.getenv("KAFKA_AUTO_STARTUP")
    if env_val is not None:
        return env_val.strip().lower() in ("1", "true", "yes", "on")
    return bool(config.KAFKA_AUTO_STARTUP)


kafka_enrichment_worker = KafkaEnrichmentWorker()
