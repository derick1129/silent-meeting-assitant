import pytest
from backend.models.events import CommunicationEvent, ModalitySource, WebSocketEnvelope
from backend.models.commands import COMMAND_REGISTRY, get_command_by_intent

def test_communication_event_serialization():
    event = CommunicationEvent(
        source=ModalitySource.LIP,
        intent="I_HAVE_A_QUESTION",
        raw_text="I have a question",
        confidence=0.92,
    )
    assert event.id.startswith("evt_")
    assert event.confidence == 0.92
    data = event.model_dump()
    assert data["source"] == "lip"
    assert data["intent"] == "I_HAVE_A_QUESTION"

def test_command_registry_lookup():
    cmd = get_command_by_intent("REQUEST_TO_SPEAK")
    assert cmd is not None
    assert cmd.intent == "REQUEST_TO_SPEAK"
    assert "gesture" in cmd.supported_modalities

def test_websocket_envelope():
    env = WebSocketEnvelope(event="event_detected", data={"intent": "YES"})
    payload = env.model_dump_json()
    assert "event_detected" in payload
    assert "timestamp" in payload
