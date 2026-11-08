import json
import httpx
from typing import Dict, Any, List
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
            # Fallback mock analysis when API key is not yet set
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
Generate 3 short, friendly, and natural quick reply options (in the language of the post).
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

gemini_client = GeminiClient()
