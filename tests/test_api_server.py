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

def test_command_update_and_reset():
    app = create_app()
    client = TestClient(app)
    
    # 1. Update existing command
    resp = client.post("/api/commands", json={
        "intent": "YES",
        "default_text": "LGTM! Approved."
    })
    assert resp.status_code == 200
    assert resp.json()["command"]["default_text"] == "LGTM! Approved."
    
    # Verify GET reflects update
    get_resp = client.get("/api/commands")
    assert get_resp.json()["YES"]["default_text"] == "LGTM! Approved."

    # 2. Add brand-new command
    add_resp = client.post("/api/commands", json={
        "intent": "WRAP_UP",
        "display_name": "Wrap Up",
        "default_text": "Let's wrap up the meeting.",
        "supported_modalities": ["gesture", "lip"]
    })
    assert add_resp.status_code == 200
    assert add_resp.json()["command"]["intent"] == "WRAP_UP"

    get_resp2 = client.get("/api/commands")
    assert "WRAP_UP" in get_resp2.json()
    assert get_resp2.json()["WRAP_UP"]["default_text"] == "Let's wrap up the meeting."

    # 3. Reset to defaults
    reset_resp = client.post("/api/commands/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["commands"]["YES"]["default_text"] == "Yes, I agree."
    assert "WRAP_UP" not in reset_resp.json()["commands"]


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

def test_websocket_audio_chunk():
    import base64
    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine
    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    app = create_app(orchestrator=orchestrator)
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        initial = websocket.receive_json()
        assert initial["event"] == "system_status"

        fake_audio_b64 = base64.b64encode(b"\x00\x00" * 800).decode("utf-8")
        websocket.send_json({"action": "start_audio"})
        websocket.send_json({
            "action": "audio_chunk",
            "data": fake_audio_b64
        })
        websocket.send_json({"action": "stop_audio"})

        # Verify connection stays healthy
        websocket.send_json({"action": "ping"})
        pong = websocket.receive_json()
        assert pong["event"] == "pong"



