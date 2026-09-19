import pytest
from backend.orchestrator import AssistantOrchestrator
from backend.models.events import ModalitySource

from backend.llm.engine import ContextLLMEngine

def test_orchestrator_process_intent():
    dispatched = []
    orchestrator = AssistantOrchestrator(
        on_broadcast=lambda event, data: dispatched.append((event, data)),
        llm_engine=ContextLLMEngine(api_key="")
    )
    orchestrator.set_meeting_context("Discussion on database architecture.")
    
    staged = orchestrator.process_intent(
        source=ModalitySource.GESTURE,
        intent="REQUEST_TO_SPEAK",
        confidence=0.95
    )
    assert staged is not None
    assert len(dispatched) >= 1
    event_type, payload = dispatched[0]
    assert event_type == "message_staged"
    assert "intent" in payload
    assert payload["intent"] == "REQUEST_TO_SPEAK"

def test_orchestrator_hand_landmarks():
    dispatched = []
    orchestrator = AssistantOrchestrator(
        on_broadcast=lambda event, data: dispatched.append((event, data)),
        llm_engine=ContextLLMEngine(api_key="")
    )
    # Open palm landmarks
    fake_landmarks = [{"x": 0.5, "y": 0.8, "z": 0.0} for _ in range(21)]
    for tip_idx in [4, 8, 12, 16, 20]:
        fake_landmarks[tip_idx]["y"] = 0.2
    for pip_idx in [3, 6, 10, 14, 18]:
        fake_landmarks[pip_idx]["y"] = 0.5
    
    staged = orchestrator.process_hand_landmarks(fake_landmarks)
    assert staged is not None
    assert "STOP" in [d[1]["intent"] for d in dispatched]

def test_orchestrator_two_phase_staging():
    import time
    dispatched = []
    orchestrator = AssistantOrchestrator(
        on_broadcast=lambda event, data: dispatched.append((event, data)),
        llm_engine=ContextLLMEngine(api_key="")
    )
    orchestrator.set_meeting_context("Discussion on microservices.")
    
    staged = orchestrator.process_intent(
        source=ModalitySource.LIP,
        intent="QUESTION",
        confidence=0.95
    )
    assert staged is not None
    # Immediate broadcast
    assert len(dispatched) >= 1
    assert dispatched[0][0] == "message_staged"
    assert dispatched[0][1]["is_refined"] is False
    
    # Wait brief moment for background refinement thread
    time.sleep(0.1)
    event_names = [d[0] for d in dispatched]
    assert "message_refined" in event_names

def test_orchestrator_lip_landmarks():
    dispatched = []
    orchestrator = AssistantOrchestrator(
        on_broadcast=lambda event, data: dispatched.append((event, data)),
        llm_engine=ContextLLMEngine(api_key="")
    )
    # 468 fake face landmarks
    fake_face = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(468)]
    fake_face[61] = {"x": 0.4, "y": 0.65, "z": 0.0}
    fake_face[291] = {"x": 0.6, "y": 0.65, "z": 0.0}

    # Push 24 frames
    for _ in range(24):
        orchestrator.process_lip_landmarks(fake_face)

    assert orchestrator.lip_buffer.is_full() is True


