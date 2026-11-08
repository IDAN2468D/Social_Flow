import json
import httpx
from typing import Dict, Any, List, Optional
from app.config import config

class GeminiClient:
    def __init__(self):
        self.api_key = config.GEMINI_API_KEY
        self.model = config.GEMINI_MODEL

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        config.GEMINI_API_KEY = api_key

    async def analyze_post(self, content: str) -> Dict[str, Any]:
        """
        Analyzes post content using Gemini 3.5 Flash-Lite:
        - Sentiment analysis
        - Category classification
        - Smart hashtag extraction
        - Toxicity/Moderation check
        """
        if not self.api_key:
            return {
                "sentiment": "POSITIVE",
                "category": "Technology",
                "suggested_tags": ["#Tech", "#SocialFlow", "#Innovation"],
                "is_safe": True,
                "moderation_reason": "Safe content",
                "summary": content[:100] + "..." if len(content) > 100 else content,
                "model_used": "mock-analyzer (Provide GEMINI_API_KEY for live 3.5 Flash-Lite)"
            }

        prompt = f"""
You are the AI Intelligence Engine for SocialFlow social network.
Analyze the following post content using strict JSON format:
Post Content: "{content}"

Return ONLY a valid JSON object with these exact keys:
{{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "category": "Technology" | "News" | "Entertainment" | "Lifestyle" | "Business",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "is_safe": true | false,
  "moderation_reason": "string explanation if unsafe else 'Safe'",
  "summary": "1-line concise summary"
}}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    result = json.loads(text)
                    result["model_used"] = self.model
                    return result
                else:
                    return {
                        "error": f"Gemini API returned status {res.status_code}",
                        "raw": res.text[:200]
                    }
        except Exception as e:
            return {"error": str(e), "model_used": self.model}

    async def generate_smart_replies(self, post_content: str) -> List[str]:
        """
        Generates 3 quick smart reply suggestions for users in the feed.
        """
        if not self.api_key:
            return ["מעניין מאוד! 🔥", "תודה על השיתוף 👍", "מסכים לגמרי 👏"]

        prompt = f"""
Given this social media post: "{post_content}"
Generate 3 short, friendly, and natural quick reply options (in Hebrew).
Return ONLY a JSON array of strings: ["reply 1", "reply 2", "reply 3"].
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.7,
                "responseMimeType": "application/json"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text)
        except Exception:
            pass
        return ["מעניין מאוד! 🔥", "תודה על השיתוף 👍", "מסכים לגמרי 👏"]

    async def ask_feed_rag(self, question: str, posts_context: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        RAG / Semantic Question Answering over the SocialFlow feed posts.
        """
        # Build context from feed posts
        context_items = []
        for i, p in enumerate(posts_context[:15]):
            author = p.get("authorUsername") or "משתמש"
            content = p.get("content") or ""
            poll_info = ""
            if p.get("hasPoll") or p.get("poll"):
                poll = p.get("poll") or {}
                q = poll.get("question") or ""
                opts = [o.get("text") for o in poll.get("options", []) if isinstance(o, dict)]
                poll_info = f" [סקר: {q} | אפשרויות: {', '.join(opts)}]"
            context_items.append(f"פוסט #{p.get('postId', i+1)} מאת @{author}: {content}{poll_info}")

        context_str = "\n".join(context_items) if context_items else "אין פוסטים זמינים כרגע."

        if not self.api_key:
            return {
                "answer": f"על פי ניתוח הפוסטים האחרונים ברשת החברתית SocialFlow:\nהמשתמשים משתפים תכנים עדכניים בנושאי טכנולוגיה, בינה מלאכותית וסקרים אינטראקטיביים.",
                "relevant_posts_count": len(posts_context),
                "model_used": "mock-rag (Provide GEMINI_API_KEY for live Gemini 3.5 Flash-Lite)",
                "sources": [p.get("postId") or p.get("id") for p in posts_context[:3] if p.get("postId") or p.get("id")]
            }

        prompt = f"""
אתה עוזר הפיד החכם של הרשת החברתית SocialFlow.
לפניך רשימת הפוסטים האחרונים מהפיד של המשתמשים:
=== התחלת תוכן הפיד ===
{context_str}
=== סוף תוכן הפיד ===

שאלת המשתמש: "{question}"

ענה בעברית רהוטה וטבעית, בסגנון רשת חברתית מודרנית.
התבסס רק על המידע המופיע בפיד לעיל (RAG Grounding).
ציין את שמות המשתמשים או מספרי הפוסטים הרלוונטיים.
אם אין בפיד מענה ישיר לשאלה, ציין זאת בנימוס והצע נושאים קרובים שנמצאו בפיד.
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4
            }
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    answer_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {
                        "answer": answer_text,
                        "relevant_posts_count": len(posts_context),
                        "model_used": self.model,
                        "sources": [p.get("postId") or p.get("id") for p in posts_context[:4] if p.get("postId") or p.get("id")]
                    }
                else:
                    return {
                        "answer": "לא ניתן היה להשלים את שאילתת ה-RAG מול Gemini כרגע.",
                        "error": res.text[:200]
                    }
        except Exception as e:
            return {"answer": f"שגיאה בהפעלת מנוע ה-RAG: {str(e)}", "model_used": self.model}

    async def generate_chat_reply(self, sender: str, message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        Generates realistic Hebrew chat responses in the SocialFlow Messenger.
        """
        if not self.api_key:
            replies = [
                f"היי! ראיתי את ההודעה שלך ('{message}'), מסכים לגמרי! מה התוכניות שלך להיום?",
                f"אהבתי את הרעיון! בוא נריץ את זה יחד ב-SocialFlow 🔥",
                f"תודה שכתבת לי! אני בודק את הפוסטים החדשים עכשיו, נראה מעולה 👍"
            ]
            import random
            return random.choice(replies)

        prompt = f"""
אתה מגלם חבר בשם "{sender}" ברשת החברתית SocialFlow.
החבר שלך (עידן) שלח לך הודעה פרטית בצ'אט: "{message}".
ענה לו בהודעת צ'אט קצרה, חברית וזורמת בעברית (1-2 משפטים עם אימוג'י מתאים), כאילו אתה חבר אמיתי שמגיב ב-Messenger.
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.8
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            pass

        return "איזה יופי! מסכים איתך לגמרי 👍"

gemini_client = GeminiClient()
