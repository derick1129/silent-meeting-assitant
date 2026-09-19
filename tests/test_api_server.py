import pytest
from fastapi.testclient import TestClient
from backend.api.server import create_app
from backend.config import Settings
from backend.vsr.msp_provider import VSRError
from backend.vsr.types import VSRPrediction


class FakeVSRProvider:
    def __init__(self, prediction=None, error=None):
        self.prediction = prediction or VSRPrediction(
            text="can you repeat that",
            confidence=0.91,
            latency_ms=420.0,
            model_id="test/model",
        )
        self.error = error

    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        if self.error:
            raise self.error
        return self.prediction

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

def test_websocket_generate_solution():
    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine
    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    app = create_app(orchestrator=orchestrator)
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        initial = websocket.receive_json()
        assert initial["event"] == "system_status"

        websocket.send_json({
            "action": "generate_solution",
            "query": "How do we handle database migrations?"
        })

        response = websocket.receive_json()
        assert response["event"] == "solution_generated"
        assert response["data"]["query"] == "How do we handle database migrations?"
        assert "suggested_answer" in response["data"]
        assert len(response["data"]["solution_points"]) > 0

def test_websocket_auto_suggest_toggle():
    app = create_app()
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        initial = websocket.receive_json()
        assert initial["event"] == "system_status"

        websocket.send_json({
            "action": "set_auto_suggest",
            "enabled": True
        })

        response = websocket.receive_json()
        assert response["event"] == "auto_suggest_status"
        assert response["data"]["enabled"] is True


def test_vsr_endpoint_maps_text_and_stages_a_command():
    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine

    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    app = create_app(orchestrator=orchestrator, vsr_provider=FakeVSRProvider())
    client = TestClient(app)

    with client.websocket_connect("/ws/events") as websocket:
        assert websocket.receive_json()["event"] == "system_status"
        response = client.post(
            "/api/vsr/predict",
            content=b"valid-video",
            headers={"content-type": "video/webm", "x-filename": "phrase.webm"},
        )
        event = websocket.receive_json()

    assert response.status_code == 200
    assert response.json()["intent"] == "PLEASE_REPEAT"
    assert event["event"] == "message_staged"
    assert event["data"]["event"]["metadata"]["recognized_text"] == "can you repeat that"


def test_vsr_endpoint_rejects_non_video_content_type():
    app = create_app(vsr_provider=FakeVSRProvider())
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"not-a-video",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 415


def test_vsr_endpoint_rejects_empty_clip():
    app = create_app(vsr_provider=FakeVSRProvider())
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"",
        headers={"content-type": "video/webm"},
    )
    assert response.status_code == 400


def test_vsr_endpoint_rejects_oversized_clip():
    app = create_app(
        vsr_provider=FakeVSRProvider(),
        settings_override=Settings(vsr_max_clip_bytes=4),
    )
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"12345",
        headers={"content-type": "video/webm"},
    )
    assert response.status_code == 413


@pytest.mark.parametrize(
    ("error", "status_code"),
    [(VSRError("VSR provider is disabled"), 503), (VSRError("VSR decoding failed"), 422)],
)
def test_vsr_endpoint_returns_provider_error_status(error, status_code):
    app = create_app(vsr_provider=FakeVSRProvider(error=error))
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"valid-video",
        headers={"content-type": "video/webm"},
    )
    assert response.status_code == status_code


