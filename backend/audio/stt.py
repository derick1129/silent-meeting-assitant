import abc
import asyncio
from typing import Callable, Optional
from pydantic import BaseModel

class STTTranscriptEvent(BaseModel):
    text: str
    is_final: bool
    confidence: float

class BaseSTTProvider(abc.ABC):
    def __init__(self, on_transcript: Optional[Callable[[STTTranscriptEvent], None]] = None):
        self.on_transcript = on_transcript

    @abc.abstractmethod
    async def start(self) -> None:
        pass

    @abc.abstractmethod
    async def stop(self) -> None:
        pass

    @abc.abstractmethod
    async def process_audio_chunk(self, chunk: bytes) -> None:
        pass

class MockSTTProvider(BaseSTTProvider):
    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def process_audio_chunk(self, chunk: bytes) -> None:
        pass

    async def simulate_utterance(self, text: str, is_final: bool = True, confidence: float = 0.98) -> None:
        if self.on_transcript:
            event = STTTranscriptEvent(text=text, is_final=is_final, confidence=confidence)
            self.on_transcript(event)

class DeepgramSTTProvider(BaseSTTProvider):
    def __init__(self, api_key: str, on_transcript: Optional[Callable[[STTTranscriptEvent], None]] = None):
        super().__init__(on_transcript)
        self.api_key = api_key
        self.is_connected = False

    async def start(self) -> None:
        if not self.api_key:
            return
        self.is_connected = True

    async def stop(self) -> None:
        self.is_connected = False

    async def process_audio_chunk(self, chunk: bytes) -> None:
        pass
