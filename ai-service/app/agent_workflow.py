"""
SocialFlow LangGraph Multi-Step Agent Workflow
Orchestrates autonomous content creation, trend discovery, content moderation,
and human-in-the-loop publishing securely through API Gateway.
"""

from datetime import datetime, timezone
import logging
import os
import time
from typing import Any, Dict, List, Optional, TypedDict
import uuid

import httpx
from langgraph.graph import END, START, StateGraph

from app.config import config
from app.gemini_client import gemini_client
from app.guardrails import (
    AgentDraftOutput,
    DATA_ISOLATION_POLICY,
    detect_prompt_injection,
    redact_pii_text,
    wrap_untrusted_xml,
)
from app.kafka_agent import kafka_producer_manager
from app.telemetry import get_correlation_id, log_structured, telemetry


class AgentPostState(TypedDict):
    topic: str
    user_id: int
    target_audience: Optional[str]
    auth_header: Optional[str]
    trends_context: List[str]
    draft_content: str
    suggested_tags: List[str]
    suggested_poll: Optional[Dict[str, Any]]
    moderation_status: Dict[str, Any]
    user_approved: bool
    published_post_id: Optional[int]
    logs: List[str]
    error: Optional[str]


GATEWAY_BASE = (
    os.getenv("API_GATEWAY_URL")
    or (
        f"http://{os.getenv('API_GATEWAY_HOSTPORT')}"
        if os.getenv("API_GATEWAY_HOSTPORT")
        else ""
    )
    or "http://localhost:8088"
).rstrip("/")


async def research_trends_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 1: Researches recent trending topics on SocialFlow via API Gateway."""
    started = time.perf_counter()
    logs = list(state.get("logs", []))
    logs.append(f"🔍 שלב 1: סורק טרנדים ונושאים מובילים ברשת סביב '{state['topic']}'...")

    trends: List[str] = []
    status = "success"
    error_type: Optional[str] = None
    try:
        headers: Dict[str, str] = {}
        auth_header = state.get("auth_header")
        if auth_header:
            headers["Authorization"] = auth_header
        cid = get_correlation_id()
        if cid:
            headers["X-Correlation-Id"] = cid

        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(
                f"{GATEWAY_BASE}/api/v1/feed/trending?userId={state.get('user_id', 1)}&page=0&size=5",
                headers=headers,
            )
            if res.status_code == 200:
                data = res.json()
                items = data.get("content", []) if isinstance(data, dict) else data
                for item in items[:5]:
                    snippet = str(item.get("content", ""))[:80]
                    if snippet:
                        trends.append(snippet)
            else:
                log_structured(
                    logging.WARNING,
                    "research_trends_non_200",
                    status_code=res.status_code,
                    gateway=GATEWAY_BASE,
                )
    except Exception as exc:
        status = "fallback"
        error_type = type(exc).__name__
        log_structured(
            logging.WARNING,
            "research_trends_fallback",
            error=redact_pii_text(str(exc), record_metric=False),
        )
        trends = ["#בינה_מלאכותית", "#טכנולוגיה", "#סטארטאפ_ישראלי", "#חדשנות"]

    if not trends:
        trends = ["#בינה_מלאכותית", "#טכנולוגיה", "#סטארטאפ_ישראלי", "#חדשנות"]

    telemetry.record_node_span(
        graph_name="socialflow_agent",
        node_name="research_trends",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status=status,
        error_type=error_type,
        user_id=state.get("user_id"),
    )
    logs.append(f"✅ זוהו {len(trends)} נקודות הקשר וטרנדים רלוונטיים.")
    return {
        "trends_context": trends,
        "logs": logs,
    }


async def draft_post_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 2: Drafts an engaging post with tags and interactive poll using Gemini."""
    started = time.perf_counter()
    logs = list(state.get("logs", []))
    logs.append("✍️ שלב 2: מנסח פוסט איכותי, תגיות רלוונטיות וסקר אינטראקטיבי...")

    topic = state.get("topic", "")
    audience = state.get("target_audience") or "קהל כללי ברשת חברתית"
    raw_trends = state.get("trends_context") or []

    detect_prompt_injection(topic)
    for trend in raw_trends:
        detect_prompt_injection(trend)

    trends_xml = "\n".join(
        wrap_untrusted_xml(t, tag="untrusted_trend") for t in raw_trends[:5]
    )
    user_payload = (
        f"נושא מבוקש:\n{wrap_untrusted_xml(topic, tag='untrusted_topic')}\n\n"
        f"קהל יעד:\n{wrap_untrusted_xml(audience, tag='untrusted_audience')}\n\n"
        f"טרנדים מהפיד:\n<untrusted_trends>\n{trends_xml}\n</untrusted_trends>"
    )
    system_instruction = (
        "אתה מנהל תוכן וסוכן AI מומחה לרשת החברתית SocialFlow.\n"
        f"{DATA_ISOLATION_POLICY}\n"
        "עליך לייצר תוכן מרתק בעברית לפוסט ברשת החברתית, הכולל:\n"
        "1. תוכן פוסט סוחף (1-3 פסקאות קצרות, עם אימוג'ים מתאימים).\n"
        "2. 3-5 האשטגים רלוונטיים (ללא סימן #).\n"
        "3. שאלת סקר אינטראקטיבי קצר ומסקרן עם 2 עד 4 אפשרויות בחירה קצרות.\n\n"
        "החזר אך ורק אובייקט JSON חוקי במבנה הבא:\n"
        "{\n"
        '  "draft_content": "טקסט הפוסט בעברית...",\n'
        '  "suggested_tags": ["טכנולוגיה", "בינה_מלאכותית", "SocialFlow"],\n'
        '  "suggested_poll": {\n'
        '    "question": "שאלת הסקר?",\n'
        '    "options": ["אפשרות 1", "אפשרות 2", "אפשרות 3"]\n'
        "  }\n"
        "}"
    )

    node_status = "success"
    if not gemini_client.api_key:
        telemetry.record_llm_call(
            operation="draft_post",
            model="mock-drafter",
            latency_ms=0.1,
            status="success",
            fallback_used=True,
            user_id=state.get("user_id"),
        )
        draft = (
            f"🚀 מחשבות על {redact_pii_text(topic, record_metric=False)}: "
            "הטכנולוגיה מתקדמת בקצב שיא, והשילוב של סוכני AI במוצרים יומיומיים משנה את כללי המשחק! מה דעתכם?"
        )
        tags = ["טכנולוגיה", "SocialFlow", "חדשנות"]
        poll: Optional[Dict[str, Any]] = {
            "question": "האם כבר התחלתם להשתמש בסוכנים בעבודה?",
            "options": ["כן, יומיומי", "רק מתנסה", "עדיין לא"],
        }
    else:
        validated, _, err = await gemini_client.generate_structured_json(
            operation="draft_post",
            system_instruction=system_instruction,
            user_text=user_payload,
            schema=AgentDraftOutput,
            temperature=0.7,
            timeout=12.0,
            user_id=state.get("user_id"),
        )
        if validated is not None:
            draft = validated.draft_content
            tags = validated.suggested_tags
            poll = (
                validated.suggested_poll.model_dump()
                if validated.suggested_poll is not None
                else None
            )
        else:
            node_status = "fallback"
            log_structured(
                logging.WARNING,
                "draft_post_fallback",
                error=redact_pii_text(str(err or "unknown"), record_metric=False),
            )
            draft = f"🚀 דיון בנושא {redact_pii_text(topic, record_metric=False)}: נקודות מעניינות לשיתוף עם הקהילה."
            tags = ["SocialFlow"]
            poll = None

    telemetry.record_node_span(
        graph_name="socialflow_agent",
        node_name="draft_post",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status=node_status,
        user_id=state.get("user_id"),
    )
    logs.append("✅ טיוטת הפוסט, התגיות והסקר נוצרו בהצלחה.")
    return {
        "draft_content": draft,
        "suggested_tags": tags,
        "suggested_poll": poll,
        "logs": logs,
    }


