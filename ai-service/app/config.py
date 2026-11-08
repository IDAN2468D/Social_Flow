import os
from pydantic import BaseModel

class Config(BaseModel):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9095")
    POST_EVENTS_TOPIC: str = os.getenv("POST_EVENTS_TOPIC", "post-events")
    AI_ENRICHMENT_TOPIC: str = os.getenv("AI_ENRICHMENT_TOPIC", "ai-enrichment-events")

config = Config()
