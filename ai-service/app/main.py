import base64
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response, StreamingResponse
import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.agent_workflow import socialflow_agent
from app.config import config
from app.gemini_client import gemini_client
from app.guardrails import (
    is_admin_role,
    rate_limiter,
    redact_pii_text,
    resolve_authenticated_user_id,
)
from app.kafka_agent import kafka_enrichment_worker
from app.rag_graph import crag_ask_feed_graph
from app.telemetry import (
    get_correlation_id,
    log_structured,
    set_correlation_id,
    telemetry,
)
from app.voice_service import (
    AVAILABLE_VOICES,
    classify_voice_intent,
    generate_daily_briefing,
    resolve_voice,
    synthesize_speech,
    transcribe_audio,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await kafka_enrichment_worker.start()
    try:
        yield
    finally:
        await kafka_enrichment_worker.stop()


app = FastAPI(
    title="SocialFlow AI Service (Gemini 3.5 Flash-Lite, LangGraph & LLMOps)",
    description=(
        "Real-time content moderation, smart tagging, sentiment analysis, RAG feed Q&A, "
        "autonomous Kafka enrichment, voice assistant, guardrails, and LLMOps telemetry for SocialFlow"
    ),
    version="1.3.0",
    lifespan=lifespan,
)


def _configure_cors(application: FastAPI) -> None:
    raw_origins = [
        o.strip() for o in (config.CORS_ALLOWED_ORIGINS or "").split(",") if o.strip()
    ]
    if not raw_origins or "*" in raw_origins:
        # Per Fetch/CORS spec, never combine wildcard '*' with allow_credentials=True
        application.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )
    else:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=raw_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )


_configure_cors(app)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    cid = set_correlation_id(request.headers.get("X-Correlation-Id"))
    response = await call_next(request)
    response.headers["X-Correlation-Id"] = cid
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = dict(exc.headers) if exc.headers else {}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-Id"] = cid
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": exc.status_code,
            "error": str(exc.detail),
            "message": str(exc.detail),
            "detail": exc.detail,
            "path": request.url.path,
        },
    )


def _require_admin(x_user_role: Optional[str]) -> None:
    if not is_admin_role(x_user_role):
        telemetry.record_guardrail_event("rbac_denied")
        log_structured(
            logging.WARNING,
            "rbac_admin_denied",
            provided_role=x_user_role or "NONE",
        )
        raise HTTPException(
            status_code=403,
            detail="Admin role (X-User-Role: ADMIN) is required for this endpoint",
        )


def _enforce_rate_limit(user_id: int, x_user_role: Optional[str]) -> None:
    allowed, retry_after = rate_limiter.check_and_consume(user_id, x_user_role)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"AI rate limit exceeded. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


class AnalyzeRequest(BaseModel):
    content: str


class SmartRepliesRequest(BaseModel):
    content: str


class AskFeedRequest(BaseModel):
    question: str
    posts: Optional[List[Dict[str, Any]]] = None
    user_id: Optional[int] = None


class ChatReplyRequest(BaseModel):
    sender: str = "דניאל לוי"
    message: str
    history: Optional[List[Dict[str, str]]] = None


class SetKeyRequest(BaseModel):
    api_key: str
    model: Optional[str] = "gemini-3.5-flash-lite"


class AgentRunRequest(BaseModel):
    topic: str
    user_id: int = 1
    target_audience: Optional[str] = "קהל רשת חברתית"
    user_approved: bool = False


class VoiceTtsRequest(BaseModel):
    text: str
    voice: Optional[str] = "he-IL-HilaNeural"


class EnrichmentProcessRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    post_id: int = Field(alias="postId")
    content: str
    author_id: Optional[int] = Field(default=None, alias="authorId")
    author_username: Optional[str] = Field(default=None, alias="authorUsername")
    tags: Optional[List[str]] = None
    event_id: Optional[str] = Field(default=None, alias="eventId")
    event_type: str = Field(default="POST_CREATED", alias="eventType")
    emit_kafka: bool = True


@app.get("/health")
@app.get("/api/v1/ai/health")
async def health():
    return {
        "status": "UP",
        "service": "ai-service",
        "model": gemini_client.model,
        "has_api_key": bool(gemini_client.api_key),
    }


@app.get("/api/v1/ai/enrichment/status")
async def enrichment_status():
    return kafka_enrichment_worker.get_status()


