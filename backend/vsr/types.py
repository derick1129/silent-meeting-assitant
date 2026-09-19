from typing import Protocol

from pydantic import BaseModel


class VSRPrediction(BaseModel):
    text: str
    intent: str | None = None
    confidence: float
    latency_ms: float
    model_id: str


class VSRProvider(Protocol):
    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        ...
