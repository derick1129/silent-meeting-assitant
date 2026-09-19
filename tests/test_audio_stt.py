import pytest
import asyncio
from backend.audio.stt import MockSTTProvider, STTTranscriptEvent

@pytest.mark.asyncio
async def test_mock_stt_provider_transcription():
    events = []
    provider = MockSTTProvider(on_transcript=lambda e: events.append(e))
    await provider.start()
    
    await provider.simulate_utterance("I would like to speak regarding PostgreSQL.", is_final=True)
    assert len(events) == 1
    assert events[0].text == "I would like to speak regarding PostgreSQL."
    assert events[0].is_final is True
    assert events[0].confidence > 0.9
    await provider.stop()
