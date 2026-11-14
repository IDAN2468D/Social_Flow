"""
SocialFlow LangGraph Multi-Step Agent Workflow
Orchestrates autonomous content creation, trend discovery, content moderation, and human-in-the-loop publishing.
"""

import os
from typing import TypedDict, List, Dict, Any, Optional
import httpx
from langgraph.graph import StateGraph, START, END
from app.gemini_client import gemini_client
from app.config import config

class AgentPostState(TypedDict):
    topic: str
    user_id: int
    target_audience: Optional[str]
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
    or (f"http://{os.getenv('API_GATEWAY_HOSTPORT')}" if os.getenv("API_GATEWAY_HOSTPORT") else "")
    or "http://localhost:8088"
)

async def research_trends_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 1: Researches recent trending topics on SocialFlow to ground the post."""
    logs = list(state.get("logs", []))
    logs.append(f"🔍 שלב 1: סורק טרנדים ונושאים מובילים ברשת סביב '{state['topic']}'...")
    
    trends = []
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(
                f"{GATEWAY_BASE}/api/v1/feed/trending?userId={state.get('user_id', 1)}&page=0&size=5",
                headers={"X-Auth-UserId": str(state.get("user_id", 1)), "X-Auth-Username": "ai-agent"}
            )
            if res.status_code == 200:
                data = res.json()
                items = data.get("content", []) if isinstance(data, dict) else data
                for item in items[:5]:
                    trends.append(item.get("content", "")[:80])
    except Exception:
        # Fallback to local default topics if microservice is offline
        trends = ["#בינה_מלאכותית", "#טכנולוגיה", "#סטארטאפ_ישראלי", "#חדשנות"]
        
    logs.append(f"✅ זוהו {len(trends)} נקודות הקשר וטרנדים רלוונטיים.")
    return {
        "trends_context": trends,
        "logs": logs
    }

async def draft_post_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 2: Drafts an engaging post with tags and interactive poll using Gemini."""
    logs = list(state.get("logs", []))
    logs.append("✍️ שלב 2: מנסח פוסט איכותי, תגיות רלוונטיות וסקר אינטראקטיבי...")
    
    topic = state.get("topic", "")
    trends = ", ".join(state.get("trends_context", []))
    audience = state.get("target_audience", "קהל כללי ברשת חברתית")
    
    prompt = f"""
אתה מנהל תוכן וסוכן AI מומחה לרשת החברתית SocialFlow.
הנושא המבוקש לפוסט: "{topic}"
קהל יעד: "{audience}"
טרנדים והקשר מהפיד: "{trends}"

עליך לייצר תוכן מרתק בעברית לפוסט ברשת החברתית, הכולל:
1. תוכן פוסט סוחף (1-3 פסקאות קצרות, עם אימוג'ים מתאימים).
2. 3-5 האשטגים רלוונטיים (ללא סימן #).
3. שאלת סקר אינטראקטיבי קצר ומסקרן עם 2 עד 4 אפשרויות בחירה קצרות.

החזר אך ורק אובייקט JSON חוקי במבנה הבא:
{{
  "draft_content": "טקסט הפוסט בעברית...",
  "suggested_tags": ["טכנולוגיה", "בינה_מלאכותית", "SocialFlow"],
  "suggested_poll": {{
    "question": "שאלת הסקר?",
    "options": ["אפשרות 1", "אפשרות 2", "אפשרות 3"]
  }}
}}
"""
    if not gemini_client.api_key:
        draft = f"🚀 מחשבות על {topic}: הטכנולוגיה מתקדמת בקצב שיא, והשילוב של סוכני AI במוצרים יומיומיים משנה את כללי המשחק! מה דעתכם?"
        tags = ["טכנולוגיה", "SocialFlow", "חדשנות"]
        poll = {
            "question": f"האם כבר התחלתם להשתמש בסוכנים בעבודה?",
            "options": ["כן, יומיומי", "רק מתנסה", "עדיין לא"]
        }
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_client.model}:generateContent?key={gemini_client.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.7,
                "responseMimeType": "application/json"
            }
        }
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    import json
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    data = json.loads(text)
                    draft = data.get("draft_content", f"פוסט על {topic}")
                    tags = data.get("suggested_tags", ["SocialFlow"])
                    poll = data.get("suggested_poll")
                else:
                    draft = f"🚀 דיון בנושא {topic} ברשת SocialFlow!"
                    tags = ["דיון", "SocialFlow"]
                    poll = None
        except Exception as e:
            draft = f"🚀 דיון בנושא {topic}: נקודות מעניינות לשיתוף עם הקהילה."
            tags = ["SocialFlow"]
            poll = None

    logs.append("✅ טיוטת הפוסט, התגיות והסקר נוצרו בהצלחה.")
    return {
        "draft_content": draft,
        "suggested_tags": tags,
        "suggested_poll": poll,
        "logs": logs
    }

