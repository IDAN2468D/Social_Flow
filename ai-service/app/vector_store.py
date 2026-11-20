"""
SocialFlow Hybrid Vector + BM25 Search & Embedding Store (ES 8.13 Basic Compatible).
- Generates 768-dim L2-normalized embeddings via Gemini `gemini-embedding-001`
  (with deterministic hash-vector fallback when GEMINI_API_KEY is absent).
- Executes BM25 multi_match + dense_vector kNN via Elasticsearch 8.13 `_msearch`
  and fuses results with client-side Reciprocal Rank Fusion (RRF), avoiding paid ES rank.rrf.
- Supports best-effort embedding upsert into the `posts` index for newly enriched posts.
"""

import hashlib
import json
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import config
from app.guardrails import redact_pii_text
from app.telemetry import log_structured, telemetry

RRF_K = 60


def l2_normalize(vector: List[float]) -> List[float]:
    if not vector:
        return []
    norm = math.sqrt(sum(float(x) * float(x) for x in vector))
    if norm <= 1e-12:
        return [0.0 for _ in vector]
    return [round(float(x) / norm, 8) for x in vector]


def deterministic_mock_embedding(text: str, dims: Optional[int] = None) -> List[float]:
    """Produces a reproducible L2-normalized vector when GEMINI_API_KEY is not configured."""
    target_dims = dims or config.EMBEDDING_DIMS
    clean = (text or "").strip().lower()
    if not clean:
        vec = [0.0] * target_dims
        vec[0] = 1.0
        return vec

    vec = [0.0] * target_dims
    tokens = [tok for tok in clean.split() if tok]
    if not tokens:
        tokens = [clean]
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        for offset in range(0, len(digest), 4):
            idx = int.from_bytes(digest[offset : offset + 2], "big") % target_dims
            sign = 1.0 if (digest[offset + 2] & 1) == 0 else -1.0
            weight = 1.0 + (digest[offset + 3] / 255.0)
            vec[idx] += sign * weight
    return l2_normalize(vec)


