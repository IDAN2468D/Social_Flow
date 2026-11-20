import asyncio
import json
import math
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.gemini_client as gemini_mod
import app.kafka_agent as kafka_mod
import app.main as main_mod
import app.rag_graph as rag_mod
import app.vector_store as vec_mod
from app.guardrails import rate_limiter
from app.telemetry import telemetry


@pytest.fixture(autouse=True)
def reset_rag_state():
    telemetry.reset()
    rate_limiter.reset()
    kafka_mod.kafka_enrichment_worker.reset_state()
    orig_key = gemini_mod.gemini_client.api_key
    orig_model = gemini_mod.gemini_client.model
    yield
    gemini_mod.gemini_client.set_api_key(orig_key)
    gemini_mod.gemini_client.model = orig_model
    rate_limiter.reset()


def test_l2_normalization_and_deterministic_mock_embedding():
    raw = [3.0, 4.0, 0.0]
    normed = vec_mod.l2_normalize(raw)
    assert math.isclose(normed[0], 0.6, rel_tol=1e-5)
    assert math.isclose(normed[1], 0.8, rel_tol=1e-5)
    assert math.isclose(sum(x * x for x in normed), 1.0, rel_tol=1e-5)

    emb_he = vec_mod.deterministic_mock_embedding("בינה מלאכותית וקפקא ב-SocialFlow")
    assert len(emb_he) == vec_mod.config.EMBEDDING_DIMS
    assert math.isclose(sum(x * x for x in emb_he), 1.0, rel_tol=1e-4)

    # Identical input yields identical vector
    assert emb_he == vec_mod.deterministic_mock_embedding("בינה מלאכותית וקפקא ב-SocialFlow")


def test_client_side_rrf_fusion_and_es8_basic_msearch_body():
    bm25_hits = [
        {"_id": "10", "_source": {"postId": 10, "authorUsername": "noa", "content": "Kafka only", "engagementScore": 5.0}},
        {"_id": "20", "_source": {"postId": 20, "authorUsername": "idan", "content": "Kafka + LangGraph", "engagementScore": 12.0}},
    ]
    knn_hits = [
        {"_id": "20", "_source": {"postId": 20, "authorUsername": "idan", "content": "Kafka + LangGraph", "engagementScore": 12.0}},
        {"_id": "30", "_source": {"postId": 30, "authorUsername": "maya", "content": "Vector semantic post", "engagementScore": 3.0}},
    ]

    fused = vec_mod.reciprocal_rank_fusion(bm25_hits, knn_hits, top_n=3)
    # Post #20 appears in both BM25 (#2) and kNN (#1), so it MUST rank #1 after RRF fusion
    assert [d["postId"] for d in fused] == [20, 10, 30]
    assert fused[0]["bm25_rank"] == 2
    assert fused[0]["knn_rank"] == 1
    assert fused[0]["rrf_score"] > fused[1]["rrf_score"]

    # Verify _msearch NDJSON never uses paid ES rank.rrf and filters out hidden/HIDDEN posts
    ndjson = vec_mod.build_hybrid_msearch_ndjson("קפקא", [0.1] * 768, size=10)
    assert "rank" not in ndjson or "rrf" not in ndjson
    assert '"knn"' in ndjson
    assert '"multi_match"' in ndjson
    assert '"hidden": true' in ndjson
    assert '"visibility": "HIDDEN"' in ndjson


def test_crag_relevance_grading_and_single_corrective_retry(monkeypatch):
    retrieve_calls = []

    async def fake_hybrid_search(query, top_k=10, user_id=None):
        retrieve_calls.append(query)
        if len(retrieve_calls) == 1:
            # First pass returns irrelevant doc -> grade_relevance triggers 1 corrective rewrite
            return (
                [{"postId": 1, "authorUsername": "bob", "content": "מתכון לפסטה ברוטב עגבניות"}],
                "hybrid_es_rrf",
            )
        # Second pass returns relevant doc
        return (
            [
                {
                    "postId": 77,
                    "authorUsername": "noa",
                    "content": "מדריך Elasticsearch וקטורי ו-Kafka ב-SocialFlow",
                    "rrf_score": 0.032,
                }
            ],
            "hybrid_es_rrf",
        )

    monkeypatch.setattr(rag_mod, "hybrid_search", fake_hybrid_search)

    res = asyncio.run(
        rag_mod.crag_ask_feed_graph.ainvoke(
            {
                "question": "איך עובד Elasticsearch ב-SocialFlow?",
                "user_id": 5,
                "authorization": None,
                "provided_posts": [],
                "feed_service_uri": "http://feed-service:8083",
                "search_query": "",
                "keywords": [],
                "retries": 0,
                "retrieved_posts": [],
                "relevant_posts": [],
                "retrieval_mode": "hybrid_es_rrf",
                "corrected": False,
                "answer": "",
                "citations": [],
                "sources": [],
                "model_used": "mock",
                "guardrails": {},
                "relevant_posts_count": 0,
            }
        )
    )

    assert len(retrieve_calls) == 2
    assert res["corrected"] is True
    assert res["retrieval_mode"] == "hybrid_es_rrf"
    assert "[Post #77]" in res["answer"]
    assert res["citations"][0]["postId"] == 77

    node_spans = telemetry.get_metrics()["langgraph_nodes"]
    assert "crag_ask_feed.plan_query" in node_spans
    assert "crag_ask_feed.hybrid_retrieve" in node_spans
    assert "crag_ask_feed.grade_relevance" in node_spans
    assert "crag_ask_feed.synthesize_cited_answer" in node_spans