@app.post("/api/v1/ai/enrichment/process")
async def trigger_enrichment_process(
    req: EnrichmentProcessRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    """
    Manual/Postman HTTP trigger for the autonomous POST_CREATED triage & enrichment
    LangGraph pipeline (publishes POST_ENRICHED/CONTENT_FLAGGED to ai-enrichment-events
    or routes errors to ai-enrichment-dlq).
    """
    resolved_user_id = resolve_authenticated_user_id(
        x_user_id, x_auth_user_id, req.author_id or 1
    )
    _enforce_rate_limit(resolved_user_id, x_user_role)

    event_payload = {
        "eventId": req.event_id,
        "eventType": req.event_type,
        "postId": req.post_id,
        "authorId": resolved_user_id,
        "authorUsername": req.author_username,
        "content": req.content,
        "tags": req.tags or [],
    }
    return await kafka_enrichment_worker.process_event(
        event_payload,
        emit_kafka=req.emit_kafka,
        bypass_dedup=True,
    )


@app.get("/api/v1/ai/metrics")
async def ai_metrics(format: str = Query(default="json")):
    if (format or "").strip().lower() == "prometheus":
        return PlainTextResponse(
            content=telemetry.render_prometheus(active_model=gemini_client.model),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )
    return telemetry.get_metrics(active_model=gemini_client.model)


@app.get("/api/v1/ai/traces")
async def ai_traces(
    limit: int = Query(default=50, ge=1, le=200),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    _require_admin(x_user_role)
    traces = telemetry.get_recent_traces(limit=limit)
    return {"count": len(traces), "traces": traces}


@app.post("/api/v1/ai/analyze")
async def analyze_post(
    req: AnalyzeRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, 1)
    _enforce_rate_limit(resolved_user_id, x_user_role)
    return await gemini_client.analyze_post(req.content, user_id=resolved_user_id)


@app.post("/api/v1/ai/smart-replies")
async def get_smart_replies(
    req: SmartRepliesRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, 1)
    _enforce_rate_limit(resolved_user_id, x_user_role)
    replies = await gemini_client.generate_smart_replies(
        req.content, user_id=resolved_user_id
    )
    return {"replies": replies}


def _resolve_feed_service_uri() -> str:
    on_render = (
        os.getenv("RENDER", "").lower() == "true"
        or bool(os.getenv("RENDER_SERVICE_ID"))
    )
    feed_uri = os.getenv("FEED_SERVICE_URI")
    if feed_uri:
        return feed_uri.rstrip("/")
    hostport = os.getenv("FEED_SERVICE_HOSTPORT", "")
    if on_render and (not hostport or "." not in hostport.split(":")[0]):
        return "https://socialflow-feed-service.onrender.com"
    if hostport:
        return f"http://{hostport}"
    return "http://feed-service:8083"


def _resolve_notification_service_url() -> str:
    """
    Resolves notification-service endpoint cleanly whether NOTIFICATION_SERVICE_URI
    is provided as a base URI (http://notification-service:8085) or a full path
    (http://notification-service:8085/api/v1/notifications).
    """
    raw_uri = (os.getenv("NOTIFICATION_SERVICE_URI") or "").strip()
    if raw_uri:
        base = raw_uri.rstrip("/")
    else:
        on_render = (
            os.getenv("RENDER", "").lower() == "true"
            or bool(os.getenv("RENDER_SERVICE_ID"))
        )
        hostport = os.getenv("NOTIFICATION_SERVICE_HOSTPORT", "").strip()
        if on_render and (not hostport or "." not in hostport.split(":")[0]):
            base = "https://socialflow-notification-service.onrender.com"
        elif hostport:
            base = f"http://{hostport}".rstrip("/")
        else:
            base = "http://notification-service:8085"

    if base.endswith("/api/v1/notifications"):
        return base
    return f"{base}/api/v1/notifications"


async def _execute_ask_feed(
    req: AskFeedRequest,
    resolved_user_id: int,
    authorization: Optional[str],
) -> Dict[str, Any]:
    initial_state = {
        "question": req.question,
        "user_id": resolved_user_id,
        "authorization": authorization,
        "provided_posts": req.posts or [],
        "feed_service_uri": _resolve_feed_service_uri(),
        "search_query": req.question,
        "keywords": [],
        "retries": 0,
        "should_retry": False,
        "retrieved_posts": [],
        "relevant_posts": [],
        "retrieval_mode": "hybrid_es_rrf",
        "corrected": False,
        "answer": "",
        "citations": [],
        "sources": [],
        "model_used": gemini_client.model,
        "guardrails": {},
        "relevant_posts_count": 0,
    }
    result = await crag_ask_feed_graph.ainvoke(initial_state)
    return {
        "answer": result.get("answer", ""),
        "relevant_posts_count": result.get("relevant_posts_count", 0),
        "model_used": result.get("model_used", gemini_client.model),
        "sources": result.get("sources", []),
        "citations": result.get("citations", []),
        "retrieval_mode": result.get("retrieval_mode", "hybrid_es_rrf"),
        "corrected": bool(result.get("corrected", False)),
        "guardrails": result.get("guardrails", {}),
    }


@app.post("/api/v1/ai/ask-feed")
async def ask_feed(
    req: AskFeedRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    authorization: Optional[str] = Header(default=None),
):
    resolved_user_id = resolve_authenticated_user_id(
        x_user_id, x_auth_user_id, req.user_id or 1
    )
    _enforce_rate_limit(resolved_user_id, x_user_role)
    return await _execute_ask_feed(req, resolved_user_id, authorization)


@app.post("/api/v1/ai/ask-feed/stream")
async def ask_feed_stream(
    req: AskFeedRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    authorization: Optional[str] = Header(default=None),
):
    resolved_user_id = resolve_authenticated_user_id(
        x_user_id, x_auth_user_id, req.user_id or 1
    )
    _enforce_rate_limit(resolved_user_id, x_user_role)

    async def _event_stream():
        def _sse(event_name: str, data: Dict[str, Any]) -> str:
            return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        yield _sse("status", {"stage": "planning", "question": req.question})
        result = await _execute_ask_feed(req, resolved_user_id, authorization)
        yield _sse(
            "retrieval",
            {
                "retrieval_mode": result["retrieval_mode"],
                "corrected": result["corrected"],
                "relevant_posts_count": result["relevant_posts_count"],
                "citations": result["citations"],
            },
        )
        answer = result.get("answer", "")
        chunk_size = 48
        for i in range(0, len(answer), chunk_size):
            yield _sse("token", {"delta": answer[i : i + chunk_size]})
        yield _sse("done", result)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/ai/chat-reply")
async def chat_reply(
    req: ChatReplyRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, 1)
    _enforce_rate_limit(resolved_user_id, x_user_role)
    reply = await gemini_client.generate_chat_reply(
        req.sender, req.message, req.history, user_id=resolved_user_id
    )
    return {"reply": reply}


@app.post("/api/v1/ai/agent/run")
async def run_socialflow_agent(
    req: AgentRunRequest,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    """
    Executes the autonomous SocialFlow LangGraph agent:
    1. Researches feed trends via Gateway
    2. Drafts post & tags with Gemini
    3. Moderates for safety
    4. Publishes via Gateway using Authorization JWT if user_approved is True
    """
    resolved_user_id = resolve_authenticated_user_id(
        x_user_id, x_auth_user_id, req.user_id
    )
    _enforce_rate_limit(resolved_user_id, x_user_role)

    initial_state = {
        "topic": req.topic,
        "user_id": resolved_user_id,
        "target_audience": req.target_audience,
        "auth_header": authorization,
        "trends_context": [],
        "draft_content": "",
        "suggested_tags": [],
        "suggested_poll": None,
        "moderation_status": {},
        "user_approved": req.user_approved,
        "published_post_id": None,
        "logs": [],
        "error": None,
    }
    result = await socialflow_agent.ainvoke(initial_state)
    result.pop("auth_header", None)
    return {k: v for k, v in result.items() if v is not None}


@app.post("/api/v1/ai/config")
async def update_config(
    req: SetKeyRequest,
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    _require_admin(x_user_role)
    gemini_client.set_api_key(req.api_key)
    if req.model:
        gemini_client.model = req.model
    log_structured(
        logging.INFO,
        "ai_config_updated",
        model=gemini_client.model,
        has_api_key=bool(gemini_client.api_key),
    )
    return {
        "success": True,
        "model": gemini_client.model,
        "has_api_key": bool(gemini_client.api_key),
    }


# =========================================================================
# Voice Assistant Endpoints (STT, TTS, and End-to-End Voice -> Chat/RAG/Agent)
# =========================================================================


@app.get("/api/v1/ai/voice/voices")
async def list_voices():
    return {
        "default_voice": "he-IL-HilaNeural",
        "voices": AVAILABLE_VOICES,
    }


@app.post("/api/v1/ai/voice/tts")
async def text_to_speech(
    req: VoiceTtsRequest,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, 1)
    _enforce_rate_limit(resolved_user_id, x_user_role)
    if not req.text or not req.text.strip():
        raise HTTPException(
            status_code=400, detail="Text is required for speech synthesis"
        )
    try:
        audio_bytes = await synthesize_speech(req.text, req.voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="socialflow-voice.mp3"',
                "X-Voice-Used": resolve_voice(req.voice),
            },
        )
    except Exception as exc:
        log_structured(
            logging.ERROR,
            "voice_tts_failed",
            error=redact_pii_text(str(exc), record_metric=False),
        )
        raise HTTPException(
            status_code=500, detail=f"TTS synthesis failed: {str(exc)}"
        )


@app.post("/api/v1/ai/voice/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, 1)
    _enforce_rate_limit(resolved_user_id, x_user_role)
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
    try:
        mime_type = audio.content_type or "audio/wav"
        result = await transcribe_audio(
            audio_bytes, mime_type, user_id=resolved_user_id
        )
        result["filename"] = audio.filename or "audio"
        return result
    except Exception as exc:
        log_structured(
            logging.ERROR,
            "voice_stt_failed",
            error=redact_pii_text(str(exc), record_metric=False),
        )
        raise HTTPException(
            status_code=500, detail=f"STT transcription failed: {str(exc)}"
        )


@app.post("/api/v1/ai/voice/assistant")
async def voice_assistant(
    audio: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    voice: str = Form(default="he-IL-HilaNeural"),
    user_id: int = Form(default=1),
    auto_publish: bool = Form(default=False),
    return_audio: str = Form(default="json"),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    resolved_user_id = resolve_authenticated_user_id(x_user_id, x_auth_user_id, user_id)
    _enforce_rate_limit(resolved_user_id, x_user_role)

    transcript = (text or "").strip()
    if audio is not None:
        audio_bytes = await audio.read()
        if audio_bytes:
            stt_res = await transcribe_audio(
                audio_bytes,
                audio.content_type or "audio/wav",
                user_id=resolved_user_id,
            )
            transcript = stt_res.get("transcript", "").strip()

    if not transcript:
        raise HTTPException(
            status_code=400, detail="Provide either an audio file or a text field"
        )

    route = await classify_voice_intent(transcript, user_id=resolved_user_id)
    intent = route["intent"]
    injection_detected = bool(route.get("injection_detected", False))
    should_publish = bool(
        (auto_publish or route.get("auto_publish", False)) and not injection_detected
    )

    reply_text = ""
    extra_payload: Dict[str, Any] = {}

    if intent == "agent":
        agent_state = {
            "topic": route.get("topic") or transcript,
            "user_id": resolved_user_id,
            "target_audience": "קהל רשת חברתית",
            "auth_header": authorization,
            "trends_context": [],
            "draft_content": "",
            "suggested_tags": [],
            "suggested_poll": None,
            "moderation_status": {},
            "user_approved": should_publish,
            "published_post_id": None,
            "logs": [],
            "error": None,
        }
        agent_result = await socialflow_agent.ainvoke(agent_state)
        agent_result.pop("auth_header", None)
        clean_agent = {k: v for k, v in agent_result.items() if v is not None}
        extra_payload["agent_result"] = clean_agent

        draft = clean_agent.get("draft_content", "")
        pub_id = clean_agent.get("published_post_id")
        if pub_id:
            reply_text = f"הפוסט נוצר ופורסם בהצלחה בפיד עם מזהה מספר {pub_id}. הנה התוכן: {draft}"
        else:
            reply_text = f"הכנתי עבורך טיוטת פוסט וסקר שעברו בדיקת בטיחות. הנה הטיוטה: {draft}"
    elif intent == "rag":
        rag_res = await _execute_ask_feed(
            AskFeedRequest(question=transcript, user_id=resolved_user_id),
            resolved_user_id=resolved_user_id,
            authorization=authorization,
        )
        extra_payload["rag_result"] = rag_res
        reply_text = rag_res.get("answer") or "לא נמצא מידע רלוונטי בפיד כרגע."
    else:
        reply_text = await gemini_client.generate_chat_reply(
            "SocialFlow AI", transcript, user_id=resolved_user_id
        )

    chosen_voice = resolve_voice(voice)
    audio_bytes_out = b""
    try:
        audio_bytes_out = await synthesize_speech(reply_text, chosen_voice)
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "voice_assistant_tts_warning",
            error=redact_pii_text(str(exc), record_metric=False),
        )
        extra_payload["tts_warning"] = str(exc)

    if (return_audio or "").strip().lower() == "mp3" and audio_bytes_out:
        return Response(
            content=audio_bytes_out,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="socialflow-assistant.mp3"',
                "X-Voice-Intent": intent,
                "X-Voice-Used": chosen_voice,
                "X-Voice-Transcript": quote(transcript[:200]),
            },
        )

    response_body: Dict[str, Any] = {
        "transcript": transcript,
        "intent": intent,
        "reply_text": reply_text,
        "voice_used": chosen_voice,
        "audio_mime": "audio/mpeg",
        "audio_size_bytes": len(audio_bytes_out),
    }
    if audio_bytes_out:
        response_body["audio_base64"] = base64.b64encode(audio_bytes_out).decode("utf-8")
    response_body.update(extra_payload)
    return response_body


@app.post("/api/v1/ai/voice/briefing")
async def voice_daily_briefing(
    request: Request,
    user_id: Optional[int] = Query(default=None),
    voice: Optional[str] = Query(default=None),
    return_audio: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_auth_user_id: Optional[str] = Header(default=None, alias="X-Auth-UserId"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
):
    """
    Generates a personalized Hebrew Voice Daily Briefing from recent feed posts
    and user notifications, then synthesizes MP3 speech via edge-tts.
    """
    body_data: Dict[str, Any] = {}
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            parsed = await request.json()
            if isinstance(parsed, dict):
                body_data = parsed
        except Exception as exc:
            log_structured(logging.WARNING, "briefing_json_parse_failed", error=str(exc))
    elif (
        "multipart/form-data" in content_type
        or "application/x-www-form-urlencoded" in content_type
    ):
        try:
            form = await request.form()
            body_data = dict(form)
        except Exception as exc:
            log_structured(logging.WARNING, "briefing_form_parse_failed", error=str(exc))

    raw_user_id = user_id if user_id is not None else body_data.get("user_id", 1)
    try:
        fallback_uid = int(raw_user_id)
    except (TypeError, ValueError):
        fallback_uid = 1

    resolved_user_id = resolve_authenticated_user_id(
        x_user_id, x_auth_user_id, fallback_uid
    )
    _enforce_rate_limit(resolved_user_id, x_user_role)

    resolved_voice_param = (
        voice if voice is not None else (body_data.get("voice") or "he-IL-HilaNeural")
    )
    resolved_return_audio = (
        return_audio
        if return_audio is not None
        else (body_data.get("return_audio") or "json")
    )

    headers: Dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-Id"] = cid

    posts_context: List[Dict[str, Any]] = []
    try:
        feed_uri = _resolve_feed_service_uri()
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(
                f"{feed_uri}/api/v1/feed/for-you?userId={resolved_user_id}&page=0&size=20",
                headers=headers,
            )
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, dict):
                    posts_context = data.get("content", [])
                elif isinstance(data, list):
                    posts_context = data
            else:
                log_structured(
                    logging.WARNING,
                    "briefing_feed_non_200",
                    status_code=res.status_code,
                    user_id=resolved_user_id,
                )
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "briefing_feed_fetch_failed",
            user_id=resolved_user_id,
            error=redact_pii_text(str(exc), record_metric=False),
        )

    notifications_context: List[Dict[str, Any]] = []
    try:
        notif_url = _resolve_notification_service_url()
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(notif_url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list):
                    notifications_context = data
                elif isinstance(data, dict):
                    notifications_context = (
                        data.get("content") or data.get("notifications") or []
                    )
            else:
                log_structured(
                    logging.WARNING,
                    "briefing_notifications_non_200",
                    status_code=res.status_code,
                    user_id=resolved_user_id,
                )
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "briefing_notifications_fetch_failed",
            user_id=resolved_user_id,
            error=redact_pii_text(str(exc), record_metric=False),
        )

    briefing_text = await generate_daily_briefing(
        posts_context, notifications_context, user_id=resolved_user_id
    )
    chosen_voice = resolve_voice(str(resolved_voice_param))

    audio_bytes_out = b""
    tts_warning: Optional[str] = None
    try:
        audio_bytes_out = await synthesize_speech(briefing_text, chosen_voice)
    except Exception as exc:
        tts_warning = str(exc)
        log_structured(
            logging.WARNING,
            "briefing_tts_warning",
            error=redact_pii_text(str(exc), record_metric=False),
        )

    if str(resolved_return_audio).strip().lower() == "mp3" and audio_bytes_out:
        return Response(
            content=audio_bytes_out,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="socialflow-daily-briefing.mp3"',
                "X-Voice-Used": chosen_voice,
            },
        )

    response_body: Dict[str, Any] = {
        "briefing_text": briefing_text,
        "posts_analyzed": len(posts_context),
        "notifications_count": len(notifications_context),
        "voice_used": chosen_voice,
        "audio_size_bytes": len(audio_bytes_out),
        "audio_base64": (
            base64.b64encode(audio_bytes_out).decode("utf-8") if audio_bytes_out else ""
        ),
    }
    if tts_warning:
        response_body["tts_warning"] = tts_warning
    return response_body