async def embed_text(
    text: str,
    *,
    task_type: str = "RETRIEVAL_DOCUMENT",
    user_id: Optional[int] = None,
) -> List[float]:
    """
    Generates a 768-dim L2-normalized embedding using Gemini `gemini-embedding-001`
    with deterministic offline fallback.
    """
    clean_text = redact_pii_text((text or "").strip()[:4000], record_metric=False)
    dims = config.EMBEDDING_DIMS

    if not config.GEMINI_API_KEY:
        telemetry.record_llm_call(
            operation="embed_text",
            model="mock-embedding",
            latency_ms=0.1,
            status="success",
            fallback_used=True,
            user_id=user_id,
        )
        return deterministic_mock_embedding(clean_text, dims=dims)

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{config.GEMINI_EMBEDDING_MODEL}:embedContent?key={config.GEMINI_API_KEY}"
    )
    payload: Dict[str, Any] = {
        "model": f"models/{config.GEMINI_EMBEDDING_MODEL}",
        "content": {"parts": [{"text": clean_text or "SocialFlow post"}]},
        "taskType": task_type,
        "outputDimensionality": dims,
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
        latency_ms = (time.perf_counter() - started) * 1000.0
        if res.status_code == 200:
            data = res.json()
            values = ((data.get("embedding") or {}).get("values")) or []
            if values:
                telemetry.record_llm_call(
                    operation="embed_text",
                    model=config.GEMINI_EMBEDDING_MODEL,
                    latency_ms=latency_ms,
                    input_tokens=max(1, len(clean_text.split())),
                    status="success",
                    user_id=user_id,
                )
                return l2_normalize([float(v) for v in values[:dims]])

        telemetry.record_llm_call(
            operation="embed_text",
            model=config.GEMINI_EMBEDDING_MODEL,
            latency_ms=latency_ms,
            status="error",
            fallback_used=True,
            error_type=f"HTTP_{res.status_code}",
            error_message=res.text[:200],
            user_id=user_id,
        )
    except Exception as exc:
        latency_ms = (time.perf_counter() - started) * 1000.0
        telemetry.record_llm_call(
            operation="embed_text",
            model=config.GEMINI_EMBEDDING_MODEL,
            latency_ms=latency_ms,
            status="error",
            fallback_used=True,
            error_type=type(exc).__name__,
            error_message=redact_pii_text(str(exc), record_metric=False),
            user_id=user_id,
        )
    return deterministic_mock_embedding(clean_text, dims=dims)


def reciprocal_rank_fusion(
    bm25_hits: List[Dict[str, Any]],
    knn_hits: List[Dict[str, Any]],
    *,
    k: int = RRF_K,
    top_n: int = 12,
) -> List[Dict[str, Any]]:
    """
    Client-side Reciprocal Rank Fusion (RRF) for ES 8.13 Basic compatibility:
        rrf_score(doc) = sum(1.0 / (k + rank_1_based))
    Preserves document payload and attaches `rrf_score`, `bm25_rank`, and `knn_rank`.
    """
    fused: Dict[str, Dict[str, Any]] = {}

    def _doc_key(hit: Dict[str, Any]) -> str:
        src = hit.get("_source") if isinstance(hit.get("_source"), dict) else hit
        post_id = src.get("postId") or src.get("id") or hit.get("_id")
        return str(post_id)

    def _normalize_doc(hit: Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(hit.get("_source"), dict):
            doc = dict(hit["_source"])
            if "id" not in doc and hit.get("_id") is not None:
                doc["id"] = hit["_id"]
            if "postId" not in doc and hit.get("_id") is not None:
                try:
                    doc["postId"] = int(hit["_id"])
                except (TypeError, ValueError):
                    pass
            return doc
        return dict(hit)

    for rank, hit in enumerate(bm25_hits, start=1):
        key = _doc_key(hit)
        entry = fused.setdefault(
            key,
            {"doc": _normalize_doc(hit), "rrf_score": 0.0, "bm25_rank": None, "knn_rank": None},
        )
        entry["rrf_score"] += 1.0 / (k + rank)
        entry["bm25_rank"] = rank

    for rank, hit in enumerate(knn_hits, start=1):
        key = _doc_key(hit)
        entry = fused.setdefault(
            key,
            {"doc": _normalize_doc(hit), "rrf_score": 0.0, "bm25_rank": None, "knn_rank": None},
        )
        entry["rrf_score"] += 1.0 / (k + rank)
        entry["knn_rank"] = rank

    ranked = sorted(
        fused.values(),
        key=lambda item: (
            item["rrf_score"],
            1 if (item["bm25_rank"] is not None and item["knn_rank"] is not None) else 0,
            float(item["doc"].get("engagementScore") or 0.0),
        ),
        reverse=True,
    )

    results: List[Dict[str, Any]] = []
    for item in ranked[:top_n]:
        doc = dict(item["doc"])
        doc["rrf_score"] = round(item["rrf_score"], 6)
        doc["bm25_rank"] = item["bm25_rank"]
        doc["knn_rank"] = item["knn_rank"]
        results.append(doc)
    return results


def _visibility_filter_clauses() -> List[Dict[str, Any]]:
    return [
        {"bool": {"must_not": [{"term": {"hidden": True}}, {"term": {"visibility": "HIDDEN"}}]}}
    ]


def build_hybrid_msearch_ndjson(
    query: str,
    query_vector: List[float],
    *,
    size: int = 12,
    index_name: Optional[str] = None,
) -> str:
    """Builds an ES 8.13 Basic compatible `_msearch` NDJSON body (BM25 + kNN)."""
    idx = index_name or config.ELASTICSEARCH_POSTS_INDEX
    header = json.dumps({"index": idx})
    filter_clauses = _visibility_filter_clauses()

    bm25_body = {
        "size": size,
        "_source": {"excludes": ["embedding"]},
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": [
                                "content^2",
                                "aiSummary^1.5",
                                "tags^1.5",
                                "aiTags^1.5",
                                "authorUsername",
                            ],
                            "fuzziness": "AUTO",
                            "operator": "or",
                        }
                    }
                ],
                "filter": filter_clauses,
            }
        },
    }

    knn_body = {
        "size": size,
        "_source": {"excludes": ["embedding"]},
        "knn": {
            "field": "embedding",
            "query_vector": query_vector,
            "k": size,
            "num_candidates": max(30, size * 4),
            "filter": {"bool": {"filter": filter_clauses}},
        },
    }

    return "\n".join([header, json.dumps(bm25_body), header, json.dumps(knn_body), ""])