async def moderate_content_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 3: Moderates and validates post content for safety and guidelines."""
    started = time.perf_counter()
    logs = list(state.get("logs", []))
    logs.append("🛡️ שלב 3: מפעיל בדיקת בטיחות ותאימות לכללי הקהילה...")

    analysis = await gemini_client.analyze_post(
        state["draft_content"], user_id=state.get("user_id")
    )
    is_safe = analysis.get("is_safe", True)

    if is_safe:
        logs.append("✅ הפוסט עבר בהצלחה את בדיקות הסינון ובטיחות התוכן.")
    else:
        logs.append(f"⚠️ אזהרת סינון תוכן: {analysis.get('moderation_reason', 'Unsafe')}")

    telemetry.record_node_span(
        graph_name="socialflow_agent",
        node_name="moderate_content",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="success" if is_safe else "blocked",
        user_id=state.get("user_id"),
    )
    return {
        "moderation_status": analysis,
        "logs": logs,
    }


def _emit_ai_enrichment_event(post_id: Optional[int], state: AgentPostState) -> bool:
    """Publishes an AI enrichment event to Kafka via the shared singleton producer."""
    mod = state.get("moderation_status") or {}
    is_safe = bool(mod.get("is_safe", True))
    ai_tags = [
        str(t).strip().lstrip("#")
        for t in (state.get("suggested_tags") or [])
        if str(t).strip()
    ]
    event_payload = {
        "eventId": str(uuid.uuid4()),
        "eventType": "POST_ENRICHED" if is_safe else "CONTENT_FLAGGED",
        "postId": post_id,
        "authorId": state.get("user_id", 1),
        "userId": state.get("user_id", 1),
        "topic": state.get("topic"),
        "aiTags": ai_tags,
        "tags": ai_tags,
        "sentiment": str(mod.get("sentiment") or "POSITIVE").upper(),
        "summary": str(mod.get("summary") or (state.get("draft_content") or "")[:120]),
        "isSafe": is_safe,
        "severity": "NONE" if is_safe else "HIGH",
        "moderationStatus": mod,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return kafka_producer_manager.send_sync(
        config.AI_ENRICHMENT_TOPIC,
        key=str(post_id or state.get("user_id", 1)),
        payload=event_payload,
    )


async def publish_post_node(state: AgentPostState) -> Dict[str, Any]:
    """
    Node 4: Publishes the approved post strictly through API Gateway using the
    caller's verified Authorization header (never bypassing Gateway to post-service).
    """
    started = time.perf_counter()
    logs = list(state.get("logs", []))

    if not state.get("user_approved", False):
        logs.append("⏸️ ממתין לאישור סופי מהמשתמש לפני פרסום בפיד.")
        telemetry.record_node_span(
            graph_name="socialflow_agent",
            node_name="publish_post",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            status="awaiting_approval",
            user_id=state.get("user_id"),
        )
        return {"logs": logs}

    auth_header = (state.get("auth_header") or "").strip()
    if not auth_header:
        err_msg = "Authorization header is required to publish posts via API Gateway"
        logs.append("❌ חסרה כותרת Authorization מאומתת לפרסום דרך API Gateway.")
        log_structured(
            logging.WARNING,
            "publish_post_missing_auth",
            user_id=state.get("user_id"),
        )
        telemetry.record_node_span(
            graph_name="socialflow_agent",
            node_name="publish_post",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            status="error",
            error_type="MISSING_AUTH_HEADER",
            user_id=state.get("user_id"),
        )
        return {
            "published_post_id": None,
            "error": err_msg,
            "logs": logs,
        }

    logs.append("🚀 שלב 4: מפרסם את הפוסט ב-SocialFlow דרך API Gateway...")
    payload: Dict[str, Any] = {
        "content": state.get("draft_content"),
        "mediaUrls": [],
        "tags": state.get("suggested_tags", []),
        "visibility": "PUBLIC",
    }

    poll = state.get("suggested_poll")
    if poll and poll.get("options") and len(poll.get("options")) >= 2:
        payload["poll"] = {
            "question": poll.get("question"),
            "options": poll.get("options"),
            "durationHours": 24,
        }

    post_id: Optional[int] = None
    error_msg: Optional[str] = None
    node_status = "success"
    try:
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": auth_header,
        }
        cid = get_correlation_id()
        if cid:
            headers["X-Correlation-Id"] = cid

        target_url = f"{GATEWAY_BASE}/api/v1/posts"
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(target_url, json=payload, headers=headers)
            if res.status_code in (200, 201):
                post_data = res.json()
                post_id = post_data.get("id") or post_data.get("postId")
                logs.append(f"🎉 הפוסט פורסם בהצלחה בפיד! מזהה פוסט: #{post_id}")
                if _emit_ai_enrichment_event(post_id, state):
                    logs.append(
                        f"📡 אירוע AI שודר לטופיק '{config.AI_ENRICHMENT_TOPIC}' ב-Kafka."
                    )
            else:
                node_status = "error"
                error_msg = f"Gateway publish failed with HTTP {res.status_code}"
                logs.append(f"❌ שגיאה בפרסום: סטטוס HTTP {res.status_code}")
                log_structured(
                    logging.WARNING,
                    "publish_post_http_error",
                    status_code=res.status_code,
                    target_url=target_url,
                )
    except Exception as exc:
        node_status = "error"
        error_msg = redact_pii_text(str(exc), record_metric=False)
        logs.append(f"❌ שגיאת חיבור ל-Gateway: {error_msg}")
        log_structured(
            logging.ERROR,
            "publish_post_connection_error",
            error=error_msg,
        )

    telemetry.record_node_span(
        graph_name="socialflow_agent",
        node_name="publish_post",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status=node_status,
        error_type="PUBLISH_FAILED" if error_msg else None,
        user_id=state.get("user_id"),
    )
    result: Dict[str, Any] = {
        "published_post_id": post_id,
        "logs": logs,
    }
    if error_msg:
        result["error"] = error_msg
    return result


def route_after_moderation(state: AgentPostState) -> str:
    """Routing: if content is unsafe, terminate; otherwise proceed to publish/review."""
    mod = state.get("moderation_status", {})
    if not mod.get("is_safe", True):
        return END
    return "publish_post"


def create_socialflow_agent_graph():
    builder = StateGraph(AgentPostState)

    builder.add_node("research_trends", research_trends_node)
    builder.add_node("draft_post", draft_post_node)
    builder.add_node("moderate_content", moderate_content_node)
    builder.add_node("publish_post", publish_post_node)

    builder.add_edge(START, "research_trends")
    builder.add_edge("research_trends", "draft_post")
    builder.add_edge("draft_post", "moderate_content")
    builder.add_conditional_edges(
        "moderate_content",
        route_after_moderation,
        {
            "publish_post": "publish_post",
            END: END,
        },
    )
    builder.add_edge("publish_post", END)

    return builder.compile()


socialflow_agent = create_socialflow_agent_graph()
