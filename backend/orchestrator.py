import threading
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

        # PHASE 1: Immediate zero-latency broadcast with base text
        base_text = event.raw_text
        if self.on_broadcast:
            self.on_broadcast("message_staged", {
                "event": event.model_dump(),
                "normalized_text": base_text,
                "source": source.value,
                "intent": intent,
                "confidence": confidence,
                "is_refined": False
            })

        # PHASE 2: Background Gemini LLM refinement
        def _refine():
            try:
                refined_text = self.llm.normalize_intent(event)
                if refined_text and refined_text != base_text and self.on_broadcast:
                    self.on_broadcast("message_refined", {
                        "event_id": event.id,
                        "refined_text": refined_text
                    })
            except Exception:
                pass

        threading.Thread(target=_refine, daemon=True).start()

        return base_text
