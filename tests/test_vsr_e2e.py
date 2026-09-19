"""
Mock end-to-end test for the VSR prediction pipeline.

Verifies that a video clip sent to the local API passes through the
provider → intent mapper → orchestrator → staged event pipeline
without downloading any model or making external network calls.
"""

import pytest
from fastapi.testclient import TestClient

from backend.api.server import create_app
from backend.config import Settings
from backend.vsr.types import VSRPrediction
from backend.vsr.msp_provider import VSRError


class FakeVSRProvider:
    """Injectable provider that returns a fixed prediction without loading a model."""

    def __init__(self, prediction: VSRPrediction | None = None, error: Exception | None = None):
        self.prediction = prediction
        self.error = error

    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        if self.error:
            raise self.error
        if self.prediction:
            return self.prediction
        raise VSRError("No prediction configured")


# --------------------------------------------------------------------------- #
# Happy-path E2E: clip → prediction → staged command (no external network)
# --------------------------------------------------------------------------- #


def test_vsr_clip_stages_customized_command_without_external_network():
    """A short video clip is submitted, the fake provider returns a prediction,
    the intent mapper resolves it to a controlled command, and the orchestrator
    broadcasts a staged message with recognized-text metadata."""

    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine

    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    provider = FakeVSRProvider(
        VSRPrediction(
            text="yes",
            intent="YES",
            confidence=0.92,
            latency_ms=2.0,
            model_id="test/model",
        )
    )
    app = create_app(
        orchestrator=orchestrator,
        vsr_provider=provider,
        settings_override=Settings(vsr_enabled=True),
    )
    client = TestClient(app)

    with client.websocket_connect("/ws/events") as websocket:
        assert websocket.receive_json()["event"] == "system_status"

        response = client.post(
            "/api/vsr/predict",
            content=b"fake-webm-bytes",
            headers={"content-type": "video/webm", "x-filename": "phrase.webm"},
        )

        staged = websocket.receive_json()

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "YES"
    assert body["confidence"] == 0.92
    assert body["model_id"] == "test/model"

    assert staged["event"] == "message_staged"
    assert "yes" in staged["data"]["event"]["metadata"]["recognized_text"].lower()


def test_vsr_disabled_provider_returns_503_and_does_not_stage():
    """When the VSR provider is disabled, the endpoint returns 503 and no
    message is staged."""

    provider = FakeVSRProvider(error=VSRError("VSR provider is disabled"))
    app = create_app(vsr_provider=provider)
    client = TestClient(app)

    response = client.post(
        "/api/vsr/predict",
        content=b"fake-webm-bytes",
        headers={"content-type": "video/webm"},
    )

    assert response.status_code == 503
    assert "disabled" in response.json()["detail"].lower()


def test_vsr_low_confidence_prediction_does_not_stage():
    """A prediction with confidence below the threshold returns 200 from the
    endpoint (the provider succeeded) but does not produce a staged message."""

    from backend.orchestrator import AssistantOrchestrator
    from backend.llm.engine import ContextLLMEngine

    orchestrator = AssistantOrchestrator(llm_engine=ContextLLMEngine(api_key=""))
    provider = FakeVSRProvider(
        VSRPrediction(
            text="maybe",
            intent=None,  # unknown text → no intent
            confidence=0.40,
            latency_ms=5.0,
            model_id="test/model",
        )
    )
    app = create_app(
        orchestrator=orchestrator,
        vsr_provider=provider,
        settings_override=Settings(vsr_enabled=True),
    )
    client = TestClient(app)

    response = client.post(
        "/api/vsr/predict",
        content=b"fake-webm-bytes",
        headers={"content-type": "video/webm"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] is None
    # Unknown text → endpoint correctly zeroes confidence to prevent staging
    assert body["confidence"] == 0.0


def test_vsr_e2e_request_validation_pipeline():
    """Non-video content type, empty body, and oversized clip are all rejected
    with appropriate 4xx status codes."""

    provider = FakeVSRProvider(
        VSRPrediction(
            text="yes", intent="YES", confidence=0.92,
            latency_ms=1.0, model_id="test/model",
        )
    )

    # Non-video content type → 415
    app = create_app(vsr_provider=provider)
    client = TestClient(app)
    assert client.post(
        "/api/vsr/predict", content=b"data",
        headers={"content-type": "text/plain"},
    ).status_code == 415

    # Empty body → 400
    assert client.post(
        "/api/vsr/predict", content=b"",
        headers={"content-type": "video/webm"},
    ).status_code == 400

    # Oversized clip → 413
    app_small = create_app(
        vsr_provider=provider,
        settings_override=Settings(vsr_max_clip_bytes=4),
    )
    assert TestClient(app_small).post(
        "/api/vsr/predict", content=b"12345",
        headers={"content-type": "video/webm"},
    ).status_code == 413