def test_crag_es_unavailable_falls_back_to_feed_service_http(monkeypatch):
    async def es_down(query, top_k=10, user_id=None):
        return [], "es_unavailable"

    captured_urls = []

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            captured_urls.append(url)
            return FakeResponse(
                200,
                {
                    "content": [
                        {
                            "postId": 501,
                            "authorUsername": "daniel",
                            "content": "בנינו Kafka Outbox עם Spring Boot 3!",
                        }
                    ]
                },
            )

    monkeypatch.setattr(rag_mod, "hybrid_search", es_down)
    monkeypatch.setattr(rag_mod.httpx, "AsyncClient", FakeAsyncClient)

    client = TestClient(main_mod.app)
    res = client.post(
        "/api/v1/ai/ask-feed",
        json={"question": "מה חדש לגבי Kafka?"},
        headers={"X-User-Id": "19"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["retrieval_mode"] == "http_feed_fallback"
    assert "[Post #501]" in body["answer"]
    assert body["citations"][0]["postId"] == 501
    assert any("userId=19" in u for u in captured_urls)


def test_ask_feed_stream_sse_endpoint(monkeypatch):
    async def fake_hybrid(query, top_k=10, user_id=None):
        return (
            [
                {
                    "postId": 88,
                    "authorUsername": "maya",
                    "content": "LangGraph CRAG עובד מעולה עם Elasticsearch 8!",
                    "rrf_score": 0.031,
                }
            ],
            "hybrid_es_rrf",
        )

    monkeypatch.setattr(rag_mod, "hybrid_search", fake_hybrid)

    client = TestClient(main_mod.app)
    res = client.post(
        "/api/v1/ai/ask-feed/stream",
        json={"question": "מה אומרים על LangGraph?"},
        headers={"X-User-Id": "3"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    raw_sse = res.text
    assert "event: status" in raw_sse
    assert "event: retrieval" in raw_sse
    assert "event: token" in raw_sse
    assert "event: done" in raw_sse
    assert "Post #88" in raw_sse


def test_kafka_agent_upserts_768_dim_embedding_on_safe_enrichment(monkeypatch):
    published_kafka = []
    upserted_es = []

    async def fake_send(topic, key, payload):
        published_kafka.append((topic, key, payload))
        return True

    async def fake_es_post(url, json=None, **kwargs):
        upserted_es.append((url, json))

        class _OkRes:
            status_code = 200
            text = '{"result":"updated"}'

        return _OkRes()

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json=None, **kwargs):
            return await fake_es_post(url, json=json, **kwargs)

    monkeypatch.setattr(kafka_mod.kafka_producer_manager, "send", fake_send)
    monkeypatch.setattr(vec_mod.httpx, "AsyncClient", FakeAsyncClient)

    res = asyncio.run(
        kafka_mod.kafka_enrichment_worker.process_event(
            {
                "eventId": "evt-embed-901",
                "eventType": "POST_CREATED",
                "postId": 901,
                "authorId": 12,
                "authorUsername": "idan",
                "content": "חיפוש סמנטי בעברית עם Gemini ו-Elasticsearch 8!",
                "tags": ["בינה_מלאכותית"],
            }
        )
    )

    assert res["status"] == "processed"
    assert res["decision_event_type"] == "POST_ENRICHED"
    assert len(upserted_es) == 1
    es_url, es_body = upserted_es[0]
    assert es_url.endswith("/posts/_update/901")
    doc = es_body["doc"]
    assert len(doc["embedding"]) == 768
    assert math.isclose(sum(v * v for v in doc["embedding"]), 1.0, rel_tol=1e-4)
    assert doc["aiTags"]
