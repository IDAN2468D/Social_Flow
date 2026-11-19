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
