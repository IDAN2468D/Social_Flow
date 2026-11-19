"""
SocialFlow Voice Assistant Service
Provides Hebrew & English Speech-to-Text (Gemini Multimodal),
Neural Text-to-Speech (edge-tts), and Intent Routing for Chat, RAG, and LangGraph Agents.
"""

import base64
import io
import json
from typing import Any, Dict, List, Optional
import httpx
import edge_tts
from app.gemini_client import gemini_client

VOICE_ALIASES: Dict[str, str] = {
    "female": "he-IL-HilaNeural",
    "hila": "he-IL-HilaNeural",
    "he-female": "he-IL-HilaNeural",
    "male": "he-IL-AvriNeural",
    "avri": "he-IL-AvriNeural",
    "he-male": "he-IL-AvriNeural",
    "en-female": "en-US-AriaNeural",
    "en-male": "en-US-GuyNeural",
}

AVAILABLE_VOICES: List[Dict[str, str]] = [
    {"id": "he-IL-HilaNeural", "alias": "female", "language": "he-IL", "gender": "Female", "label": "הילה (עברית — קול נשי)"},
    {"id": "he-IL-AvriNeural", "alias": "male", "language": "he-IL", "gender": "Male", "label": "אברי (עברית — קול גברי)"},
    {"id": "en-US-AriaNeural", "alias": "en-female", "language": "en-US", "gender": "Female", "label": "Aria (English — Female)"},
    {"id": "en-US-GuyNeural", "alias": "en-male", "language": "en-US", "gender": "Male", "label": "Guy (English — Male)"},
]


def resolve_voice(voice: Optional[str]) -> str:
    if not voice or not voice.strip():
        return "he-IL-HilaNeural"
    key = voice.strip().lower()
    return VOICE_ALIASES.get(key, voice.strip())


async def synthesize_speech(text: str, voice: Optional[str] = None) -> bytes:
    """Converts text to natural neural MP3 audio using edge-tts."""
    chosen_voice = resolve_voice(voice)
    clean_text = (text or "").strip()
    if not clean_text:
        clean_text = "שלום, העוזר הקולי של SocialFlow מוכן."

    communicate = edge_tts.Communicate(clean_text, chosen_voice)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            buf.write(chunk["data"])
    return buf.getvalue()


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
    """Transcribes audio bytes (WAV/MP3/WEBM/OGG/M4A) to Hebrew/English text via Gemini."""
    normalized_mime = (mime_type or "audio/wav").split(";")[0].strip().lower()
    if normalized_mime in ("audio/mp3", "application/octet-stream"):
        normalized_mime = "audio/mpeg"

    if not gemini_client.api_key:
        return {
            "transcript": "תמלול דמה: מה חדש בפיד של SocialFlow?",
            "mime_type": normalized_mime,
            "model_used": "mock-stt (Provide GEMINI_API_KEY for live Gemini transcription)",
        }

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_client.model}:generateContent?key={gemini_client.api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "תמלל במדויק את ההקלטה הקולית הבאה (בעברית או באנגלית, לפי שפת הדובר). "
                            "החזר אך ורק את טקסט התמלול הנקי ללא הסברים, מרכאות או תוספות."
                        )
                    },
                    {
                        "inlineData": {
                            "mimeType": normalized_mime,
                            "data": audio_b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {"temperature": 0.1},
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code == 200:
            data = res.json()
            transcript = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return {
                "transcript": transcript,
                "mime_type": normalized_mime,
                "model_used": gemini_client.model,
            }
        raise RuntimeError(f"Gemini STT returned HTTP {res.status_code}: {res.text[:200]}")


async def classify_voice_intent(text: str) -> Dict[str, Any]:
    """
    Routes a voice/text command to one of:
    - 'agent': draft or publish a post/poll with LangGraph
    - 'rag': ask a question about the live SocialFlow feed
    - 'chat': conversational reply
    """
    lower = (text or "").lower().strip()

    # Fast deterministic fallback / pre-check
    publish_keywords = ("תפרסם", "פרסם", "לפרסם", "publish", "post it")
    agent_keywords = ("תכתוב פוסט", "תכתוב לי פוסט", "כתוב פוסט", "תיצור פוסט", "צור פוסט", "פוסט על", "סקר על", "write a post", "create a post", "draft a post")
    rag_keywords = ("בפיד", "פיד", "טרנדים", "פוסטים האחרונים", "על מה מדברים", "מה חדש", "in the feed", "trending", "recent posts")

    fallback_intent = "chat"
    fallback_auto_publish = any(k in lower for k in publish_keywords)
    if any(k in lower for k in agent_keywords) or (fallback_auto_publish and ("פוסט" in lower or "post" in lower)):
        fallback_intent = "agent"
    elif any(k in lower for k in rag_keywords):
        fallback_intent = "rag"

    if not gemini_client.api_key:
        return {
            "intent": fallback_intent,
            "topic": text.strip(),
            "auto_publish": fallback_auto_publish,
        }

    prompt = f"""
אתה נתב חכם של עוזר קולי ברשת החברתית SocialFlow.
קבע לאיזה מסלול לנתב את בקשת המשתמש הבאה: "{text}"

אפשרויות המסלול:
- "agent": המשתמש מבקש לנסח, ליצור או לפרסם פוסט או סקר חדש.
- "rag": המשתמש שואל שאלה על מה שקורה בפיד, טרנדים או פוסטים אחרונים.
- "chat": שיחה חופשית, שאלה כללית או צ'אט רגיל.

החזר אך ורק JSON תקין במבנה:
{{
  "intent": "agent" | "rag" | "chat",
  "topic": "הנושא המזוקק של הפוסט אם intent הוא agent, אחרת הטקסט המקורי",
  "auto_publish": true | false
}}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_client.model}:generateContent?key={gemini_client.api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw)
                intent = parsed.get("intent", fallback_intent)
                if intent not in ("agent", "rag", "chat"):
                    intent = fallback_intent
                return {
                    "intent": intent,
                    "topic": parsed.get("topic") or text.strip(),
                    "auto_publish": bool(parsed.get("auto_publish", fallback_auto_publish)),
                }
    except Exception:
        pass

    return {
        "intent": fallback_intent,
        "topic": text.strip(),
        "auto_publish": fallback_auto_publish,
    }
