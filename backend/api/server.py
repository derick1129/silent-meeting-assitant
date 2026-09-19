from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Set, Optional, Dict, Any
import asyncio
from backend.config import get_settings
from backend.models.commands import COMMAND_REGISTRY
from backend.models.events import WebSocketEnvelope, ModalitySource
from backend.orchestrator import AssistantOrchestrator

from backend.audio.stt import BaseSTTProvider, DeepgramSTTProvider, STTTranscriptEvent
import base64

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, envelope: WebSocketEnvelope):
        data = envelope.model_dump()
        for conn in list(self.active_connections):
            try:
                await conn.send_json(data)
            except Exception:
                self.disconnect(conn)

manager = ConnectionManager()

def create_app(
    orchestrator: Optional[AssistantOrchestrator] = None,
    stt_provider: Optional[BaseSTTProvider] = None
) -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Silent Meeting Assistant API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Bridge orchestrator callbacks to async WebSocket broadcast
    loop = None

    def broadcast_sync(event_type: str, data: Dict[str, Any]):
        nonlocal loop
        env = WebSocketEnvelope(event=event_type, data=data)
        try:
            current_loop = asyncio.get_running_loop()
            current_loop.create_task(manager.broadcast(env))
        except RuntimeError:
            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(manager.broadcast(env), loop)

    active_orchestrator = orchestrator or AssistantOrchestrator(on_broadcast=broadcast_sync)
    if orchestrator:
        orchestrator.on_broadcast = broadcast_sync

    def handle_transcript(evt: STTTranscriptEvent):
        if evt.text.strip():
            active_orchestrator.set_meeting_context(evt.text.strip())
            broadcast_sync("context_updated", {
                "status": "ok",
                "snippet": evt.text.strip(),
                "is_final": evt.is_final
            })

    active_stt = stt_provider or DeepgramSTTProvider(
        api_key=settings.deepgram_api_key,
        on_transcript=handle_transcript
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "mode": settings.dev_mode}

    @app.get("/api/commands")
    def list_commands():
        return {k: v.model_dump() for k, v in COMMAND_REGISTRY.items()}

    @app.websocket("/ws/events")
    async def websocket_endpoint(websocket: WebSocket):
        nonlocal loop
        loop = asyncio.get_running_loop()
        await manager.connect(websocket)
        await active_stt.start()
        try:
            await websocket.send_json(
                WebSocketEnvelope(event="system_status", data={"status": "connected", "mode": settings.dev_mode}).model_dump()
            )
            while True:
                data = await websocket.receive_json()
                action = data.get("action")

                if action == "ping":
                    await websocket.send_json({"event": "pong"})

                elif action == "audio_chunk":
                    chunk_b64 = data.get("data", "")
                    if chunk_b64:
                        try:
                            raw_pcm = base64.b64decode(chunk_b64)
                            await active_stt.process_audio_chunk(raw_pcm)
                        except Exception:
                            pass

                elif action == "simulate_intent":
                    intent = data.get("intent", "QUESTION")
                    source_str = data.get("source", "gesture")
                    source = ModalitySource.GESTURE if source_str == "gesture" else ModalitySource.LIP
                    confidence = float(data.get("confidence", 0.95))
                    active_orchestrator.process_intent(source=source, intent=intent, confidence=confidence)

                elif action == "detect_gesture":
                    landmarks = data.get("landmarks", [])
                    active_orchestrator.process_hand_landmarks(landmarks)

                elif action == "update_context":
                    snippet = data.get("snippet", "")
                    active_orchestrator.set_meeting_context(snippet)
                    await websocket.send_json(
                        WebSocketEnvelope(event="context_updated", data={"status": "ok", "snippet": snippet}).model_dump()
                    )

        except WebSocketDisconnect:
            manager.disconnect(websocket)

    return app
