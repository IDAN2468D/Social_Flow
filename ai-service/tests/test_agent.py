import os
import sys
import asyncio
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.agent_workflow import socialflow_agent, create_socialflow_agent_graph

def test_agent_graph_compilation():
    """Verify LangGraph multi-step agent compiles with expected nodes and structure"""
    graph = create_socialflow_agent_graph()
    assert graph is not None
    assert hasattr(graph, 'ainvoke')

def test_agent_graph_execution():
    """Test autonomous agent multi-step flow execution"""
    async def _run():
        initial_state = {
            "topic": "Next.js 15 & AI Multi-Agent Architecture",
            "user_id": 1,
            "target_audience": "Fullstack Developers",
            "trends_context": [],
            "draft_content": "",
            "suggested_tags": [],
            "suggested_poll": None,
            "moderation_status": {},
            "user_approved": False,
            "published_post_id": None,
            "logs": [],
            "error": None
        }
        return await socialflow_agent.ainvoke(initial_state)

    result = asyncio.run(_run())
    assert result is not None
    assert "draft_content" in result
    assert len(result["draft_content"]) > 0
    assert "moderation_status" in result
    assert result["moderation_status"].get("is_safe") is True
    assert len(result.get("logs", [])) >= 3


def test_ai_health_endpoints():
    """Verify /health and /api/v1/ai/health return identical UP payloads"""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res_root = client.get("/health")
    res_v1 = client.get("/api/v1/ai/health")

    assert res_root.status_code == 200
    assert res_v1.status_code == 200
    assert res_v1.json() == res_root.json()
    assert res_v1.json()["status"] == "UP"
    assert res_v1.json()["service"] == "ai-service"


def test_voice_voices_and_intent_routing():
    """Verify voice listing endpoint and deterministic voice intent routing"""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.voice_service import classify_voice_intent, resolve_voice

    client = TestClient(app)
    res = client.get("/api/v1/ai/voice/voices")
    assert res.status_code == 200
    data = res.json()
    assert data["default_voice"] == "he-IL-HilaNeural"
    assert len(data["voices"]) >= 2

    assert resolve_voice("female") == "he-IL-HilaNeural"
    assert resolve_voice("male") == "he-IL-AvriNeural"

    agent_route = asyncio.run(classify_voice_intent("תכתוב לי פוסט על Kafka"))
    assert agent_route["intent"] == "agent"

    rag_route = asyncio.run(classify_voice_intent("מה חדש בפיד של SocialFlow?"))
    assert rag_route["intent"] == "rag"


def test_voice_daily_briefing_endpoint(monkeypatch):
    """Verify POST /api/v1/ai/voice/briefing returns Hebrew briefing JSON and MP3 audio"""
    from unittest.mock import AsyncMock
    from fastapi.testclient import TestClient
    import app.main as main_mod
    from app.voice_service import generate_daily_briefing

    sample_posts = [
        {"postId": 10, "authorUsername": "noa", "content": "השקנו היום פיצ'ר חדש ב-SocialFlow!"},
        {"postId": 11, "authorUsername": "daniel", "content": "מיקרו-שירותים עם FastAPI ו-Kafka."},
    ]
    sample_notifs = [
        {"id": 1, "message": "נועה לוי אהבה את הפוסט שלך"},
    ]

    fallback_text = asyncio.run(generate_daily_briefing(sample_posts, sample_notifs))
    assert "SocialFlow" in fallback_text
    assert "2 פוסטים" in fallback_text
    assert "1 התראות" in fallback_text

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            if "feed" in url:
                return FakeResponse(200, {"content": sample_posts})
            if "notifications" in url:
                return FakeResponse(200, sample_notifs)
            return FakeResponse(404, {})

    monkeypatch.setattr(main_mod.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(main_mod, "synthesize_speech", AsyncMock(return_value=b"ID3-MOCK-MP3"))

    client = TestClient(main_mod.app)

    res_json = client.post(
        "/api/v1/ai/voice/briefing",
        json={"user_id": 3, "voice": "female", "return_audio": "json"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert res_json.status_code == 200
    body = res_json.json()
    assert body["posts_analyzed"] == 2
    assert body["notifications_count"] == 1
    assert body["voice_used"] == "he-IL-HilaNeural"
    assert body["audio_size_bytes"] == len(b"ID3-MOCK-MP3")
    assert len(body["audio_base64"]) > 0
    assert len(body["briefing_text"]) > 0

    res_mp3 = client.post(
        "/api/v1/ai/voice/briefing?user_id=3&voice=male&return_audio=mp3",
    )
    assert res_mp3.status_code == 200
    assert res_mp3.headers["content-type"] == "audio/mpeg"
    assert res_mp3.headers["x-voice-used"] == "he-IL-AvriNeural"
    assert res_mp3.content == b"ID3-MOCK-MP3"
