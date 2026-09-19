import time
import uuid
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class ModalitySource(str, Enum):
    SPEECH = "speech"
    LIP = "lip"
    GESTURE = "gesture"
    SYSTEM = "system"

class CommunicationEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    type: str = "communication_event"
    source: ModalitySource
    intent: str
    raw_text: str
    confidence: float
    timestamp: float = Field(default_factory=time.time)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WebSocketEnvelope(BaseModel):
    event: str
    data: Dict[str, Any]
    timestamp: float = Field(default_factory=time.time)
