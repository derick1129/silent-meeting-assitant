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


def test_deepgram_stt_message_formats_list_and_object():
    events = []
    provider = DeepgramSTTProvider(api_key="mock_key", on_transcript=lambda e: events.append(e))

    # Test 1: Channel as a list of objects (caused previous error)
    class AltObj:
        transcript = "Testing list channel format"
        confidence = 0.98

    class ChannelObj:
        alternatives = [AltObj()]

    msg_with_list = type("Msg", (), {"channel": [ChannelObj()], "is_final": True})()
    provider._process_socket_message(msg_with_list)
    assert len(events) == 1
    assert events[0].text == "Testing list channel format"
    assert events[0].is_final is True

    # Test 2: Channel as a single object
    msg_with_obj = type("Msg", (), {"channel": ChannelObj(), "is_final": False})()
    provider._process_socket_message(msg_with_obj)
    assert len(events) == 2
    assert events[1].text == "Testing list channel format"
    assert events[1].is_final is False

    # Test 3: Channel as a dict payload
    msg_dict = {
        "channel": {
            "alternatives": [{"transcript": "Testing dict channel format", "confidence": 0.96}]
        },
        "is_final": True
    }
    provider._process_socket_message(msg_dict)
    assert len(events) == 3
    assert events[2].text == "Testing dict channel format"


