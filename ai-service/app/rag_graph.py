"""
SocialFlow Corrective RAG (`ask-feed` 2.0) LangGraph Workflow.
4-node CRAG pipeline:
  1. plan_query: extracts search keywords / query plan
  2. hybrid_retrieve: ES 8.13 BM25 + kNN with client-side RRF (falls back to feed-service HTTP)
  3. grade_relevance: scores retrieved docs; triggers max 1 corrective rewrite & retry if sparse
  4. synthesize_cited_answer: generates grounded Hebrew/English answer with [Post #ID] citations
"""

import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Set, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from app.gemini_client import gemini_client
from app.guardrails import (
    DATA_ISOLATION_POLICY,
    detect_prompt_injection,
    redact_pii_text,
    sanitize_posts_for_prompt,
    wrap_untrusted_xml,
)
from app.telemetry import get_correlation_id, log_structured, telemetry
from app.vector_store import hybrid_search

_STOPWORDS: Set[str] = {
    "מה",
    "על",
    "של",
    "את",
    "איך",
    "למה",
    "מי",
    "עם",
    "האם",
    "כי",
    "או",
    "בפיד",
    "בסושיאלפלואו",
    "what",
    "about",
    "the",
    "is",
    "are",
    "in",
    "on",
    "for",
    "to",
    "of",
    "and",
    "or",
    "how",
    "why",
    "who",
    "posts",
    "feed",
    "socialflow",
}


class QueryPlanOutput(BaseModel):
    search_query: str = Field(min_length=1, max_length=300)
    keywords: List[str] = Field(default_factory=list, max_length=8)


class CragState(TypedDict):
    question: str
    user_id: int
    authorization: Optional[str]
    provided_posts: List[Dict[str, Any]]
    feed_service_uri: str
    search_query: str
    keywords: List[str]
    retries: int
    should_retry: bool
    retrieved_posts: List[Dict[str, Any]]
    relevant_posts: List[Dict[str, Any]]
    retrieval_mode: str
    corrected: bool
    answer: str
    citations: List[Dict[str, Any]]
    sources: List[Any]
    model_used: str
    guardrails: Dict[str, Any]
    relevant_posts_count: int


def _extract_keywords(text: str) -> List[str]:
    tokens = re.findall(r"[\w\u0590-\u05FF-]+", (text or "").lower())
    seen: Set[str] = set()
    keywords: List[str] = []
    for tok in tokens:
        clean = tok.strip("-_")
        if len(clean) >= 2 and clean not in _STOPWORDS and clean not in seen:
            seen.add(clean)
            keywords.append(clean)
    return keywords[:8]


def _score_doc_relevance(doc: Dict[str, Any], keywords: List[str]) -> float:
    content = str(doc.get("content") or "").lower()
    summary = str(doc.get("aiSummary") or "").lower()
    tags = " ".join(str(t).lower() for t in (doc.get("tags") or []) + (doc.get("aiTags") or []))
    haystack = f"{content} {summary} {tags}"
    if not haystack.strip():
        return 0.0

    rrf = float(doc.get("rrf_score") or 0.0)
    if not keywords:
        return 0.5 + rrf

    hits = sum(1 for kw in keywords if kw in haystack)
    lexical_ratio = hits / max(1, len(keywords))
    # Strong semantic kNN match (e.g., top-ranked kNN hit) also gets base semantic credit
    knn_credit = 0.35 if doc.get("knn_rank") is not None and int(doc["knn_rank"]) <= 5 else 0.0
    return round(lexical_ratio + knn_credit + (rrf * 10.0), 4)


async def _fetch_feed_fallback_posts(
    *,
    feed_uri: str,
    user_id: int,
    authorization: Optional[str],
    search_query: str = "",
) -> List[Dict[str, Any]]:
    headers = {"Authorization": authorization} if authorization else {}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-Id"] = cid

    urls = [f"{feed_uri}/api/v1/feed/for-you?userId={user_id}&page=0&size=20"]
    if search_query.strip():
        urls.insert(0, f"{feed_uri}/api/v1/search?q={search_query.strip()}&page=0&size=15")

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            for url in urls:
                try:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        items = data.get("content", []) if isinstance(data, dict) else data
                        if isinstance(items, list) and items:
                            return items
                except Exception as req_exc:
                    log_structured(
                        logging.WARNING,
                        "crag_http_fallback_url_failed",
                        url=url,
                        error=redact_pii_text(str(req_exc), record_metric=False),
                    )
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "crag_http_fallback_failed",
            error=redact_pii_text(str(exc), record_metric=False),
        )
    return []


