import pytest
from fastapi.testclient import TestClient
from backend.api.server import create_app

def test_health_check():
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_commands_list():
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/commands")
    assert response.status_code == 200
    commands = response.json()
    assert "YES" in commands
    assert "STOP" in commands

def test_websocket_connection():
    app = create_app()
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        data = websocket.receive_json()
        assert data["event"] == "system_status"
        assert data["data"]["status"] == "connected"

def test_websocket_simulate_intent():
    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine
    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    app = create_app(orchestrator=orchestrator)
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        initial = websocket.receive_json()
        assert initial["event"] == "system_status"
        
        websocket.send_json({
            "action": "simulate_intent",
            "intent": "STOP",
            "source": "gesture"
        })
        
        response = websocket.receive_json()
        assert response["event"] == "message_staged"
        assert response["data"]["intent"] == "STOP"
        assert "stop" in response["data"]["normalized_text"].lower()