async def hybrid_search(
    query: str,
    *,
    top_k: int = 10,
    user_id: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Executes ES 8.13 `_msearch` (BM25 + kNN) and merges with client-side RRF.
    Returns (docs, status) where status is 'hybrid_es_rrf' or 'es_unavailable'.
    """
    clean_query = (query or "").strip()
    if not clean_query:
        return [], "empty_query"

    query_vector = await embed_text(
        clean_query, task_type="RETRIEVAL_QUERY", user_id=user_id
    )
    ndjson_body = build_hybrid_msearch_ndjson(
        clean_query, query_vector, size=max(top_k, 10)
    )
    url = f"{config.ELASTICSEARCH_URI}/_msearch"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.post(
                url,
                content=ndjson_body,
                headers={"Content-Type": "application/x-ndjson"},
            )
        if res.status_code != 200:
            log_structured(
                logging.WARNING,
                "es_hybrid_msearch_non_200",
                status_code=res.status_code,
                body=res.text[:200],
            )
            return [], "es_unavailable"

        responses = res.json().get("responses") or []
        bm25_hits = (
            ((responses[0].get("hits") or {}).get("hits") or [])
            if len(responses) > 0 and "error" not in responses[0]
            else []
        )
        knn_hits = (
            ((responses[1].get("hits") or {}).get("hits") or [])
            if len(responses) > 1 and "error" not in responses[1]
            else []
        )
        fused = reciprocal_rank_fusion(bm25_hits, knn_hits, top_n=top_k)
        return fused, "hybrid_es_rrf"
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "es_hybrid_msearch_failed",
            error=redact_pii_text(str(exc), record_metric=False),
        )
        return [], "es_unavailable"


async def upsert_post_embedding(
    *,
    post_id: int,
    content: str,
    tags: Optional[List[str]] = None,
    ai_tags: Optional[List[str]] = None,
    ai_summary: Optional[str] = None,
    author_id: Optional[int] = None,
    author_username: Optional[str] = None,
    index_name: Optional[str] = None,
) -> bool:
    """
    Best-effort upsert of a 768-dim L2-normalized embedding onto an existing
    Elasticsearch `posts` document (non-fatal if ES is unreachable).
    """
    combined_tags = [str(t).strip() for t in (list(tags or []) + list(ai_tags or [])) if str(t).strip()]
    embed_parts = [content or ""]
    if ai_summary:
        embed_parts.append(ai_summary)
    if combined_tags:
        embed_parts.append(" ".join(combined_tags))
    text_to_embed = "\n".join(p for p in embed_parts if p.strip())

    vector = await embed_text(
        text_to_embed, task_type="RETRIEVAL_DOCUMENT", user_id=author_id
    )
    if not vector:
        return False

    idx = index_name or config.ELASTICSEARCH_POSTS_INDEX
    url = f"{config.ELASTICSEARCH_URI}/{idx}/_update/{post_id}"
    doc_fields: Dict[str, Any] = {
        "postId": post_id,
        "embedding": vector,
    }
    if content:
        doc_fields["content"] = content
    if author_id is not None:
        doc_fields["authorId"] = author_id
    if author_username:
        doc_fields["authorUsername"] = author_username
    if ai_tags:
        doc_fields["aiTags"] = ai_tags
    if ai_summary:
        doc_fields["aiSummary"] = ai_summary

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post(
                url,
                json={"doc": doc_fields, "doc_as_upsert": True},
            )
        if res.status_code in (200, 201):
            return True
        log_structured(
            logging.WARNING,
            "es_embedding_upsert_non_2xx",
            post_id=post_id,
            status_code=res.status_code,
            body=res.text[:200],
        )
        return False
    except Exception as exc:
        log_structured(
            logging.WARNING,
            "es_embedding_upsert_failed",
            post_id=post_id,
            error=redact_pii_text(str(exc), record_metric=False),
        )
        return False
