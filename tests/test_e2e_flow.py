import pytest
from fastapi.testclient import TestClient
from backend.api.server import create_app
from backend.fusion.engine import InputFusionEngine
from backend.llm.engine import ContextLLMEngine
from backend.models.events import ModalitySource

def test_full_silent_lip_flow_e2e():
    app = create_app()
    fusion = InputFusionEngine()
    llm = ContextLLMEngine()

    # 1. Lip recognition detects QUESTION
    event = fusion.process_event(ModalitySource.LIP, "QUESTION", 0.94)
    assert event is not None
    assert event.intent == "QUESTION"

    # 2. Context LLM engine normalizes message
    message = llm.normalize_intent(event)
    assert "question" in message.lower()

def test_full_gesture_flow_e2e():
    fusion = InputFusionEngine()
    event = fusion.process_event(ModalitySource.GESTURE, "REQUEST_TO_SPEAK", 0.95)
    assert event is not None
    assert event.intent == "REQUEST_TO_SPEAK"
