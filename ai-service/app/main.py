from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from app.config import config
from app.gemini_client import gemini_client

app = FastAPI(
    title="SocialFlow AI Service (Gemini 3.5 Flash-Lite)",
    description="Real-time content moderation, smart tagging, sentiment analysis, and smart replies for SocialFlow",
    version="1.0.0"
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

class SetKeyRequest(BaseModel):
    api_key: str
    model: Optional[str] = "gemini-3.5-flash-lite"

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
