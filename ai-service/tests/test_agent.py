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
