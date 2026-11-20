import os
from pydantic import BaseModel


def _parse_bool(value: str, default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _parse_int(value: str, default: int) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


class Config(BaseModel):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    EMBEDDING_DIMS: int = _parse_int(os.getenv("EMBEDDING_DIMS", "768"), 768)
    ELASTICSEARCH_URI: str = os.getenv("ELASTICSEARCH_URI", "http://elasticsearch:9200").rstrip("/")
    ELASTICSEARCH_POSTS_INDEX: str = os.getenv("ELASTICSEARCH_POSTS_INDEX", "posts")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9095")
    KAFKA_AUTO_STARTUP: bool = _parse_bool(os.getenv("KAFKA_AUTO_STARTUP", "false"), False)
    KAFKA_CONSUMER_GROUP: str = os.getenv("KAFKA_CONSUMER_GROUP", "ai-enrichment-group")
    POST_EVENTS_TOPIC: str = os.getenv("POST_EVENTS_TOPIC", "post-events")
    AI_ENRICHMENT_TOPIC: str = os.getenv("AI_ENRICHMENT_TOPIC", "ai-enrichment-events")
    AI_ENRICHMENT_DLQ_TOPIC: str = os.getenv("AI_ENRICHMENT_DLQ_TOPIC", "ai-enrichment-dlq")
    AI_KAFKA_MAX_CONCURRENCY: int = _parse_int(os.getenv("AI_KAFKA_MAX_CONCURRENCY", "2"), 2)
    CORS_ALLOWED_ORIGINS: str = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:8088,http://localhost:3000",
    )
    AI_RATE_LIMIT_RPM_USER: int = _parse_int(os.getenv("AI_RATE_LIMIT_RPM_USER", "60"), 60)
    AI_RATE_LIMIT_RPM_ADMIN: int = _parse_int(os.getenv("AI_RATE_LIMIT_RPM_ADMIN", "300"), 300)
    AI_MAX_TRACES: int = _parse_int(os.getenv("AI_MAX_TRACES", "200"), 200)
    AI_PII_REDACTION_ENABLED: bool = _parse_bool(os.getenv("AI_PII_REDACTION_ENABLED", "true"), True)


config = Config()
