import time
from typing import Dict, Optional
from backend.models.events import CommunicationEvent, ModalitySource
from backend.models.commands import get_command_by_intent

class InputFusionEngine:
    def __init__(self, confidence_threshold: float = 0.70, cooldown_seconds: float = 1.5):
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self.last_emitted_timestamps: Dict[str, float] = {}
        self.recent_inputs: Dict[ModalitySource, Dict[str, float]] = {}

    def process_event(
        self,
        source: ModalitySource,
        intent: str,
        confidence: float,
        raw_text_override: str | None = None,
    ) -> Optional[CommunicationEvent]:
        if confidence < self.confidence_threshold:
            return None

        now = time.time()
        last_time = self.last_emitted_timestamps.get(intent, 0.0)
        if (now - last_time) < self.cooldown_seconds:
            return None

        self.last_emitted_timestamps[intent] = now
        cmd = get_command_by_intent(intent)
        raw_text = (
            raw_text_override
            if cmd and raw_text_override and raw_text_override.strip()
            else (cmd.default_text if cmd else intent)
        )

        return CommunicationEvent(
            source=source,
            intent=intent,
            raw_text=raw_text,
            confidence=confidence,
            timestamp=now
        )

    def record_input(self, source: ModalitySource, intent: str, confidence: float) -> None:
        self.recent_inputs[source] = {"intent": intent, "confidence": confidence, "time": time.time()}

    def resolve_fused_intent(self) -> Optional[str]:
        # If user raised hand + mouthed question -> intent is QUESTION
        gesture = self.recent_inputs.get(ModalitySource.GESTURE)
        lip = self.recent_inputs.get(ModalitySource.LIP)

        if gesture and lip:
            if gesture["intent"] == "REQUEST_TO_SPEAK" and lip["intent"] == "QUESTION":
                return "QUESTION"
        if lip:
            return lip["intent"]
        if gesture:
            return gesture["intent"]
        return None
