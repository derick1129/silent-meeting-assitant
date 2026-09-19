import pytest
import asyncio
from backend.audio.stt import MockSTTProvider, DeepgramSTTProvider, STTTranscriptEvent

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

@pytest.mark.asyncio
async def test_deepgram_stt_provider_chunk_processing():
    events = []
    provider = DeepgramSTTProvider(api_key="mock_key", on_transcript=lambda e: events.append(e))
    assert provider.is_connected is False
    
    # Process audio chunk should queue or process bytes without crashing
    dummy_chunk = b"\x00\x00" * 800  # 100ms of 16kHz 16-bit mono PCM
    await provider.process_audio_chunk(dummy_chunk)
    assert provider.chunks_processed >= 1

