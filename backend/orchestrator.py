import threading
from typing import Callable, Optional, Dict, Any, List
from backend.config import get_settings
from backend.models.events import CommunicationEvent, ModalitySource
from backend.fusion.engine import InputFusionEngine
from backend.llm.engine import ContextLLMEngine
from backend.vision.gesture import classify_hand_gesture
from backend.vision.lips import extract_lip_features, LipSequenceBuffer
from backend.ml.lip_model import LipGRUModel, VOCABULARY_CLASSES, predict_lip_intent
import os
import torch

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

        self.lip_buffer = LipSequenceBuffer(window_size=24, feature_dim=80)
        self.lip_model = LipGRUModel()
        try:
            ckpt_path = os.path.join(os.path.dirname(__file__), "ml", "checkpoints", "baseline_lip_gru.pth")
            if os.path.exists(ckpt_path):
                ckpt = torch.load(ckpt_path, weights_only=False)
                self.lip_model.load_state_dict(ckpt["model_state_dict"])
        except Exception:
            pass
        self.lip_model.eval()

    def set_meeting_context(self, snippet: str) -> None:
        self.llm.add_meeting_context(snippet)

    def process_lip_landmarks(self, landmarks: List[Dict[str, float]]) -> Optional[str]:
        features = extract_lip_features(landmarks)
        if features is None:
            return None
        self.lip_buffer.push(features)
        if self.lip_buffer.is_full():
            intent, confidence = predict_lip_intent(self.lip_model, self.lip_buffer.get_sequence(), VOCABULARY_CLASSES)
            if confidence >= self.settings.confidence_threshold:
                return self.process_intent(ModalitySource.LIP, intent, confidence)
        return None

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
