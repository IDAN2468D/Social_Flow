"""
SocialFlow AI Service LLMOps Telemetry & Structured Logging.
Tracks Gemini token usageMetadata, latency, estimated USD cost, LangGraph node spans,
guardrail triggers, and bounded recent traces within low-RAM container limits.
"""

from collections import deque
from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import math
import threading
import time
from typing import Any, Deque, Dict, List, Optional, Tuple
import uuid

from app.config import config

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")

# Approximate per-1M-token pricing (input_usd, output_usd) for Gemini Flash tiers
MODEL_PRICING_PER_1M_TOKENS: Dict[str, Tuple[float, float]] = {
    "gemini-3.5-flash-lite": (0.075, 0.30),
    "gemini-2.5-flash-lite": (0.075, 0.30),
    "gemini-2.5-flash": (0.15, 0.60),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-flash": (0.075, 0.30),
}
DEFAULT_PRICING_PER_1M_TOKENS: Tuple[float, float] = (0.10, 0.40)

MAX_LATENCY_SAMPLES_PER_OP = 500


def get_correlation_id() -> str:
    return correlation_id_ctx.get() or ""


def set_correlation_id(value: Optional[str]) -> str:
    cid = (value or "").strip() or str(uuid.uuid4())
    correlation_id_ctx.set(cid)
    return cid


