from fastapi import FastAPI, Header, UploadFile, File, Form, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import base64
import os
import httpx
from urllib.parse import quote
from app.config import config
from app.gemini_client import gemini_client
from app.agent_workflow import socialflow_agent
from app.voice_service import (
    AVAILABLE_VOICES,
    classify_voice_intent,
    generate_daily_briefing,
    resolve_voice,
    synthesize_speech,
    transcribe_audio,
)

app = FastAPI(
    title="SocialFlow AI Service (Gemini 3.5 Flash-Lite & RAG)",
    description="Real-time content moderation, smart tagging, sentiment analysis, RAG feed Q&A, and conversational chat replies for SocialFlow",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    content: str

class SmartRepliesRequest(BaseModel):
    content: str

class AskFeedRequest(BaseModel):
    question: str
    posts: Optional[List[Dict[str, Any]]] = None

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

@app.get("/health")
@app.get("/api/v1/ai/health")
async def health():
    return {
        "status": "UP",
        "service": "ai-service",
        "model": gemini_client.model,
        "has_api_key": bool(gemini_client.api_key)
    }

@app.post("/api/v1/ai/analyze")
async def analyze_post(req: AnalyzeRequest):
    return await gemini_client.analyze_post(req.content)

@app.post("/api/v1/ai/smart-replies")
async def get_smart_replies(req: SmartRepliesRequest):
    replies = await gemini_client.generate_smart_replies(req.content)
    return {"replies": replies}

def _resolve_feed_service_uri() -> str:
    on_render = os.getenv("RENDER", "").lower() == "true" or bool(os.getenv("RENDER_SERVICE_ID"))
    feed_uri = os.getenv("FEED_SERVICE_URI")
    if feed_uri:
        return feed_uri.rstrip("/")
    hostport = os.getenv("FEED_SERVICE_HOSTPORT", "")
    if on_render and (not hostport or "." not in hostport.split(":")[0]):
        return "https://socialflow-feed-service.onrender.com"
    if hostport:
        return f"http://{hostport}"
    return "http://feed-service:8083"


@app.post("/api/v1/ai/ask-feed")
async def ask_feed(req: AskFeedRequest):
    posts_context = req.posts or []
    # If no posts provided directly in the request, try fetching recent feed from feed-service or post-service
    if not posts_context:
        try:
            feed_uri = _resolve_feed_service_uri()
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{feed_uri}/api/v1/feed/for-you?userId=1&page=0&size=20")
                if res.status_code == 200:
                    data = res.json()
                    posts_context = data.get("content", [])
        except Exception:
            pass

    return await gemini_client.ask_feed_rag(req.question, posts_context)

@app.post("/api/v1/ai/chat-reply")
async def chat_reply(req: ChatReplyRequest):
    reply = await gemini_client.generate_chat_reply(req.sender, req.message, req.history)
    return {"reply": reply}

@app.post("/api/v1/ai/agent/run")
async def run_socialflow_agent(
    req: AgentRunRequest,
    authorization: Optional[str] = Header(default=None)
):
    """
    Executes the autonomous SocialFlow LangGraph agent:
    1. Researches feed trends
    2. Drafts post & tags with Gemini
    3. Moderates for safety
    4. Publishes if user_approved is True (or halts at ready_for_review)
    """
    initial_state = {
        "topic": req.topic,
        "user_id": req.user_id,
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
        "error": None
    }
    result = await socialflow_agent.ainvoke(initial_state)
    result.pop("auth_header", None)
    return {k: v for k, v in result.items() if v is not None}

@app.post("/api/v1/ai/config")
async def update_config(req: SetKeyRequest):
    gemini_client.set_api_key(req.api_key)
    if req.model:
        gemini_client.model = req.model
    return {
        "success": True,
        "model": gemini_client.model,
        "has_api_key": bool(gemini_client.api_key)
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
async def text_to_speech(req: VoiceTtsRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required for speech synthesis")
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


@app.post("/api/v1/ai/voice/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
    try:
        mime_type = audio.content_type or "audio/wav"
        result = await transcribe_audio(audio_bytes, mime_type)
        result["filename"] = audio.filename or "audio"
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT transcription failed: {str(e)}")


@app.post("/api/v1/ai/voice/assistant")
async def voice_assistant(
    audio: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    voice: str = Form(default="he-IL-HilaNeural"),
    user_id: int = Form(default=1),
    auto_publish: bool = Form(default=False),
    return_audio: str = Form(default="json"),
    authorization: Optional[str] = Header(default=None),
):
    """
    End-to-end Voice Assistant for SocialFlow:
    1. Accepts either an uploaded audio file (WAV/MP3/WEBM/M4A) or a text prompt.
    2. Transcribes audio via Gemini STT when audio is provided.
    3. Routes intent automatically to LangGraph Agent ('agent'), Feed RAG ('rag'), or Chat ('chat').
    4. Synthesizes Hebrew/English neural MP3 reply via edge-tts.
    5. Returns either clean JSON (with audio_base64) or raw audio/mpeg when return_audio='mp3'.
    """
    transcript = (text or "").strip()
    if audio is not None:
        audio_bytes = await audio.read()
        if audio_bytes:
            stt_res = await transcribe_audio(audio_bytes, audio.content_type or "audio/wav")
            transcript = stt_res.get("transcript", "").strip()

    if not transcript:
        raise HTTPException(status_code=400, detail="Provide either an audio file or a text field")

    route = await classify_voice_intent(transcript)
    intent = route["intent"]
    should_publish = bool(auto_publish or route.get("auto_publish", False))

    reply_text = ""
    extra_payload: Dict[str, Any] = {}

    if intent == "agent":
        agent_state = {
            "topic": route.get("topic") or transcript,
            "user_id": user_id,
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
        rag_res = await ask_feed(AskFeedRequest(question=transcript))
        extra_payload["rag_result"] = rag_res
        reply_text = rag_res.get("answer") or "לא נמצא מידע רלוונטי בפיד כרגע."
    else:
        reply_text = await gemini_client.generate_chat_reply("SocialFlow AI", transcript)

    chosen_voice = resolve_voice(voice)
    audio_bytes_out = b""
    try:
        audio_bytes_out = await synthesize_speech(reply_text, chosen_voice)
    except Exception as e:
        extra_payload["tts_warning"] = str(e)

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
):
    """
    Generates a personalized Hebrew Voice Daily Briefing from recent feed posts
    and user notifications, then synthesizes MP3 speech via edge-tts.
    Accepts JSON body, form data, or query parameters.
    """
    body_data: Dict[str, Any] = {}
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            parsed = await request.json()
            if isinstance(parsed, dict):
                body_data = parsed
        except Exception:
            pass
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            body_data = dict(form)
        except Exception:
            pass

    raw_user_id = user_id if user_id is not None else body_data.get("user_id", 1)
    try:
        resolved_user_id = int(raw_user_id)
    except (TypeError, ValueError):
        resolved_user_id = 1

    resolved_voice_param = voice if voice is not None else (body_data.get("voice") or "he-IL-HilaNeural")
    resolved_return_audio = return_audio if return_audio is not None else (body_data.get("return_audio") or "json")

    headers = {"Authorization": authorization} if authorization else {}

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
    except Exception:
        pass

    notifications_context: List[Dict[str, Any]] = []
    try:
        notif_uri = os.getenv("NOTIFICATION_SERVICE_URI") or "http://notification-service:8085/api/v1/notifications"
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(notif_uri, headers=headers)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list):
                    notifications_context = data
                elif isinstance(data, dict):
                    notifications_context = data.get("content") or data.get("notifications") or []
    except Exception:
        pass

    briefing_text = await generate_daily_briefing(posts_context, notifications_context)
    chosen_voice = resolve_voice(str(resolved_voice_param))

    audio_bytes_out = b""
    tts_warning: Optional[str] = None
    try:
        audio_bytes_out = await synthesize_speech(briefing_text, chosen_voice)
    except Exception as e:
        tts_warning = str(e)

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
        "audio_base64": base64.b64encode(audio_bytes_out).decode("utf-8") if audio_bytes_out else "",
    }
    if tts_warning:
        response_body["tts_warning"] = tts_warning
    return response_body
