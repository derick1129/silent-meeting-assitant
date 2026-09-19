from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Set, Optional, Dict, Any
import asyncio
from backend.config import Settings, get_settings
from backend.models.commands import COMMAND_REGISTRY, CommandUpdateRequest, update_command, reset_commands_to_default
from backend.models.events import WebSocketEnvelope, ModalitySource
from backend.orchestrator import AssistantOrchestrator

from backend.audio.stt import BaseSTTProvider, DeepgramSTTProvider, STTTranscriptEvent
from backend.vsr.intent_mapper import map_text_to_intent
from backend.vsr.msp_provider import MSPVSRProvider, VSRError
from backend.vsr.types import VSRProvider
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
    stt_provider: Optional[BaseSTTProvider] = None,
    vsr_provider: Optional[VSRProvider] = None,
    settings_override: Optional[Settings] = None,
) -> FastAPI:
    settings = settings_override or get_settings()
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
    auto_suggest_enabled = False

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
        text = evt.text.strip()
        if text:
            active_orchestrator.set_meeting_context(text)
            broadcast_sync("context_updated", {
                "status": "ok",
                "snippet": text,
                "full_context": active_orchestrator.llm.get_context_summary(),
                "is_final": evt.is_final
            })
            if auto_suggest_enabled and evt.is_final:
                is_question = text.endswith("?") or any(
                    text.lower().startswith(q) for q in ["what", "how", "why", "who", "when", "where", "can", "could", "should", "is", "are", "do", "does"]
                )
                if is_question or len(text.split()) >= 4:
                    try:
                        cur_loop = asyncio.get_running_loop()
                        cur_loop.create_task(asyncio.to_thread(active_orchestrator.generate_speech_solution, text))
                    except RuntimeError:
                        if loop and loop.is_running():
                            asyncio.run_coroutine_threadsafe(
                                asyncio.to_thread(active_orchestrator.generate_speech_solution, text), loop
                            )

    active_stt = stt_provider or DeepgramSTTProvider(
        api_key=settings.deepgram_api_key,
        on_transcript=handle_transcript
    )
    active_vsr = vsr_provider or MSPVSRProvider(
        model_id=settings.vsr_model_id,
        revision=settings.vsr_model_revision,
        enabled=settings.vsr_enabled,
        device=settings.vsr_device,
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "mode": settings.dev_mode}

    @app.get("/api/commands")
    def list_commands():
        return {k: v.model_dump() for k, v in COMMAND_REGISTRY.items()}

    @app.post("/api/commands")
    def update_command_endpoint(req: CommandUpdateRequest):
        cmd = update_command(
            intent=req.intent,
            default_text=req.default_text,
            display_name=req.display_name,
            supported_modalities=req.supported_modalities,
        )
        return {"status": "ok", "command": cmd.model_dump()}

    @app.post("/api/commands/reset")
    def reset_commands_endpoint():
        reset_commands_to_default()
        return {"status": "ok", "commands": {k: v.model_dump() for k, v in COMMAND_REGISTRY.items()}}

    @app.post("/api/vsr/predict")
    async def predict_vsr(request: Request):
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("video/"):
            raise HTTPException(status_code=415, detail="content-type must be video/*")
        body = await request.body()
        if not body:
            raise HTTPException(status_code=400, detail="video body is empty")
        if len(body) > settings.vsr_max_clip_bytes:
            raise HTTPException(status_code=413, detail="video clip is too large")
        try:
            prediction = active_vsr.predict(
                body, request.headers.get("x-filename", "clip.webm")
            )
        except VSRError as exc:
            status_code = (
                503
                if "disabled" in str(exc).lower() or "load failed" in str(exc).lower()
                else 422
            )
            raise HTTPException(status_code=status_code, detail=str(exc)) from exc

        intent, mapped_confidence = map_text_to_intent(
            prediction.text, settings.vsr_min_confidence
        )
        prediction = prediction.model_copy(
            update={
                "intent": intent,
                "confidence": min(prediction.confidence, mapped_confidence)
                if intent
                else 0.0,
            }
        )
        active_orchestrator.process_vsr_prediction(prediction)
        return prediction.model_dump()

    @app.websocket("/ws/events")
    async def websocket_endpoint(websocket: WebSocket):
        nonlocal loop, auto_suggest_enabled
        loop = asyncio.get_running_loop()
        await manager.connect(websocket)
        try:
            await websocket.send_json(
                WebSocketEnvelope(
                    event="system_status",
                    data={
                        "status": "connected",
                        "mode": settings.dev_mode,
                        "auto_suggest": auto_suggest_enabled
                    }
                ).model_dump()
            )
            while True:
                data = await websocket.receive_json()
                action = data.get("action")

                if action == "ping":
                    await websocket.send_json({"event": "pong"})

                elif action == "start_audio":
                    await active_stt.start()

                elif action == "stop_audio":
                    await active_stt.stop()

                elif action == "audio_chunk":
                    chunk_b64 = data.get("data", "")
                    if chunk_b64:
                        try:
                            raw_pcm = base64.b64decode(chunk_b64)
                            await active_stt.process_audio_chunk(raw_pcm)
                        except Exception:
                            pass

                elif action == "generate_solution":
                    query = data.get("query", "")
                    cur_loop = asyncio.get_running_loop()
                    cur_loop.create_task(asyncio.to_thread(active_orchestrator.generate_speech_solution, query))

                elif action == "set_auto_suggest":
                    auto_suggest_enabled = bool(data.get("enabled", False))
                    await websocket.send_json(
                        WebSocketEnvelope(event="auto_suggest_status", data={"enabled": auto_suggest_enabled}).model_dump()
                    )

                elif action == "simulate_intent":
                    intent = data.get("intent", "QUESTION")
                    source_str = data.get("source", "gesture")
                    source = ModalitySource.GESTURE if source_str == "gesture" else ModalitySource.LIP
                    confidence = float(data.get("confidence", 0.95))
                    active_orchestrator.process_intent(source=source, intent=intent, confidence=confidence)

                elif action == "detect_gesture":
                    landmarks = data.get("landmarks", [])
                    active_orchestrator.process_hand_landmarks(landmarks)

                elif action == "detect_lip":
                    landmarks = data.get("landmarks", [])
                    active_orchestrator.process_lip_landmarks(landmarks)

                elif action == "update_context":
                    snippet = data.get("snippet", "")
                    active_orchestrator.set_meeting_context(snippet)
                    await websocket.send_json(
                        WebSocketEnvelope(event="context_updated", data={"status": "ok", "snippet": snippet}).model_dump()
                    )

        except WebSocketDisconnect:
            manager.disconnect(websocket)

    return app
