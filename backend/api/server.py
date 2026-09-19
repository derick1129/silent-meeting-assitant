from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Set
from backend.config import get_settings
from backend.models.commands import COMMAND_REGISTRY
from backend.models.events import WebSocketEnvelope

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

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Silent Meeting Assistant API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "mode": settings.dev_mode}

    @app.get("/api/commands")
    def list_commands():
        return {k: v.model_dump() for k, v in COMMAND_REGISTRY.items()}

    @app.websocket("/ws/events")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            await websocket.send_json(
                WebSocketEnvelope(event="system_status", data={"status": "connected", "mode": settings.dev_mode}).model_dump()
            )
            while True:
                data = await websocket.receive_json()
                action = data.get("action")
                if action == "ping":
                    await websocket.send_json({"event": "pong"})
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    return app