async def plan_query_node(state: CragState) -> Dict[str, Any]:
    """Node 1: Extracts search keywords and plans the initial retrieval query."""
    started = time.perf_counter()
    question = (state.get("question") or "").strip()
    keywords = _extract_keywords(question)
    search_query = " ".join(keywords) if keywords else question

    if gemini_client.api_key and question:
        system_instruction = (
            "Extract concise search terms (in the original Hebrew/English language) "
            "from the question inside <untrusted_question> for searching a social media feed.\n"
            f"{DATA_ISOLATION_POLICY}\n"
            'Return ONLY JSON: {"search_query": "...", "keywords": ["..."]}.'
        )
        validated, _, _ = await gemini_client.generate_structured_json(
            operation="crag_plan_query",
            system_instruction=system_instruction,
            user_text=wrap_untrusted_xml(question, tag="untrusted_question"),
            schema=QueryPlanOutput,
            temperature=0.1,
            timeout=6.0,
            user_id=state.get("user_id"),
        )
        if validated is not None:
            search_query = validated.search_query
            if validated.keywords:
                keywords = [k.lower() for k in validated.keywords]

    telemetry.record_node_span(
        graph_name="crag_ask_feed",
        node_name="plan_query",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="success",
        user_id=state.get("user_id"),
    )
    return {
        "search_query": search_query or question,
        "keywords": keywords,
    }


async def hybrid_retrieve_node(state: CragState) -> Dict[str, Any]:
    """
    Node 2: Retrieves candidate posts using:
      - caller-supplied `posts` if provided
      - else ES 8.13 hybrid BM25 + kNN (_msearch + client-side RRF)
      - else HTTP fallback to feed-service `/api/v1/feed/for-you`
    """
    started = time.perf_counter()
    provided = state.get("provided_posts") or []
    if provided and state.get("retries", 0) == 0:
        telemetry.record_node_span(
            graph_name="crag_ask_feed",
            node_name="hybrid_retrieve",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            status="success",
            user_id=state.get("user_id"),
        )
        return {
            "retrieved_posts": provided,
            "retrieval_mode": "provided_context",
        }

    query = state.get("search_query") or state.get("question") or ""
    docs, es_status = await hybrid_search(
        query, top_k=12, user_id=state.get("user_id")
    )
    if es_status == "hybrid_es_rrf" and docs:
        telemetry.record_node_span(
            graph_name="crag_ask_feed",
            node_name="hybrid_retrieve",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            status="success",
            user_id=state.get("user_id"),
        )
        return {
            "retrieved_posts": docs,
            "retrieval_mode": "hybrid_es_rrf",
        }

    # Graceful HTTP fallback when ES is offline or has no hits yet
    fallback_posts = await _fetch_feed_fallback_posts(
        feed_uri=state.get("feed_service_uri") or "http://feed-service:8083",
        user_id=state.get("user_id", 1),
        authorization=state.get("authorization"),
        search_query=query if state.get("retries", 0) > 0 else "",
    )
    mode = "http_feed_fallback" if es_status == "es_unavailable" else "hybrid_es_rrf_empty_fallback"
    telemetry.record_node_span(
        graph_name="crag_ask_feed",
        node_name="hybrid_retrieve",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="fallback" if es_status == "es_unavailable" else "success",
        user_id=state.get("user_id"),
    )
    return {
        "retrieved_posts": fallback_posts,
        "retrieval_mode": mode,
    }


