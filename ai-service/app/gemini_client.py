import json
import logging
import random
import time
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import config
from app.guardrails import (
    DATA_ISOLATION_POLICY,
    PostAnalysisOutput,
    SmartRepliesOutput,
    detect_prompt_injection,
    redact_pii_text,
    sanitize_posts_for_prompt,
    validate_structured_output,
    wrap_untrusted_xml,
)
from app.telemetry import log_structured, telemetry

T = TypeVar("T", bound=BaseModel)


class GeminiClient:
    def __init__(self):
        self.api_key = config.GEMINI_API_KEY
        self.model = config.GEMINI_MODEL

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        config.GEMINI_API_KEY = api_key

    def _build_url(self) -> str:
        return (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

    async def generate_content(
        self,
        *,
        operation: str,
        system_instruction: str,
        user_parts: List[Dict[str, Any]],
        temperature: float = 0.2,
        response_mime_type: Optional[str] = None,
        timeout: float = 12.0,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Centralized Gemini REST wrapper with:
        - systemInstruction / user contents separation
        - usageMetadata token & cost telemetry
        - latency tracking & structured error logging (never leaking API keys or PII)
        """
        gen_config: Dict[str, Any] = {"temperature": temperature}
        if response_mime_type:
            gen_config["responseMimeType"] = response_mime_type

        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": user_parts}],
            "generationConfig": gen_config,
        }

        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(self._build_url(), json=payload)
            latency_ms = (time.perf_counter() - started) * 1000.0

            if res.status_code != 200:
                safe_raw = redact_pii_text(res.text[:200], record_metric=False)
                telemetry.record_llm_call(
                    operation=operation,
                    model=self.model,
                    latency_ms=latency_ms,
                    status="error",
                    error_type=f"HTTP_{res.status_code}",
                    error_message=safe_raw,
                    user_id=user_id,
                )
                return {
                    "ok": False,
                    "status_code": res.status_code,
                    "error": f"Gemini API returned status {res.status_code}",
                    "raw": safe_raw,
                    "latency_ms": round(latency_ms, 2),
                }

            data = res.json()
            usage = data.get("usageMetadata") or {}
            input_tokens = int(usage.get("promptTokenCount") or 0)
            output_tokens = int(usage.get("candidatesTokenCount") or 0)
            total_tokens = int(usage.get("totalTokenCount") or (input_tokens + output_tokens))

            candidates = data.get("candidates") or []
            if not candidates:
                telemetry.record_llm_call(
                    operation=operation,
                    model=self.model,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    status="error",
                    error_type="EMPTY_CANDIDATES",
                    error_message="Gemini returned no candidates",
                    user_id=user_id,
                )
                return {
                    "ok": False,
                    "error": "Gemini returned no candidates",
                    "latency_ms": round(latency_ms, 2),
                }

            parts = (candidates[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()

            telemetry.record_llm_call(
                operation=operation,
                model=self.model,
                latency_ms=latency_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                status="success",
                user_id=user_id,
            )
            return {
                "ok": True,
                "text": text,
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                },
                "latency_ms": round(latency_ms, 2),
            }
        except Exception as exc:
            latency_ms = (time.perf_counter() - started) * 1000.0
            safe_err = redact_pii_text(str(exc), record_metric=False)
            telemetry.record_llm_call(
                operation=operation,
                model=self.model,
                latency_ms=latency_ms,
                status="error",
                error_type=type(exc).__name__,
                error_message=safe_err,
                user_id=user_id,
            )
            return {
                "ok": False,
                "error": safe_err,
                "latency_ms": round(latency_ms, 2),
            }

    async def generate_structured_json(
        self,
        *,
        operation: str,
        system_instruction: str,
        user_text: str,
        schema: Type[T],
        temperature: float = 0.2,
        wrap_list_key: Optional[str] = None,
        timeout: float = 12.0,
        user_id: Optional[int] = None,
    ) -> Tuple[Optional[T], bool, Optional[str]]:
        """
        Calls Gemini expecting JSON, validates with Pydantic v2, and runs up to 1
        structured repair pass if the initial response fails JSON/schema validation.
        Returns (validated_model_or_none, was_repaired, error_or_none).
        """
        res = await self.generate_content(
            operation=operation,
            system_instruction=system_instruction,
            user_parts=[{"text": user_text}],
            temperature=temperature,
            response_mime_type="application/json",
            timeout=timeout,
            user_id=user_id,
        )
        if not res.get("ok"):
            return None, False, res.get("error")

        raw_text = res.get("text", "")
        try:
            validated = validate_structured_output(
                raw_text, schema, wrap_list_key=wrap_list_key
            )
            return validated, False, None
        except (ValidationError, ValueError, json.JSONDecodeError) as first_err:
            telemetry.record_guardrail_event("json_repair")
            log_structured(
                logging.WARNING,
                "structured_output_repair_triggered",
                operation=operation,
                schema=schema.__name__,
                error=redact_pii_text(str(first_err)[:250], record_metric=False),
            )

            schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
            repair_system = (
                "You are a strict JSON repair assistant. Convert the malformed data inside "
                "<untrusted_output> into ONLY a single valid JSON document conforming exactly "
                f"to this JSON Schema:\n{schema_json}\n"
                "Do not add markdown fences or commentary. " + DATA_ISOLATION_POLICY
            )
            repair_user = (
                f"Validation error: {str(first_err)[:300]}\n"
                f"{wrap_untrusted_xml(raw_text, tag='untrusted_output', redact=False)}"
            )
            repair_res = await self.generate_content(
                operation=f"{operation}_repair",
                system_instruction=repair_system,
                user_parts=[{"text": repair_user}],
                temperature=0.0,
                response_mime_type="application/json",
                timeout=timeout,
                user_id=user_id,
            )
            if not repair_res.get("ok"):
                return None, False, repair_res.get("error")

            try:
                repaired = validate_structured_output(
                    repair_res.get("text", ""), schema, wrap_list_key=wrap_list_key
                )
                return repaired, True, None
            except (ValidationError, ValueError, json.JSONDecodeError) as second_err:
                log_structured(
                    logging.ERROR,
                    "structured_output_repair_failed",
                    operation=operation,
                    schema=schema.__name__,
                    error=redact_pii_text(str(second_err)[:250], record_metric=False),
                )
                return None, False, str(second_err)

    async def analyze_post(
        self, content: str, user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Analyzes post content using Gemini with XML prompt-injection sandboxing,
        PII redaction, systemInstruction separation, and Pydantic validation.
        """
        injection = detect_prompt_injection(content or "")
        safe_xml = wrap_untrusted_xml(content or "", tag="untrusted_post")

        if not self.api_key:
            telemetry.record_llm_call(
                operation="analyze_post",
                model="mock-analyzer",
                latency_ms=0.1,
                status="success",
                fallback_used=True,
                user_id=user_id,
            )
            is_safe = injection.risk_level != "high"
            reason = (
                "Prompt injection or policy override attempt detected"
                if not is_safe
                else "Safe content"
            )
            redacted_summary = redact_pii_text(content or "", record_metric=False)
            return {
                "sentiment": "POSITIVE" if is_safe else "NEGATIVE",
                "category": "Technology",
                "suggested_tags": ["#Tech", "#SocialFlow", "#Innovation"],
                "is_safe": is_safe,
                "moderation_reason": reason,
                "summary": (
                    redacted_summary[:100] + "..."
                    if len(redacted_summary) > 100
                    else redacted_summary
                ),
                "prompt_injection_detected": injection.detected,
                "model_used": "mock-analyzer (Provide GEMINI_API_KEY for live 3.5 Flash-Lite)",
            }

        system_instruction = (
            "You are the AI Intelligence & Safety Engine for the SocialFlow social network.\n"
            f"{DATA_ISOLATION_POLICY}\n"
            "Analyze the post inside <untrusted_post> and return ONLY a valid JSON object "
            "with these exact keys:\n"
            "{\n"
            '  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",\n'
            '  "category": "Technology" | "News" | "Entertainment" | "Lifestyle" | "Business",\n'
            '  "suggested_tags": ["#tag1", "#tag2", "#tag3"],\n'
            '  "is_safe": true | false,\n'
            '  "moderation_reason": "string explanation if unsafe else \'Safe\'",\n'
            '  "summary": "1-line concise summary"\n'
            "}"
        )

        validated, repaired, err = await self.generate_structured_json(
            operation="analyze_post",
            system_instruction=system_instruction,
            user_text=f"Analyze this social post:\n{safe_xml}",
            schema=PostAnalysisOutput,
            temperature=0.2,
            timeout=10.0,
            user_id=user_id,
        )

        if validated is not None:
            result = validated.model_dump()
            if injection.risk_level == "high":
                result["is_safe"] = False
                result["moderation_reason"] = (
                    "Blocked: prompt injection / safety override attempt detected"
                )
            result["prompt_injection_detected"] = injection.detected
            result["model_used"] = self.model
            if repaired:
                result["json_repaired"] = True
            return result

        log_structured(
            logging.WARNING,
            "analyze_post_fallback",
            error=redact_pii_text(str(err or "unknown"), record_metric=False),
        )
        return {
            "error": err or "Failed to analyze post via Gemini",
            "prompt_injection_detected": injection.detected,
            "model_used": self.model,
        }

    async def generate_smart_replies(
        self, post_content: str, user_id: Optional[int] = None
    ) -> List[str]:
        """Generates 3 quick smart reply suggestions for users in the feed."""
        default_replies = ["מעניין מאוד! 🔥", "תודה על השיתוף 👍", "מסכים לגמרי 👏"]
        detect_prompt_injection(post_content or "")
        safe_xml = wrap_untrusted_xml(post_content or "", tag="untrusted_post")

        if not self.api_key:
            telemetry.record_llm_call(
                operation="smart_replies",
                model="mock-smart-replies",
                latency_ms=0.1,
                status="success",
                fallback_used=True,
                user_id=user_id,
            )
            return default_replies

        system_instruction = (
            "You generate short, friendly, natural Hebrew quick reply suggestions for SocialFlow posts.\n"
            f"{DATA_ISOLATION_POLICY}\n"
            'Return ONLY a valid JSON object matching: {"replies": ["reply 1", "reply 2", "reply 3"]}.'
        )
        validated, _, err = await self.generate_structured_json(
            operation="smart_replies",
            system_instruction=system_instruction,
            user_text=f"Generate 3 Hebrew quick replies for this post:\n{safe_xml}",
            schema=SmartRepliesOutput,
            temperature=0.7,
            wrap_list_key="replies",
            timeout=10.0,
            user_id=user_id,
        )
        if validated is not None:
            return validated.replies

        telemetry.record_llm_call(
            operation="smart_replies",
            model=self.model,
            latency_ms=0.0,
            status="error",
            fallback_used=True,
            error_type="FALLBACK_DEFAULT",
            error_message=str(err or "Smart replies validation failed"),
            user_id=user_id,
        )
        return default_replies

    async def ask_feed_rag(
        self,
        question: str,
        posts_context: List[Dict[str, Any]],
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        RAG Question Answering over SocialFlow feed posts with XML data isolation
        and systemInstruction separation against indirect prompt injection.
        """
        question_check = detect_prompt_injection(question or "")
        feed_xml, post_injection_hits = sanitize_posts_for_prompt(
            posts_context, max_posts=15
        )
        question_xml = wrap_untrusted_xml(question or "", tag="untrusted_question")

        sources = [
            p.get("postId") or p.get("id")
            for p in posts_context[:4]
            if p.get("postId") or p.get("id")
        ]

        if not self.api_key:
            telemetry.record_llm_call(
                operation="ask_feed_rag",
                model="mock-rag",
                latency_ms=0.1,
                status="success",
                fallback_used=True,
                user_id=user_id,
            )
            return {
                "answer": (
                    "על פי ניתוח הפוסטים האחרונים ברשת החברתית SocialFlow:\n"
                    "המשתמשים משתפים תכנים עדכניים בנושאי טכנולוגיה, בינה מלאכותית וסקרים אינטראקטיביים."
                ),
                "relevant_posts_count": len(posts_context),
                "model_used": "mock-rag (Provide GEMINI_API_KEY for live Gemini 3.5 Flash-Lite)",
                "sources": sources[:3],
                "guardrails": {
                    "question_injection_detected": question_check.detected,
                    "feed_injections_neutralized": post_injection_hits,
                },
            }

        system_instruction = (
            "אתה עוזר הפיד החכם של הרשת החברתית SocialFlow.\n"
            f"{DATA_ISOLATION_POLICY}\n"
            "ענה בעברית רהוטה וטבעית, בסגנון רשת חברתית מודרנית.\n"
            "התבסס אך ורק על המידע שבתוך תגיות <untrusted_post> (RAG Grounding).\n"
            "ציין את שמות המשתמשים או מספרי הפוסטים הרלוונטיים.\n"
            "אם אין בפיד מענה ישיר לשאלה, ציין זאת בנימוס והצע נושאים קרובים שנמצאו בפיד."
        )
        user_payload = (
            f"פוסטים אחרונים מהפיד:\n<untrusted_feed>\n{feed_xml}\n</untrusted_feed>\n\n"
            f"שאלת המשתמש:\n{question_xml}"
        )

        res = await self.generate_content(
            operation="ask_feed_rag",
            system_instruction=system_instruction,
            user_parts=[{"text": user_payload}],
            temperature=0.4,
            timeout=12.0,
            user_id=user_id,
        )

        if res.get("ok") and res.get("text"):
            return {
                "answer": res["text"],
                "relevant_posts_count": len(posts_context),
                "model_used": self.model,
                "sources": sources,
                "guardrails": {
                    "question_injection_detected": question_check.detected,
                    "feed_injections_neutralized": post_injection_hits,
                },
            }

        return {
            "answer": "לא ניתן היה להשלים את שאילתת ה-RAG מול Gemini כרגע.",
            "error": res.get("error", "Unknown Gemini error"),
            "model_used": self.model,
            "sources": sources,
        }

    async def generate_chat_reply(
        self,
        sender: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        user_id: Optional[int] = None,
    ) -> str:
        """Generates realistic Hebrew chat responses using bounded history and XML sandboxing."""
        detect_prompt_injection(message or "")
        safe_message = redact_pii_text(message or "", record_metric=False)

        if not self.api_key:
            telemetry.record_llm_call(
                operation="chat_reply",
                model="mock-chat",
                latency_ms=0.1,
                status="success",
                fallback_used=True,
                user_id=user_id,
            )
            replies = [
                f"היי! ראיתי את ההודעה שלך ('{safe_message}'), מסכים לגמרי! מה התוכניות שלך להיום?",
                "אהבתי את הרעיון! בוא נריץ את זה יחד ב-SocialFlow 🔥",
                "תודה שכתבת לי! אני בודק את הפוסטים החדשים עכשיו, נראה מעולה 👍",
            ]
            return random.choice(replies)

        history_lines: List[str] = []
        if history:
            for turn in history[-6:]:
                if isinstance(turn, dict):
                    role = str(turn.get("role") or turn.get("sender") or "user")[:32]
                    content = str(turn.get("content") or turn.get("message") or "")[:300]
                    if content.strip():
                        history_lines.append(
                            wrap_untrusted_xml(
                                content, tag="untrusted_turn", attrs={"role": role}
                            )
                        )
        history_block = (
            f"היסטוריית שיחה אחרונה:\n<untrusted_history>\n"
            + "\n".join(history_lines)
            + "\n</untrusted_history>\n\n"
            if history_lines
            else ""
        )

        safe_sender = redact_pii_text((sender or "חבר")[:64], record_metric=False)
        system_instruction = (
            f'אתה מגלם חבר בשם "{safe_sender}" ברשת החברתית SocialFlow.\n'
            f"{DATA_ISOLATION_POLICY}\n"
            "ענה בהודעת צ'אט קצרה, חברית וזורמת בעברית (1-2 משפטים עם אימוג'י מתאים), "
            "כאילו אתה חבר אמיתי שמגיב ב-Messenger."
        )
        user_payload = (
            f"{history_block}"
            f"הודעה אחרונה מהמשתמש:\n"
            f"{wrap_untrusted_xml(message or '', tag='untrusted_message')}"
        )

        res = await self.generate_content(
            operation="chat_reply",
            system_instruction=system_instruction,
            user_parts=[{"text": user_payload}],
            temperature=0.8,
            timeout=10.0,
            user_id=user_id,
        )
        if res.get("ok") and res.get("text"):
            return res["text"].strip()

        log_structured(
            logging.WARNING,
            "chat_reply_fallback",
            error=res.get("error", "unknown"),
        )
        return "איזה יופי! מסכים איתך לגמרי 👍"


gemini_client = GeminiClient()
