from typing import Callable, Optional, Dict, Any, List
from backend.config import get_settings
from backend.models.events import CommunicationEvent, ModalitySource
from backend.fusion.engine import InputFusionEngine
from backend.llm.engine import ContextLLMEngine
from backend.vision.gesture import classify_hand_gesture

class AssistantOrchestrator:
    def __init__(
        self,
        on_broadcast: Optional[Callable[[str, Dict[str, Any]], None]] = None,
        llm_engine: Optional[ContextLLMEngine] = None
    ):
        settings = get_settings()
        self.settings = settings
        self.on_broadcast = on_broadcast
        self.fusion = InputFusionEngine(
            confidence_threshold=settings.confidence_threshold,
            cooldown_seconds=settings.cooldown_seconds
        )
        self.llm = llm_engine or ContextLLMEngine(api_key=settings.gemini_api_key)

    def set_meeting_context(self, snippet: str) -> None:
        self.llm.add_meeting_context(snippet)

    def process_hand_landmarks(self, landmarks: List[Dict[str, float]]) -> Optional[str]:
        result = classify_hand_gesture(landmarks)
        if not result:
            return None
        intent, confidence = result
        return self.process_intent(ModalitySource.GESTURE, intent, confidence)

    def process_intent(self, source: ModalitySource, intent: str, confidence: float = 0.95) -> Optional[str]:
        event = self.fusion.process_event(source, intent, confidence)
        if not event:
            return None

        normalized_message = self.llm.normalize_intent(event)

        if self.on_broadcast:
            self.on_broadcast("message_staged", {
                "event": event.model_dump(),
                "normalized_text": normalized_message,
                "source": source.value,
                "intent": intent,
                "confidence": confidence
            })

        return normalized_message