async def grade_relevance_node(state: CragState) -> Dict[str, Any]:
    """
    Node 3: Grades retrieved docs for relevance.
    If fewer than 1 strong match and retries < 1, triggers 1 corrective query rewrite.
    """
    started = time.perf_counter()
    retrieved = state.get("retrieved_posts") or []
    keywords = state.get("keywords") or _extract_keywords(state.get("question") or "")
    retries = int(state.get("retries") or 0)

    scored: List[tuple[float, Dict[str, Any]]] = []
    for doc in retrieved:
        if doc.get("hidden") is True or str(doc.get("visibility") or "").upper() == "HIDDEN":
            continue
        score = _score_doc_relevance(doc, keywords)
        if score >= 0.25 or not keywords:
            scored.append((score, doc))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    relevant = [doc for _, doc in scored[:10]]

    needs_retry = len(relevant) == 0 and retries < 1 and not (state.get("provided_posts") or [])
    new_query = state.get("search_query", "")
    new_retries = retries
    corrected = bool(state.get("corrected", False))

    if needs_retry:
        # Broaden query with original question + relax keyword filter on corrective pass
        new_retries = retries + 1
        corrected = True
        raw_q = (state.get("question") or "").strip()
        broad_tokens = _extract_keywords(raw_q)
        new_query = broad_tokens[0] if len(broad_tokens) > 1 else raw_q

    telemetry.record_node_span(
        graph_name="crag_ask_feed",
        node_name="grade_relevance",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="retry" if needs_retry else "success",
        user_id=state.get("user_id"),
    )
    return {
        "relevant_posts": relevant if relevant else retrieved[:5],
        "search_query": new_query,
        "retries": new_retries,
        "corrected": corrected,
    }


def route_after_grading(state: CragState) -> str:
    """Routes back to `hybrid_retrieve` at most once when corrective rewrite occurred."""
    if state.get("corrected") and int(state.get("retries") or 0) == 1 and not state.get("_retried_done", False):
        # If relevant_posts came only from fallback slice and we haven't retrieved on retry yet,
        # compare whether grade_relevance just bumped retries.
        pass
    if int(state.get("retries") or 0) == 1 and state.get("corrected") and not state.get("answer"):
        # Only loop if we haven't already run the second retrieval
        return "hybrid_retrieve"
    return "synthesize_cited_answer"


# Track retry cleanly in state so conditional edge never loops twice
async def grade_relevance_with_flag_node(state: CragState) -> Dict[str, Any]:
    started = time.perf_counter()
    retrieved = state.get("retrieved_posts") or []
    keywords = state.get("keywords") or _extract_keywords(state.get("question") or "")
    retries = int(state.get("retries") or 0)

    scored: List[tuple[float, Dict[str, Any]]] = []
    for doc in retrieved:
        if doc.get("hidden") is True or str(doc.get("visibility") or "").upper() == "HIDDEN":
            continue
        score = _score_doc_relevance(doc, keywords)
        if score >= 0.25 or not keywords:
            scored.append((score, doc))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    relevant = [doc for _, doc in scored[:10]]

    should_retry = (
        len(relevant) == 0
        and retries < 1
        and not (state.get("provided_posts") or [])
    )

    new_query = state.get("search_query", "")
    corrected = bool(state.get("corrected", False))
    new_retries = retries

    if should_retry:
        new_retries = 1
        corrected = True
        raw_q = (state.get("question") or "").strip()
        broad_tokens = _extract_keywords(raw_q)
        new_query = broad_tokens[0] if broad_tokens else raw_q

    telemetry.record_node_span(
        graph_name="crag_ask_feed",
        node_name="grade_relevance",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="retry" if should_retry else "success",
        user_id=state.get("user_id"),
    )
    return {
        "relevant_posts": relevant if (relevant or not should_retry) else [],
        "search_query": new_query,
        "retries": new_retries,
        "corrected": corrected,
        "should_retry": should_retry,
    }


def route_after_grade(state: CragState) -> str:
    if state.get("should_retry", False):
        return "hybrid_retrieve"
    return "synthesize_cited_answer"