class _StructuredJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        cid = get_correlation_id()
        if cid:
            payload["correlation_id"] = cid
        extra_fields = getattr(record, "structured_fields", None)
        if isinstance(extra_fields, dict):
            for k, v in extra_fields.items():
                if v is not None:
                    payload[k] = v
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def _init_logger() -> logging.Logger:
    logger = logging.getLogger("socialflow.ai")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(_StructuredJsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False
    logger.setLevel(logging.INFO)
    return logger


ai_logger = _init_logger()


def log_structured(level: int, event: str, **fields: Any) -> None:
    ai_logger.log(level, event, extra={"structured_fields": {"event": event, **fields}})


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    normalized = (model or "").strip().lower()
    in_price, out_price = MODEL_PRICING_PER_1M_TOKENS.get(normalized, DEFAULT_PRICING_PER_1M_TOKENS)
    if normalized not in MODEL_PRICING_PER_1M_TOKENS:
        for key, prices in MODEL_PRICING_PER_1M_TOKENS.items():
            if key in normalized:
                in_price, out_price = prices
                break
    cost = (max(0, input_tokens) * in_price + max(0, output_tokens) * out_price) / 1_000_000.0
    return round(cost, 8)


def _percentile(samples: List[float], pct: float) -> float:
    if not samples:
        return 0.0
    ordered = sorted(samples)
    idx = max(0, min(len(ordered) - 1, math.ceil((pct / 100.0) * len(ordered)) - 1))
    return round(ordered[idx], 2)


class TelemetryTracker:
    """Thread-safe, bounded in-memory LLMOps telemetry store."""

    def __init__(self, max_traces: int = 200):
        self._lock = threading.Lock()
        self._max_traces = max(10, max_traces)
        self._started_at = time.time()
        self._reset_locked()

    def _reset_locked(self) -> None:
        self._started_at = time.time()
        self._totals: Dict[str, Any] = {
            "requests": 0,
            "errors": 0,
            "fallbacks": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0.0,
        }
        self._all_latencies: Deque[float] = deque(maxlen=MAX_LATENCY_SAMPLES_PER_OP)
        self._guardrails: Dict[str, int] = {
            "prompt_injection": 0,
            "pii_redaction": 0,
            "rate_limit": 0,
            "rbac_denied": 0,
            "json_repair": 0,
        }
        self._by_operation: Dict[str, Dict[str, Any]] = {}
        self._langgraph_nodes: Dict[str, Dict[str, Any]] = {}
        self._traces: Deque[Dict[str, Any]] = deque(maxlen=self._max_traces)

    def reset(self) -> None:
        with self._lock:
            self._reset_locked()

    def record_guardrail_event(self, event_type: str, count: int = 1) -> None:
        if count <= 0:
            return
        with self._lock:
            self._guardrails[event_type] = self._guardrails.get(event_type, 0) + count

    def record_llm_call(
        self,
        *,
        operation: str,
        model: str,
        latency_ms: float,
        input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: int = 0,
        status: str = "success",
        fallback_used: bool = False,
        json_repaired: bool = False,
        error_type: Optional[str] = None,
        error_message: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        safe_in = max(0, int(input_tokens or 0))
        safe_out = max(0, int(output_tokens or 0))
        safe_total = max(safe_in + safe_out, int(total_tokens or 0))
        safe_latency = round(max(0.0, float(latency_ms or 0.0)), 2)
        cost_usd = estimate_cost_usd(model, safe_in, safe_out)

        trace_entry: Dict[str, Any] = {
            "trace_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "correlation_id": get_correlation_id() or None,
            "kind": "llm_call",
            "operation": operation,
            "model": model,
            "user_id": user_id,
            "status": status,
            "latency_ms": safe_latency,
            "input_tokens": safe_in,
            "output_tokens": safe_out,
            "total_tokens": safe_total,
            "estimated_cost_usd": cost_usd,
            "fallback_used": fallback_used,
            "json_repaired": json_repaired,
        }
        if error_type:
            trace_entry["error_type"] = error_type
        if error_message:
            trace_entry["error_message"] = error_message[:300]

        with self._lock:
            self._totals["requests"] += 1
            if status != "success":
                self._totals["errors"] += 1
            if fallback_used:
                self._totals["fallbacks"] += 1
            self._totals["input_tokens"] += safe_in
            self._totals["output_tokens"] += safe_out
            self._totals["total_tokens"] += safe_total
            self._totals["estimated_cost_usd"] = round(
                self._totals["estimated_cost_usd"] + cost_usd, 8
            )
            self._all_latencies.append(safe_latency)

            op = self._by_operation.setdefault(
                operation,
                {
                    "calls": 0,
                    "errors": 0,
                    "fallbacks": 0,
                    "json_repairs": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "estimated_cost_usd": 0.0,
                    "_latencies": deque(maxlen=MAX_LATENCY_SAMPLES_PER_OP),
                },
            )
            op["calls"] += 1
            if status != "success":
                op["errors"] += 1
            if fallback_used:
                op["fallbacks"] += 1
            if json_repaired:
                op["json_repairs"] += 1
            op["input_tokens"] += safe_in
            op["output_tokens"] += safe_out
            op["total_tokens"] += safe_total
            op["estimated_cost_usd"] = round(op["estimated_cost_usd"] + cost_usd, 8)
            op["_latencies"].append(safe_latency)

            self._traces.append(trace_entry)

        log_level = logging.INFO if status == "success" else logging.WARNING
        log_structured(
            log_level,
            "gemini_call",
            operation=operation,
            model=model,
            status=status,
            latency_ms=safe_latency,
            input_tokens=safe_in,
            output_tokens=safe_out,
            total_tokens=safe_total,
            estimated_cost_usd=cost_usd,
            fallback_used=fallback_used,
            json_repaired=json_repaired,
            error_type=error_type,
        )
        return trace_entry

    def record_node_span(
        self,
        *,
        graph_name: str,
        node_name: str,
        latency_ms: float,
        status: str = "success",
        error_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        safe_latency = round(max(0.0, float(latency_ms or 0.0)), 2)
        key = f"{graph_name}.{node_name}"
        span: Dict[str, Any] = {
            "trace_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "correlation_id": get_correlation_id() or None,
            "kind": "langgraph_node",
            "graph_name": graph_name,
            "node_name": node_name,
            "user_id": user_id,
            "status": status,
            "latency_ms": safe_latency,
        }
        if error_type:
            span["error_type"] = error_type

        with self._lock:
            node = self._langgraph_nodes.setdefault(
                key,
                {
                    "executions": 0,
                    "errors": 0,
                    "_latencies": deque(maxlen=MAX_LATENCY_SAMPLES_PER_OP),
                },
            )
            node["executions"] += 1
            if status != "success":
                node["errors"] += 1
            node["_latencies"].append(safe_latency)
            self._traces.append(span)

        log_structured(
            logging.INFO if status == "success" else logging.WARNING,
            "langgraph_node_span",
            graph_name=graph_name,
            node_name=node_name,
            status=status,
            latency_ms=safe_latency,
            error_type=error_type,
        )
        return span

    def get_metrics(self, active_model: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            all_lat = list(self._all_latencies)
            avg_lat = round(sum(all_lat) / len(all_lat), 2) if all_lat else 0.0
            p95_lat = _percentile(all_lat, 95.0)

            by_operation: Dict[str, Any] = {}
            for op_name, op in self._by_operation.items():
                lats = list(op["_latencies"])
                by_operation[op_name] = {
                    "calls": op["calls"],
                    "errors": op["errors"],
                    "fallbacks": op["fallbacks"],
                    "json_repairs": op["json_repairs"],
                    "input_tokens": op["input_tokens"],
                    "output_tokens": op["output_tokens"],
                    "total_tokens": op["total_tokens"],
                    "estimated_cost_usd": op["estimated_cost_usd"],
                    "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else 0.0,
                    "p95_latency_ms": _percentile(lats, 95.0),
                }

            langgraph_nodes: Dict[str, Any] = {}
            for node_key, node in self._langgraph_nodes.items():
                lats = list(node["_latencies"])
                langgraph_nodes[node_key] = {
                    "executions": node["executions"],
                    "errors": node["errors"],
                    "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else 0.0,
                    "p95_latency_ms": _percentile(lats, 95.0),
                }

            return {
                "service": "ai-service",
                "model": active_model or config.GEMINI_MODEL,
                "uptime_seconds": round(time.time() - self._started_at, 2),
                "totals": {
                    **self._totals,
                    "avg_latency_ms": avg_lat,
                    "p95_latency_ms": p95_lat,
                },
                "guardrails": dict(self._guardrails),
                "by_operation": by_operation,
                "langgraph_nodes": langgraph_nodes,
                "traces_buffered": len(self._traces),
            }

    def render_prometheus(self, active_model: Optional[str] = None) -> str:
        metrics = self.get_metrics(active_model=active_model)
        totals = metrics["totals"]
        guardrails = metrics["guardrails"]
        lines = [
            "# HELP socialflow_ai_requests_total Total LLM calls processed by ai-service",
            "# TYPE socialflow_ai_requests_total counter",
            f'socialflow_ai_requests_total {totals["requests"]}',
            "# HELP socialflow_ai_errors_total Total failed LLM calls",
            "# TYPE socialflow_ai_errors_total counter",
            f'socialflow_ai_errors_total {totals["errors"]}',
            "# HELP socialflow_ai_fallbacks_total Total deterministic/mock fallbacks triggered",
            "# TYPE socialflow_ai_fallbacks_total counter",
            f'socialflow_ai_fallbacks_total {totals["fallbacks"]}',
            "# HELP socialflow_ai_tokens_total Cumulative Gemini token usage",
            "# TYPE socialflow_ai_tokens_total counter",
            f'socialflow_ai_tokens_total{{type="input"}} {totals["input_tokens"]}',
            f'socialflow_ai_tokens_total{{type="output"}} {totals["output_tokens"]}',
            "# HELP socialflow_ai_estimated_cost_usd Cumulative estimated LLM spend in USD",
            "# TYPE socialflow_ai_estimated_cost_usd counter",
            f'socialflow_ai_estimated_cost_usd {totals["estimated_cost_usd"]}',
            "# HELP socialflow_ai_latency_ms LLM latency summary in milliseconds",
            "# TYPE socialflow_ai_latency_ms gauge",
            f'socialflow_ai_latency_ms{{stat="avg"}} {totals["avg_latency_ms"]}',
            f'socialflow_ai_latency_ms{{stat="p95"}} {totals["p95_latency_ms"]}',
            "# HELP socialflow_ai_guardrail_events_total Guardrail triggers by event type",
            "# TYPE socialflow_ai_guardrail_events_total counter",
        ]
        for g_name, g_count in guardrails.items():
            lines.append(f'socialflow_ai_guardrail_events_total{{event="{g_name}"}} {g_count}')
        for op_name, op in metrics["by_operation"].items():
            lines.append(
                f'socialflow_ai_operation_calls_total{{operation="{op_name}"}} {op["calls"]}'
            )
            lines.append(
                f'socialflow_ai_operation_tokens_total{{operation="{op_name}"}} {op["total_tokens"]}'
            )
        return "\n".join(lines) + "\n"

    def get_recent_traces(self, limit: int = 50) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(self._max_traces, int(limit or 50)))
        with self._lock:
            items = list(self._traces)
        return list(reversed(items[-safe_limit:]))


telemetry = TelemetryTracker(max_traces=config.AI_MAX_TRACES)
