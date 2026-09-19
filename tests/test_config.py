import os
import pytest

def test_settings_load_defaults(monkeypatch):
    monkeypatch.delenv("DEEPGRAM_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from backend.config import get_settings
    settings = get_settings()
    assert settings.dev_mode in ["mock", "local_vision", "production"]
    assert settings.frame_width == 640
    assert settings.frame_height == 480
    assert settings.confidence_threshold == 0.70
    assert settings.cooldown_seconds == 1.5

def test_settings_custom_env(monkeypatch):
    monkeypatch.setenv("DEV_MODE", "production")
    monkeypatch.setenv("CONFIDENCE_THRESHOLD", "0.85")
    from backend.config import Settings
    custom = Settings(dev_mode="production", confidence_threshold=0.85)
    assert custom.dev_mode == "production"
    assert custom.confidence_threshold == 0.85
