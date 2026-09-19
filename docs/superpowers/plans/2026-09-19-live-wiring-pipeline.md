# Live Multimodal Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the live camera, WebSocket stream, fusion engine, Gemini AI contextualizer, and React frontend companion into an active real-time system that detects gestures and speech and stages meeting-ready messages.

**Architecture:** A centralized `AssistantOrchestrator` on the FastAPI backend manages incoming sensor events, filters them through `InputFusionEngine`, expands them with `ContextLLMEngine` (Gemini), and broadcasts updates over WebSockets. A dedicated `useWebSocket` hook in React synchronizes the Zustand state store, supported by a browser-native WebRTC camera capture component and an interactive quick-testing toolbar.

**Tech Stack:** FastAPI, WebSockets, Python 3.12, Pytest, React 18, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- **Python Version:** 3.12.
- **WebSocket Route:** `ws://127.0.0.1:8000/ws/events`.
- **Browser Compatibility:** Use standard `navigator.mediaDevices.getUserMedia` for universal macOS/Chrome camera access.
- **Real-time Latency:** End-to-end event dispatch to UI staging $\le 200$ ms.
- **Zero Raw Media Storage:** Frames processed in memory; no video files written to disk.

---

### Task 1: Backend Assistant Orchestrator Service

**Files:**
- Create: `backend/orchestrator.py`
- Test: `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `Settings`, `InputFusionEngine`, `ContextLLMEngine`, `classify_hand_gesture`.
- Produces: `AssistantOrchestrator` with `process_hand_landmarks()`, `process_intent()`, and broadcast callback.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_orchestrator.py
import pytest
from backend.orchestrator import AssistantOrchestrator
from backend.models.events import ModalitySource

def test_orchestrator_process_intent():
    dispatched = []
    orchestrator = AssistantOrchestrator(
        on_broadcast=lambda event, data: dispatched.append((event, data))
    )
    orchestrator.set_meeting_context("Discussion on database architecture.")
    
    staged = orchestrator.process_intent(
        source=ModalitySource.GESTURE,
        intent="REQUEST_TO_SPEAK",
        confidence=0.95
    )
    assert staged is not None
    assert len(dispatched) >= 1
    event_type, payload = dispatched[0]
    assert event_type == "message_staged"
    assert "intent" in payload
    assert payload["intent"] == "REQUEST_TO_SPEAK"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_orchestrator.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.orchestrator'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/orchestrator.py
from typing import Callable, Optional, Dict, Any, List
from backend.config import get_settings
from backend.models.events import CommunicationEvent, ModalitySource, WebSocketEnvelope
from backend.fusion.engine import InputFusionEngine
from backend.llm.engine import ContextLLMEngine
from backend.vision.gesture import classify_hand_gesture

class AssistantOrchestrator:
    def __init__(self, on_broadcast: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        settings = get_settings()
        self.settings = settings
        self.on_broadcast = on_broadcast
        self.fusion = InputFusionEngine(
            confidence_threshold=settings.confidence_threshold,
            cooldown_seconds=settings.cooldown_seconds
        )
        self.llm = ContextLLMEngine(api_key=settings.gemini_api_key)

    def set_meeting_context(self, snippet: str) -> None:
        self.llm.add_meeting_context(snippet)

    def process_hand_landmarks(self, landmarks: List[Dict[str, float]]) -> Optional[str]:
        result = classify_hand_gesture(landmarks)
        if not result:
            return None
        intent, confidence = result
        return self.process_intent(ModalitySource.GESTURE, intent, confidence)

    def process_intent(self, source: ModalitySource, intent: str, confidence: float) -> Optional[str]:
        event = self.fusion.process_event(source, intent, confidence)
        if not event:
            return None

        normalized_message = self.llm.normalize_intent(event)

        if self.on_broadcast:
            self.on_broadcast("message_staged", {
                "event": event.model_dump(),
                "normalized_text": normalized_message,
                "source": source.value,
                "intent": intent,
                "confidence": confidence
            })

        return normalized_message
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_orchestrator.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/orchestrator.py tests/test_orchestrator.py
git commit -m "feat(orchestrator): add centralized assistant orchestrator service"
```

---

### Task 2: WebSocket Handler Extensions

**Files:**
- Modify: `backend/api/server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `AssistantOrchestrator`.
- Produces: Action routing for `simulate_intent`, `detect_gesture`, `update_context`.

- [ ] **Step 1: Write the failing test**

```python
# In tests/test_api_server.py: add test_websocket_actions
def test_websocket_simulate_intent():
    app = create_app()
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        # Initial status
        data = websocket.receive_json()
        assert data["event"] == "system_status"
        
        # Send simulate action
        websocket.send_json({
            "action": "simulate_intent",
            "intent": "STOP",
            "source": "gesture"
        })
        
        # Receive staged message
        response = websocket.receive_json()
        assert response["event"] == "message_staged"
        assert response["data"]["intent"] == "STOP"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_api_server.py -k test_websocket_simulate_intent -v`  
Expected: FAIL

- [ ] **Step 3: Update `backend/api/server.py`**

Connect `AssistantOrchestrator` to `websocket_endpoint` and broadcast responses.

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_api_server.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/api/server.py tests/test_api_server.py
git commit -m "feat(api): wire orchestrator actions to WebSocket event bus"
```

---

### Task 3: Frontend WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/hooks/__tests__/useWebSocket.test.ts`

**Interfaces:**
- Consumes: WebSocket URL (`ws://localhost:8000/ws/events`).
- Produces: `useWebSocket()` hook exposing `isConnected`, `sendAction()`.

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `useWebSocket.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 4: Interactive Testing Bar & Clipboard Copy Integration

**Files:**
- Create: `frontend/src/components/SimulationBar.tsx`
- Modify: `frontend/src/components/DetectionCard.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/SimulationBar.test.tsx`

**Interfaces:**
- Produces: One-click interactive buttons for gestures and silent lip commands, context editor drawer, and automatic clipboard copy on `[Send to Meeting]`.

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement components**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
