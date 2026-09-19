import pytest
import time
from backend.fusion.engine import InputFusionEngine
from backend.models.events import ModalitySource

def test_confidence_threshold_filtering():
    engine = InputFusionEngine(confidence_threshold=0.75)
    # Below threshold -> None
    assert engine.process_event(ModalitySource.GESTURE, "STOP", 0.60) is None
    # Above threshold -> Emitted
    evt = engine.process_event(ModalitySource.GESTURE, "STOP", 0.85)
    assert evt is not None
    assert evt.intent == "STOP"

def test_cooldown_debouncing():
    engine = InputFusionEngine(cooldown_seconds=1.0)
    evt1 = engine.process_event(ModalitySource.LIP, "QUESTION", 0.90)
    assert evt1 is not None
    # Immediate repeat within cooldown -> None
    evt2 = engine.process_event(ModalitySource.LIP, "QUESTION", 0.92)
    assert evt2 is None

def test_multimodal_fusion_gesture_and_lip():
    engine = InputFusionEngine()
    engine.record_input(ModalitySource.GESTURE, "REQUEST_TO_SPEAK", 0.90)
    engine.record_input(ModalitySource.LIP, "QUESTION", 0.90)
    fused = engine.resolve_fused_intent()
    assert fused == "QUESTION"
