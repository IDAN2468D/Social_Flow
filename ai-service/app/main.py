from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from app.config import config
from app.gemini_client import gemini_client
from app.agent_workflow import socialflow_agent

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

@app.get("/health")
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

@app.post("/api/v1/ai/ask-feed")
async def ask_feed(req: AskFeedRequest):
    posts_context = req.posts or []
    # If no posts provided directly in the request, try fetching recent feed from feed-service or post-service
    if not posts_context:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get("http://feed-service:8083/api/v1/feed/for-you?userId=1&page=0&size=20")
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
async def run_socialflow_agent(req: AgentRunRequest):
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
    return result

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
