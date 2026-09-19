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

import threading
import time
import logging
from collections import deque

logger = logging.getLogger(__name__)

class DeepgramSTTProvider(BaseSTTProvider):
    def __init__(self, api_key: str, on_transcript: Optional[Callable[[STTTranscriptEvent], None]] = None):
        super().__init__(on_transcript)
        self.api_key = api_key
        self.is_connected = False
        self.chunks_processed = 0
        self._socket = None
        self._thread = None
        self._running = False
        self._pending_chunks = deque(maxlen=60)  # Pre-buffers up to ~3 seconds during handshake
        self._lock = threading.Lock()

    async def start(self) -> None:
        if not self.api_key or self.api_key == "mock_key":
            self.is_connected = False
            return

        with self._lock:
            if self._running and self._thread and self._thread.is_alive():
                return
            self._running = True

        def _worker():
            from deepgram import DeepgramClient
            while self._running:
                try:
                    logger.info("[DeepgramSTT] Connecting to Deepgram streaming API...")
                    dg = DeepgramClient(api_key=self.api_key)
                    with dg.listen.v1.connect(
                        model="nova-2",
                        smart_format=True,
                        encoding="linear16",
                        sample_rate=16000
                    ) as socket:
                        with self._lock:
                            self._socket = socket
                            self.is_connected = True
                            # Flush any audio chunks recorded during connection establishment
                            while self._pending_chunks:
                                pending = self._pending_chunks.popleft()
                                try:
                                    socket.send_media(pending)
                                except Exception:
                                    break
                        logger.info("[DeepgramSTT] Connected to Deepgram streaming socket successfully.")

                        for message in socket:
                            if not self._running:
                                break
                            if hasattr(message, "channel") and message.channel.alternatives:
                                for alt in message.channel.alternatives:
                                    if alt.transcript and alt.transcript.strip():
                                        is_final = getattr(message, "is_final", True)
                                        event = STTTranscriptEvent(
                                            text=alt.transcript.strip(),
                                            is_final=is_final,
                                            confidence=getattr(alt, "confidence", 0.95)
                                        )
                                        if self.on_transcript:
                                            self.on_transcript(event)
                except Exception as exc:
                    logger.warning(f"[DeepgramSTT] Socket closed or error: {exc}")
                finally:
                    with self._lock:
                        self.is_connected = False
                        self._socket = None

                if not self._running:
                    break
                # Back off briefly before reconnecting
                time.sleep(0.5)

        self._thread = threading.Thread(target=_worker, daemon=True)
        self._thread.start()

    async def stop(self) -> None:
        self._running = False
        with self._lock:
            self.is_connected = False
            self._pending_chunks.clear()
            if self._socket:
                try:
                    self._socket.send_finalize()
                    self._socket.send_close_stream()
                except Exception:
                    pass
                self._socket = None

    async def process_audio_chunk(self, chunk: bytes) -> None:
        self.chunks_processed += 1
        if not self.api_key or self.api_key == "mock_key":
            return

        # Lazy connect / reconnect if not running or socket dropped
        if not self._running or not self.is_connected:
            await self.start()

        with self._lock:
            if self._socket and self.is_connected:
                try:
                    self._socket.send_media(chunk)
                except Exception as exc:
                    logger.warning(f"[DeepgramSTT] Error sending media chunk: {exc}")
            else:
                self._pending_chunks.append(chunk)


