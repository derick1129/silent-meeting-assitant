import pytest
from unittest.mock import MagicMock
from backend.vision.pipeline import VisionPipeline

def test_mock_vision_pipeline_emission():
    emitted = []
    pipeline = VisionPipeline(mode="mock", on_event=lambda s, i, c: emitted.append((s, i, c)))
    
    pipeline.step_mock(source="gesture", intent="STOP", confidence=0.95)
    assert len(emitted) == 1
    assert emitted[0] == ("gesture", "STOP", 0.95)

def test_vision_pipeline_lifecycle():
    pipeline = VisionPipeline(mode="mock")
    assert not pipeline.is_running
    pipeline.start()
    assert pipeline.is_running
    pipeline.stop()
    assert not pipeline.is_running