async def synthesize_cited_answer_node(state: CragState) -> Dict[str, Any]:
    """Node 4: Synthesizes grounded answer with inline [Post #ID] citations."""
    started = time.perf_counter()
    question = state.get("question") or ""
    posts = state.get("relevant_posts") or state.get("retrieved_posts") or []

    question_check = detect_prompt_injection(question)
    feed_xml, post_injection_hits = sanitize_posts_for_prompt(posts, max_posts=12)
    question_xml = wrap_untrusted_xml(question, tag="untrusted_question")

    citations: List[Dict[str, Any]] = []
    sources: List[Any] = []
    for idx, p in enumerate(posts[:5]):
        pid = p.get("postId") or p.get("id") or (idx + 1)
        author = p.get("authorUsername") or "משתמש"
        snippet = redact_pii_text(str(p.get("content") or "")[:120], record_metric=False)
        sources.append(pid)
        citations.append(
            {
                "postId": pid,
                "authorUsername": author,
                "snippet": snippet,
                "rrfScore": p.get("rrf_score"),
            }
        )

    guardrails_meta = {
        "question_injection_detected": question_check.detected,
        "feed_injections_neutralized": post_injection_hits,
    }

    if not posts:
        answer = (
            "לא נמצאו פוסטים רלוונטיים בפיד של SocialFlow שעונים ישירות על השאלה שלך כרגע. "
            "נסה לשאול על נושא אחר או לפרסם פוסט חדש כדי לפתוח דיון!"
        )
        model_used = gemini_client.model if gemini_client.api_key else "mock-crag"
    elif not gemini_client.api_key:
        telemetry.record_llm_call(
            operation="crag_synthesize",
            model="mock-crag",
            latency_ms=0.1,
            status="success",
            fallback_used=True,
            user_id=state.get("user_id"),
        )
        top_refs = ", ".join(f"[Post #{c['postId']}] (@{c['authorUsername']})" for c in citations[:3])
        answer = (
            f"על פי ניתוח הפוסטים הרלוונטיים בפיד ({top_refs}):\n"
            f"הקהילה ב-SocialFlow דנה בנושאים הקשורים לשאלתך, כולל: "
            f"{citations[0]['snippet']}"
        )
        model_used = "mock-crag (Provide GEMINI_API_KEY for live Gemini 3.5 Flash-Lite)"
    else:
        system_instruction = (
            "אתה מנוע ה-Corrective RAG החכם של הרשת החברתית SocialFlow.\n"
            f"{DATA_ISOLATION_POLICY}\n"
            "ענה בעברית רהוטה וטבעית, בהתבסס אך ורק על הפוסטים שבתוך <untrusted_post>.\n"
            "כל טענה מהפיד חייבת לכלול ציטוט בפורמט [Post #ID] (למשל [Post #42]).\n"
            "אם הפוסטים אינם עונים על השאלה, ציין זאת בבירור ואל תמציא עובדות."
        )
        user_payload = (
            f"פוסטים מאומתים מהפיד:\n<untrusted_feed>\n{feed_xml}\n</untrusted_feed>\n\n"
            f"שאלת המשתמש:\n{question_xml}"
        )
        res = await gemini_client.generate_content(
            operation="crag_synthesize",
            system_instruction=system_instruction,
            user_parts=[{"text": user_payload}],
            temperature=0.3,
            timeout=12.0,
            user_id=state.get("user_id"),
        )
        if res.get("ok") and res.get("text"):
            answer = res["text"]
            model_used = gemini_client.model
        else:
            answer = "לא ניתן היה להשלים את שאילתת ה-RAG מול Gemini כרגע."
            model_used = gemini_client.model

    telemetry.record_node_span(
        graph_name="crag_ask_feed",
        node_name="synthesize_cited_answer",
        latency_ms=(time.perf_counter() - started) * 1000.0,
        status="success",
        user_id=state.get("user_id"),
    )
    return {
        "answer": answer,
        "citations": citations,
        "sources": sources[:4],
        "model_used": model_used,
        "guardrails": guardrails_meta,
        "relevant_posts_count": len(posts),
    }


def create_crag_graph():
    builder = StateGraph(CragState)
    builder.add_node("plan_query", plan_query_node)
    builder.add_node("hybrid_retrieve", hybrid_retrieve_node)
    builder.add_node("grade_relevance", grade_relevance_with_flag_node)
    builder.add_node("synthesize_cited_answer", synthesize_cited_answer_node)

    builder.add_edge(START, "plan_query")
    builder.add_edge("plan_query", "hybrid_retrieve")
    builder.add_edge("hybrid_retrieve", "grade_relevance")
    builder.add_conditional_edges(
        "grade_relevance",
        route_after_grade,
        {
            "hybrid_retrieve": "hybrid_retrieve",
            "synthesize_cited_answer": "synthesize_cited_answer",
        },
    )
    builder.add_edge("synthesize_cited_answer", END)
    return builder.compile()


crag_ask_feed_graph = create_crag_graph()