async def moderate_content_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 3: Moderates and validates post content for safety and guidelines."""
    logs = list(state.get("logs", []))
    logs.append("🛡️ שלב 3: מפעיל בדיקת בטיחות ותאימות לכללי הקהילה...")
    
    analysis = await gemini_client.analyze_post(state["draft_content"])
    is_safe = analysis.get("is_safe", True)
    
    if is_safe:
        logs.append("✅ הפוסט עבר בהצלחה את בדיקות הסינון ובטיחות התוכן.")
    else:
        logs.append(f"⚠️ אזהרת סינון תוכן: {analysis.get('moderation_reason', 'Unsafe')}")
        
    return {
        "moderation_status": analysis,
        "logs": logs
    }

async def publish_post_node(state: AgentPostState) -> Dict[str, Any]:
    """Node 4: Publishes the approved post to SocialFlow post-service."""
    logs = list(state.get("logs", []))
    
    if not state.get("user_approved", False):
        logs.append("⏸️ ממתין לאישור סופי מהמשתמש לפני פרסום בפיד.")
        return {"logs": logs}
        
    logs.append("🚀 שלב 4: מפרסם את הפוסט ב-SocialFlow...")
    payload = {
        "content": state.get("draft_content"),
        "mediaUrls": [],
        "tags": state.get("suggested_tags", []),
        "visibility": "PUBLIC"
    }
    
    poll = state.get("suggested_poll")
    if poll and poll.get("options") and len(poll.get("options")) >= 2:
        payload["poll"] = {
            "question": poll.get("question"),
            "options": poll.get("options"),
            "durationHours": 24
        }
        
    post_id = None
    try:
        user_id = state.get("user_id", 1)
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                f"{GATEWAY_BASE}/api/v1/posts",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Auth-UserId": str(user_id),
                    "X-Auth-Username": "agent-user"
                }
            )
            if res.status_code in (200, 201):
                post_data = res.json()
                post_id = post_data.get("id") or post_data.get("postId")
                logs.append(f"🎉 הפוסט פורסם בהצלחה בפיד! מזהה פוסט: #{post_id}")
            else:
                logs.append(f"❌ שגיאה בפרסום: סטטוס HTTP {res.status_code}")
    except Exception as e:
        logs.append(f"❌ שגיאת חיבור ל-Gateway: {str(e)}")

    return {
        "published_post_id": post_id,
        "logs": logs
    }

def route_after_moderation(state: AgentPostState) -> str:
    """Routing: if content is unsafe, terminate; otherwise proceed to publish/review."""
    mod = state.get("moderation_status", {})
    if not mod.get("is_safe", True):
        return END
    return "publish_post"

# Build and compile the LangGraph Workflow
def create_socialflow_agent_graph():
    builder = StateGraph(AgentPostState)
    
    # Add Nodes
    builder.add_node("research_trends", research_trends_node)
    builder.add_node("draft_post", draft_post_node)
    builder.add_node("moderate_content", moderate_content_node)
    builder.add_node("publish_post", publish_post_node)
    
    # Define Edges
    builder.add_edge(START, "research_trends")
    builder.add_edge("research_trends", "draft_post")
    builder.add_edge("draft_post", "moderate_content")
    builder.add_conditional_edges(
        "moderate_content",
        route_after_moderation,
        {
            "publish_post": "publish_post",
            END: END
        }
    )
    builder.add_edge("publish_post", END)
    
    return builder.compile()

# Singleton compiled graph instance
socialflow_agent = create_socialflow_agent_graph()
