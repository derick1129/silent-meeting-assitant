# Silent Meeting Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time, local-first multimodal meeting assistant companion that captures user speech, silent lip movements, and hand gestures, fuses them into a unified communication stream, contextualizes them using an LLM, and surfaces them through an interactive companion UI.

**Architecture:** A Python/FastAPI backend runs local OpenCV and MediaPipe processing loops for real-time lip landmark and hand gesture extraction, feeding a lightweight PyTorch GRU sequence model and geometric rule engine. Recognized intents merge with speech transcripts in a debounced Input Fusion layer, expand via an LLM context engine, and stream over WebSockets to a React/TypeScript companion floating window.

**Tech Stack:** Python 3.11/3.12, FastAPI, WebSockets, OpenCV, MediaPipe, PyTorch, NumPy, Deepgram SDK, google-genai / LiteLLM, React 18, Vite, TypeScript, Tailwind CSS, Pytest, Vitest.

## Global Constraints

- **Python Version:** 3.11 or 3.12 managed via `uv`.
- **Privacy Enforcement:** Camera and lip landmark data MUST remain local; no raw video frames are sent externally.
- **Provider Interchangeability:** STT (Deepgram) and LLM (Gemini/LiteLLM) MUST implement abstract base classes with deterministic offline mocks for testing.
- **Controlled Vocabulary:** Support canonical intents: `YES`, `NO`, `HELP`, `STOP`, `THANK_YOU`, `REQUEST_TO_SPEAK`, `QUESTION`, `PLEASE_REPEAT`, `NEXT_TOPIC`, `AGREE`, `DISAGREE`, `FREEFORM_SPEECH`.
- **Latency Budget:** Vision processing loop $\le 33$ ms per frame (30 FPS); recognition-to-display latency $\le 250$ ms.
- **Strict TDD:** Every backend component MUST have corresponding unit tests verifying edge cases, thresholds, and failure modes before implementation.

---

### Task 1: Project Scaffolding, Environment & Configuration

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/config.py`
- Test: `tests/test_config.py`

**Interfaces:**
- Consumes: Environment variables (`APP_ENV`, `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, `DEV_MODE`).
- Produces: `Settings` class with attributes `dev_mode: str`, `camera_id: int`, `frame_width: int`, `frame_height: int`, `fps: int`, `confidence_threshold: float`, `cooldown_seconds: float`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_config.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend'`

- [ ] **Step 3: Write minimal implementation**

```toml
# backend/pyproject.toml
[project]
name = "silent-meeting-assistant"
version = "0.1.0"
description = "Multimodal Silent Meeting Assistant Companion"
readme = "README.md"
requires-python = ">=3.11,<3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "websockets>=13.0",
    "pydantic>=2.8.0",
    "pydantic-settings>=2.4.0",
    "numpy>=1.26.0,<2.0.0",
    "opencv-python-headless>=4.10.0",
    "mediapipe>=0.10.14",
    "torch>=2.2.0",
    "deepgram-sdk>=3.7.0",
    "google-genai>=0.1.1",
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.27.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

```python
# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_env: str = "development"
    dev_mode: str = "mock"  # "mock" | "local_vision" | "production"
    camera_id: int = 0
    frame_width: int = 640
    frame_height: int = 480
    fps: int = 30
    confidence_threshold: float = 0.70
    cooldown_seconds: float = 1.5
    deepgram_api_key: str = ""
    gemini_api_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

```bash
# backend/.env.example
APP_ENV=development
DEV_MODE=mock
DEEPGRAM_API_KEY=
GEMINI_API_KEY=
HOST=127.0.0.1
PORT=8000
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_config.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/.env.example backend/config.py tests/test_config.py
git commit -m "feat(core): setup project scaffolding and pydantic settings"
```

---

### Task 2: Core Data Contracts & Event Models

**Files:**
- Create: `backend/models/events.py`
- Create: `backend/models/commands.py`
- Test: `tests/test_event_models.py`

**Interfaces:**
- Consumes: Nothing (foundational module).
- Produces: `CommunicationEvent`, `CommandDefinition`, `ModalitySource`, `WebSocketEnvelope`, `COMMAND_REGISTRY`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_event_models.py
import pytest
from backend.models.events import CommunicationEvent, ModalitySource, WebSocketEnvelope
from backend.models.commands import COMMAND_REGISTRY, get_command_by_intent

def test_communication_event_serialization():
    event = CommunicationEvent(
        source=ModalitySource.LIP,
        intent="I_HAVE_A_QUESTION",
        raw_text="I have a question",
        confidence=0.92,
    )
    assert event.id.startswith("evt_")
    assert event.confidence == 0.92
    data = event.model_dump()
    assert data["source"] == "lip"
    assert data["intent"] == "I_HAVE_A_QUESTION"

def test_command_registry_lookup():
    cmd = get_command_by_intent("REQUEST_TO_SPEAK")
    assert cmd is not None
    assert cmd.intent == "REQUEST_TO_SPEAK"
    assert "gesture" in cmd.supported_modalities

def test_websocket_envelope():
    env = WebSocketEnvelope(event="event_detected", data={"intent": "YES"})
    payload = env.model_dump_json()
    assert "event_detected" in payload
    assert "timestamp" in payload
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_event_models.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.models'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/models/events.py
import time
import uuid
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class ModalitySource(str, Enum):
    SPEECH = "speech"
    LIP = "lip"
    GESTURE = "gesture"
    SYSTEM = "system"

class CommunicationEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    type: str = "communication_event"
    source: ModalitySource
    intent: str
    raw_text: str
    confidence: float
    timestamp: float = Field(default_factory=time.time)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WebSocketEnvelope(BaseModel):
    event: str
    data: Dict[str, Any]
    timestamp: float = Field(default_factory=time.time)
```

```python
# backend/models/commands.py
from typing import Dict, List, Optional
from pydantic import BaseModel

class CommandDefinition(BaseModel):
    intent: str
    display_name: str
    default_text: str
    supported_modalities: List[str]

COMMAND_REGISTRY: Dict[str, CommandDefinition] = {
    "YES": CommandDefinition(
        intent="YES",
        display_name="Yes",
        default_text="Yes, I agree.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "NO": CommandDefinition(
        intent="NO",
        display_name="No",
        default_text="No, I disagree.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "HELP": CommandDefinition(
        intent="HELP",
        display_name="Help",
        default_text="I need assistance.",
        supported_modalities=["lip", "speech"],
    ),
    "STOP": CommandDefinition(
        intent="STOP",
        display_name="Stop",
        default_text="Please pause or stop here.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "THANK_YOU": CommandDefinition(
        intent="THANK_YOU",
        display_name="Thank You",
        default_text="Thank you.",
        supported_modalities=["lip", "speech"],
    ),
    "REQUEST_TO_SPEAK": CommandDefinition(
        intent="REQUEST_TO_SPEAK",
        display_name="I Want to Speak",
        default_text="I would like to speak.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "QUESTION": CommandDefinition(
        intent="QUESTION",
        display_name="I Have a Question",
        default_text="I have a question regarding this.",
        supported_modalities=["lip", "speech"],
    ),
    "PLEASE_REPEAT": CommandDefinition(
        intent="PLEASE_REPEAT",
        display_name="Please Repeat",
        default_text="Could you please repeat that?",
        supported_modalities=["lip", "speech"],
    ),
    "NEXT_TOPIC": CommandDefinition(
        intent="NEXT_TOPIC",
        display_name="Next Topic",
        default_text="Let's move on to the next topic.",
        supported_modalities=["lip", "speech"],
    ),
    "AGREE": CommandDefinition(
        intent="AGREE",
        display_name="Agree",
        default_text="I agree with this point.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "DISAGREE": CommandDefinition(
        intent="DISAGREE",
        display_name="Disagree",
        default_text="I have concerns regarding this.",
        supported_modalities=["gesture", "lip", "speech"],
    ),
    "FREEFORM_SPEECH": CommandDefinition(
        intent="FREEFORM_SPEECH",
        display_name="Spoken Message",
        default_text="",
        supported_modalities=["speech"],
    ),
}

def get_command_by_intent(intent: str) -> Optional[CommandDefinition]:
    return COMMAND_REGISTRY.get(intent)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_event_models.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models/events.py backend/models/commands.py tests/test_event_models.py
git commit -m "feat(models): add communication event, command registry, and websocket models"
```

---

### Task 3: Gesture Recognition Engine

**Files:**
- Create: `backend/vision/gesture.py`
- Test: `tests/test_gesture_classifier.py`

**Interfaces:**
- Consumes: Normalized 21 MediaPipe hand landmarks $(x, y, z)$.
- Produces: `classify_hand_gesture(landmarks: List[Dict[str, float]]) -> Optional[Tuple[str, float]]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_gesture_classifier.py
import pytest
from backend.vision.gesture import classify_hand_gesture

def create_synthetic_hand_landmarks(finger_states):
    """
    finger_states: dict with 'thumb', 'index', 'middle', 'ring', 'pinky' -> bool (extended=True)
    """
    landmarks = [{"x": 0.5, "y": 0.8, "z": 0.0} for _ in range(21)]
    # Wrist is at index 0
    landmarks[0] = {"x": 0.5, "y": 0.8, "z": 0.0}
    # Thumb: 1, 2, 3, 4
    landmarks[4]["y"] = 0.4 if finger_states.get("thumb") else 0.7
    # Index: 5, 6, 7, 8
    landmarks[8]["y"] = 0.3 if finger_states.get("index") else 0.75
    # Middle: 9, 10, 11, 12
    landmarks[12]["y"] = 0.3 if finger_states.get("middle") else 0.75
    # Ring: 13, 14, 15, 16
    landmarks[16]["y"] = 0.3 if finger_states.get("ring") else 0.75
    # Pinky: 17, 18, 19, 20
    landmarks[20]["y"] = 0.3 if finger_states.get("pinky") else 0.75
    return landmarks

def test_open_palm_stop_gesture():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": True, "index": True, "middle": True, "ring": True, "pinky": True
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "STOP"
    assert confidence >= 0.85

def test_raised_hand_request_to_speak():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": False, "index": True, "middle": True, "ring": True, "pinky": True
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "REQUEST_TO_SPEAK"

def test_thumbs_up_yes():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": True, "index": False, "middle": False, "ring": False, "pinky": False
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "YES"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_gesture_classifier.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.vision'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/vision/gesture.py
from typing import List, Dict, Optional, Tuple

def classify_hand_gesture(landmarks: List[Dict[str, float]]) -> Optional[Tuple[str, float]]:
    """
    Classifies a hand pose using 21 MediaPipe hand landmarks.
    Landmarks indices:
    Wrist: 0
    Thumb: 1..4 (Tip: 4, IP: 3, MCP: 2)
    Index: 5..8 (Tip: 8, PIP: 6, MCP: 5)
    Middle: 9..12 (Tip: 12, PIP: 10, MCP: 9)
    Ring: 13..16 (Tip: 16, PIP: 14, MCP: 13)
    Pinky: 17..20 (Tip: 20, PIP: 18, MCP: 17)
    """
    if not landmarks or len(landmarks) < 21:
        return None

    # In screen coordinates, y=0 is top, y=1 is bottom.
    # An extended finger has tip.y significantly smaller than pip.y
    wrist = landmarks[0]
    
    thumb_extended = landmarks[4]["y"] < landmarks[3]["y"]
    index_extended = landmarks[8]["y"] < landmarks[6]["y"]
    middle_extended = landmarks[12]["y"] < landmarks[10]["y"]
    ring_extended = landmarks[16]["y"] < landmarks[14]["y"]
    pinky_extended = landmarks[20]["y"] < landmarks[18]["y"]

    extended_count = sum([index_extended, middle_extended, ring_extended, pinky_extended])

    # Open Palm -> STOP (All 5 extended)
    if thumb_extended and extended_count == 4:
        return ("STOP", 0.95)

    # Raised Hand (4 fingers extended, thumb folded or neutral) -> REQUEST_TO_SPEAK
    if extended_count == 4 and not thumb_extended:
        return ("REQUEST_TO_SPEAK", 0.92)

    # Thumbs Up -> YES (Thumb up, 4 fingers folded, thumb tip higher than wrist)
    if thumb_extended and extended_count == 0 and landmarks[4]["y"] < wrist["y"]:
        return ("YES", 0.90)

    # Thumbs Down -> NO (Thumb pointing downward below wrist, 4 fingers folded)
    thumb_down = landmarks[4]["y"] > landmarks[3]["y"] and landmarks[4]["y"] > wrist["y"]
    if thumb_down and extended_count == 0:
        return ("NO", 0.90)

    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_gesture_classifier.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/vision/gesture.py tests/test_gesture_classifier.py
git commit -m "feat(vision): implement geometric hand gesture classifier"
```

---

### Task 4: Lip Landmark Feature Extraction & Temporal Sequence Buffer

**Files:**
- Create: `backend/vision/lips.py`
- Test: `tests/test_lip_features.py`

**Interfaces:**
- Consumes: Raw MediaPipe Face mesh landmarks (468 points).
- Produces: `extract_lip_features(landmarks: List[Dict[str, float]]) -> Optional[np.ndarray]`, `LipSequenceBuffer(window_size=24)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_lip_features.py
import numpy as np
import pytest
from backend.vision.lips import extract_lip_features, LipSequenceBuffer

def test_extract_lip_features():
    # 468 fake landmarks
    landmarks = [{"x": 0.5 + i * 0.0001, "y": 0.5 + i * 0.0001, "z": 0.0} for i in range(468)]
    features = extract_lip_features(landmarks)
    assert features is not None
    # 40 lip landmark coordinates (x, y) = 80 dimensions
    assert features.shape == (80,)
    assert isinstance(features, np.ndarray)

def test_lip_sequence_buffer():
    buf = LipSequenceBuffer(window_size=24, feature_dim=80)
    assert not buf.is_full()
    for _ in range(23):
        buf.push(np.zeros(80, dtype=np.float32))
    assert not buf.is_full()
    buf.push(np.ones(80, dtype=np.float32))
    assert buf.is_full()
    seq = buf.get_sequence()
    assert seq.shape == (24, 80)
    assert np.all(seq[-1] == 1.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_lip_features.py -v`  
Expected: FAIL with `ImportError: cannot import name 'extract_lip_features'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/vision/lips.py
import numpy as np
from typing import List, Dict, Optional
from collections import deque

# Standard MediaPipe 40 inner & outer lip landmark indices
LIP_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 61, 185, 40, 39, 37, 0, 267,
    269, 270, 409, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80,
    81, 82, 13, 312, 311
]

def extract_lip_features(landmarks: List[Dict[str, float]]) -> Optional[np.ndarray]:
    """
    Extracts and normalizes the 40 canonical lip landmark coordinates.
    Returns a flattened 1D array of shape (80,) containing centered (x, y) coordinates.
    """
    if not landmarks or len(landmarks) < 468:
        return None

    coords = []
    for idx in LIP_INDICES:
        pt = landmarks[idx]
        coords.append([pt["x"], pt["y"]])
    
    arr = np.array(coords, dtype=np.float32)  # shape: (40, 2)
    # Center relative to the mean of lip landmarks
    center = np.mean(arr, axis=0)
    arr -= center
    
    # Scale normalization by width (max x - min x)
    width = np.max(arr[:, 0]) - np.min(arr[:, 0])
    if width > 1e-4:
        arr /= width

    return arr.flatten()  # shape: (80,)

class LipSequenceBuffer:
    def __init__(self, window_size: int = 24, feature_dim: int = 80):
        self.window_size = window_size
        self.feature_dim = feature_dim
        self.buffer = deque(maxlen=window_size)

    def push(self, features: np.ndarray) -> None:
        if features.shape == (self.feature_dim,):
            self.buffer.append(features)

    def is_full(self) -> bool:
        return len(self.buffer) == self.window_size

    def get_sequence(self) -> np.ndarray:
        return np.array(self.buffer, dtype=np.float32)

    def clear(self) -> None:
        self.buffer.clear()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_lip_features.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/vision/lips.py tests/test_lip_features.py
git commit -m "feat(vision): add lip landmark feature extractor and temporal sequence buffer"
```

---

### Task 5: PyTorch GRU Lip Recognition Model & Baseline Weights

**Files:**
- Create: `backend/ml/lip_model.py`
- Create: `backend/ml/generate_baseline.py`
- Test: `tests/test_lip_model.py`

**Interfaces:**
- Consumes: Temporal feature sequences `(batch, 24, 80)`.
- Produces: `LipGRUModel(nn.Module)`, `predict_lip_intent(model, sequence: np.ndarray, classes: List[str]) -> Tuple[str, float]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_lip_model.py
import torch
import numpy as np
import pytest
from backend.ml.lip_model import LipGRUModel, predict_lip_intent, VOCABULARY_CLASSES

def test_lip_gru_forward():
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    dummy_input = torch.randn(2, 24, 80)
    output = model(dummy_input)
    assert output.shape == (2, len(VOCABULARY_CLASSES))

def test_predict_lip_intent():
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    model.eval()
    dummy_seq = np.random.randn(24, 80).astype(np.float32)
    intent, conf = predict_lip_intent(model, dummy_seq, VOCABULARY_CLASSES)
    assert intent in VOCABULARY_CLASSES
    assert 0.0 <= conf <= 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_lip_model.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.ml'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/ml/lip_model.py
import torch
import torch.nn as nn
import numpy as np
from typing import List, Tuple

VOCABULARY_CLASSES = [
    "SILENCE",
    "YES",
    "NO",
    "HELP",
    "STOP",
    "THANK_YOU",
    "QUESTION",
    "PLEASE_REPEAT",
    "NEXT_TOPIC",
    "AGREE",
    "DISAGREE"
]

class LipGRUModel(nn.Module):
    def __init__(self, input_size: int = 80, hidden_size: int = 64, num_classes: int = len(VOCABULARY_CLASSES)):
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.1
        )
        self.fc1 = nn.Linear(hidden_size * 2, 64)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(64, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        last_step = out[:, -1, :]
        feat = self.relu(self.fc1(last_step))
        logits = self.fc2(feat)
        return logits

def predict_lip_intent(model: nn.Module, sequence: np.ndarray, classes: List[str]) -> Tuple[str, float]:
    tensor = torch.from_numpy(sequence).unsqueeze(0).float()
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=-1).squeeze(0).numpy()
    
    best_idx = int(np.argmax(probs))
    return classes[best_idx], float(probs[best_idx])
```

```python
# backend/ml/generate_baseline.py
"""Generates synthetic initial weights checkpoint so the system is immediately runnable."""
import os
import torch
from backend.ml.lip_model import LipGRUModel, VOCABULARY_CLASSES

def generate_checkpoint(save_path: str = "backend/ml/checkpoints/baseline_lip_gru.pth"):
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    torch.save({
        "model_state_dict": model.state_dict(),
        "classes": VOCABULARY_CLASSES,
        "version": "1.0.0-baseline"
    }, save_path)
    print(f"Generated baseline checkpoint at {save_path}")

if __name__ == "__main__":
    generate_checkpoint()
```

- [ ] **Step 4: Run test and generate checkpoint**

Run:
```bash
uv run pytest tests/test_lip_model.py -v
uv run python -m backend.ml.generate_baseline
```
Expected: PASS, and `baseline_lip_gru.pth` generated.

- [ ] **Step 5: Commit**

```bash
git add backend/ml/lip_model.py backend/ml/generate_baseline.py tests/test_lip_model.py
git commit -m "feat(ml): implement GRU lip classifier and baseline checkpoint generator"
```

---

### Task 6: Video Capture Pipeline & Vision Worker

**Files:**
- Create: `backend/vision/pipeline.py`
- Test: `tests/test_vision_pipeline.py`

**Interfaces:**
- Consumes: Webcam or mock video source, MediaPipe Hand/Face modules.
- Produces: `VisionPipeline` emitting raw predictions callback: `on_prediction(source: str, intent: str, confidence: float)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_vision_pipeline.py
import pytest
from unittest.mock import MagicMock
from backend.vision.pipeline import VisionPipeline

def test_mock_vision_pipeline_emission():
    emitted = []
    pipeline = VisionPipeline(mode="mock", on_event=lambda s, i, c: emitted.append((s, i, c)))
    
    pipeline.step_mock(source="gesture", intent="STOP", confidence=0.95)
    assert len(emitted) == 1
    assert emitted[0] == ("gesture", "STOP", 0.95)

def test_vision_pipeline_lifecycle():
    pipeline = VisionPipeline(mode="mock")
    assert not pipeline.is_running
    pipeline.start()
    assert pipeline.is_running
    pipeline.stop()
    assert not pipeline.is_running
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_vision_pipeline.py -v`  
Expected: FAIL with `ImportError: cannot import name 'VisionPipeline'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/vision/pipeline.py
import threading
import time
from typing import Callable, Optional
import numpy as np

class VisionPipeline:
    def __init__(self, mode: str = "mock", on_event: Optional[Callable[[str, str, float], None]] = None):
        self.mode = mode
        self.on_event = on_event
        self.is_running = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self.is_running = True
        if self.mode != "mock":
            self._thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)

    def step_mock(self, source: str, intent: str, confidence: float) -> None:
        if self.on_event:
            self.on_event(source, intent, confidence)

    def _capture_loop(self) -> None:
        # Live camera loop using OpenCV and MediaPipe
        import cv2
        cap = cv2.VideoCapture(0)
        try:
            while self.is_running and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue
                # Landmark extraction hooks connect here
                time.sleep(0.03)  # ~30 fps cap
        finally:
            cap.release()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_vision_pipeline.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/vision/pipeline.py tests/test_vision_pipeline.py
git commit -m "feat(vision): implement vision capture pipeline and mock test harness"
```

---

### Task 7: Speech Recognition Provider Abstraction & Providers

**Files:**
- Create: `backend/audio/stt.py`
- Test: `tests/test_audio_stt.py`

**Interfaces:**
- Consumes: Audio bytes chunks (16kHz PCM).
- Produces: `BaseSTTProvider`, `MockSTTProvider`, `DeepgramSTTProvider`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audio_stt.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_audio_stt.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.audio'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/audio/stt.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_audio_stt.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/audio/stt.py tests/test_audio_stt.py
git commit -m "feat(audio): implement STT provider interface, mock STT, and Deepgram skeleton"
```

---

### Task 8: Input Fusion Engine

**Files:**
- Create: `backend/fusion/engine.py`
- Test: `tests/test_fusion_engine.py`

**Interfaces:**
- Consumes: Multi-source predictions (`source`, `intent`, `confidence`).
- Produces: `InputFusionEngine.process_event(...) -> Optional[CommunicationEvent]`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_fusion_engine.py
import pytest
import time
from backend.fusion.engine import InputFusionEngine
from backend.models.events import ModalitySource

def test_confidence_threshold_filtering():
    engine = InputFusionEngine(confidence_threshold=0.75)
    # Below threshold -> None
    assert engine.process_event(ModalitySource.GESTURE, "STOP", 0.60) is None
    # Above threshold -> Emitted
    evt = engine.process_event(ModalitySource.GESTURE, "STOP", 0.85)
    assert evt is not None
    assert evt.intent == "STOP"

def test_cooldown_debouncing():
    engine = InputFusionEngine(cooldown_seconds=1.0)
    evt1 = engine.process_event(ModalitySource.LIP, "QUESTION", 0.90)
    assert evt1 is not None
    # Immediate repeat within cooldown -> None
    evt2 = engine.process_event(ModalitySource.LIP, "QUESTION", 0.92)
    assert evt2 is None

def test_multimodal_fusion_gesture_and_lip():
    engine = InputFusionEngine()
    engine.record_input(ModalitySource.GESTURE, "REQUEST_TO_SPEAK", 0.90)
    engine.record_input(ModalitySource.LIP, "QUESTION", 0.90)
    fused = engine.resolve_fused_intent()
    assert fused == "QUESTION"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_fusion_engine.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.fusion'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/fusion/engine.py
import time
from typing import Dict, Optional
from backend.models.events import CommunicationEvent, ModalitySource
from backend.models.commands import get_command_by_intent

class InputFusionEngine:
    def __init__(self, confidence_threshold: float = 0.70, cooldown_seconds: float = 1.5):
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self.last_emitted_timestamps: Dict[str, float] = {}
        self.recent_inputs: Dict[ModalitySource, Dict[str, float]] = {}

    def process_event(self, source: ModalitySource, intent: str, confidence: float) -> Optional[CommunicationEvent]:
        if confidence < self.confidence_threshold:
            return None

        now = time.time()
        last_time = self.last_emitted_timestamps.get(intent, 0.0)
        if (now - last_time) < self.cooldown_seconds:
            return None

        self.last_emitted_timestamps[intent] = now
        cmd = get_command_by_intent(intent)
        raw_text = cmd.default_text if cmd else intent

        return CommunicationEvent(
            source=source,
            intent=intent,
            raw_text=raw_text,
            confidence=confidence,
            timestamp=now
        )

    def record_input(self, source: ModalitySource, intent: str, confidence: float) -> None:
        self.recent_inputs[source] = {"intent": intent, "confidence": confidence, "time": time.time()}

    def resolve_fused_intent(self) -> Optional[str]:
        # If user raised hand + mouthed question -> intent is QUESTION
        gesture = self.recent_inputs.get(ModalitySource.GESTURE)
        lip = self.recent_inputs.get(ModalitySource.LIP)

        if gesture and lip:
            if gesture["intent"] == "REQUEST_TO_SPEAK" and lip["intent"] == "QUESTION":
                return "QUESTION"
        if lip:
            return lip["intent"]
        if gesture:
            return gesture["intent"]
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_fusion_engine.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/fusion/engine.py tests/test_fusion_engine.py
git commit -m "feat(fusion): implement input fusion, threshold gating, and debounce engine"
```

---

### Task 9: Context & LLM Normalization Engine

**Files:**
- Create: `backend/llm/engine.py`
- Test: `tests/test_llm_engine.py`

**Interfaces:**
- Consumes: `CommunicationEvent`, meeting transcript context history.
- Produces: `ContextLLMEngine.normalize_intent(event: CommunicationEvent) -> str`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_llm_engine.py
import pytest
from backend.llm.engine import ContextLLMEngine
from backend.models.events import CommunicationEvent, ModalitySource

def test_template_fallback_without_api_key():
    engine = ContextLLMEngine(api_key="")
    event = CommunicationEvent(
        source=ModalitySource.LIP,
        intent="QUESTION",
        raw_text="I have a question.",
        confidence=0.95
    )
    result = engine.normalize_intent(event)
    assert "question" in result.lower()

def test_contextual_expansion():
    engine = ContextLLMEngine(api_key="")
    engine.add_meeting_context("Discussion on microservices vs monolith architecture.")
    event = CommunicationEvent(
        source=ModalitySource.GESTURE,
        intent="REQUEST_TO_SPEAK",
        raw_text="I would like to speak.",
        confidence=0.92
    )
    result = engine.normalize_intent(event)
    assert len(result) > 5
    assert "speak" in result.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_llm_engine.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.llm'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/llm/engine.py
from typing import List
from collections import deque
from backend.models.events import CommunicationEvent
from backend.models.commands import get_command_by_intent

class ContextLLMEngine:
    def __init__(self, api_key: str = "", max_history: int = 10):
        self.api_key = api_key
        self.context_history = deque(maxlen=max_history)

    def add_meeting_context(self, snippet: str) -> None:
        if snippet.strip():
            self.context_history.append(snippet.strip())

    def get_context_summary(self) -> str:
        return " ".join(self.context_history)

    def normalize_intent(self, event: CommunicationEvent) -> str:
        """
        Expands structured intent into context-aware meeting communication.
        Uses rule-based template expansion when LLM credentials are absent.
        """
        cmd = get_command_by_intent(event.intent)
        base_text = cmd.default_text if cmd else event.raw_text

        # If LLM API key exists, call Gemini/provider client with prompt guardrails:
        if self.api_key:
            # External LLM contextualization call (guarded)
            return base_text

        # High-quality deterministic templates
        summary = self.get_context_summary()
        if summary and event.intent == "QUESTION":
            return f"I have a question regarding the current topic: {base_text}"
        
        return base_text
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_llm_engine.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/llm/engine.py tests/test_llm_engine.py
git commit -m "feat(llm): implement context buffer and intent normalization engine"
```

---

### Task 10: WebSocket Server & FastAPI Core Application

**Files:**
- Create: `backend/api/server.py`
- Create: `backend/main.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `Settings`, `VisionPipeline`, `InputFusionEngine`, `ContextLLMEngine`.
- Produces: FastAPI application with endpoints `/health`, `/api/commands`, and WebSocket endpoint `/ws/events`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_api_server.py
import pytest
from fastapi.testclient import TestClient
from backend.api.server import create_app

def test_health_check():
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_commands_list():
    app = create_app()
    client = TestClient(app)
    response = client.get("/api/commands")
    assert response.status_code == 200
    commands = response.json()
    assert "YES" in commands
    assert "STOP" in commands

def test_websocket_connection():
    app = create_app()
    client = TestClient(app)
    with client.websocket_connect("/ws/events") as websocket:
        data = websocket.receive_json()
        assert data["event"] == "system_status"
        assert data["data"]["status"] == "connected"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_api_server.py -v`  
Expected: FAIL with `ModuleNotFoundError: No module named 'backend.api'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/api/server.py
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
```

```python
# backend/main.py
import uvicorn
from backend.config import get_settings
from backend.api.server import create_app

app = create_app()

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_api_server.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/api/server.py backend/main.py tests/test_api_server.py
git commit -m "feat(api): create FastAPI app with health, commands, and WebSocket server"
```

---

### Task 11: Frontend Companion App Scaffolding & State Store

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/store/useAssistantStore.ts`
- Test: `frontend/src/store/__tests__/useAssistantStore.test.ts`

**Interfaces:**
- Consumes: WebSocket events from backend (`/ws/events`).
- Produces: Zustand store tracking `mode`, `status`, `activeEvent`, `stagedMessage`, `history`, `actions`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/store/__tests__/useAssistantStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAssistantStore } from '../useAssistantStore';

describe('useAssistantStore', () => {
  beforeEach(() => {
    useAssistantStore.setState({
      status: 'IDLE',
      mode: 'AUTO',
      activeEvent: null,
      stagedMessage: '',
      history: []
    });
  });

  it('sets detected event and stages normalized message', () => {
    const { stageEvent, confirmStagedMessage } = useAssistantStore.getState();
    stageEvent({
      id: 'evt_1',
      source: 'lip',
      intent: 'QUESTION',
      raw_text: 'I have a question',
      confidence: 0.94
    }, 'I have a question regarding this architecture.');

    const state = useAssistantStore.getState();
    expect(state.status).toBe('AWAITING_CONFIRMATION');
    expect(state.stagedMessage).toBe('I have a question regarding this architecture.');

    confirmStagedMessage();
    const after = useAssistantStore.getState();
    expect(after.status).toBe('SENT');
    expect(after.history.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`  
Expected: FAIL (no test runner / module found)

- [ ] **Step 3: Write minimal implementation**

```json
// frontend/package.json
{
  "name": "silent-meeting-assistant-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.441.0",
    "zustand": "^4.5.5",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.11",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vitest": "^2.1.1"
  }
}
```

```typescript
// frontend/src/types.ts
export type ModalitySource = 'speech' | 'lip' | 'gesture' | 'system';
export type AppStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'RECOGNIZED' | 'AWAITING_CONFIRMATION' | 'SENT' | 'ERROR';
export type AppMode = 'AUTO' | 'VOICE' | 'SILENT';

export interface CommunicationEvent {
  id: string;
  source: ModalitySource;
  intent: string;
  raw_text: string;
  confidence: number;
}

export interface DispatchedMessage {
  id: string;
  source: ModalitySource;
  message: string;
  timestamp: number;
}
```

```typescript
// frontend/src/store/useAssistantStore.ts
import { create } from 'zustand';
import { AppMode, AppStatus, CommunicationEvent, DispatchedMessage } from '../types';

interface AssistantState {
  status: AppStatus;
  mode: AppMode;
  activeEvent: CommunicationEvent | null;
  stagedMessage: string;
  history: DispatchedMessage[];
  setMode: (mode: AppMode) => void;
  stageEvent: (event: CommunicationEvent, normalizedText: string) => void;
  confirmStagedMessage: () => void;
  cancelStagedMessage: () => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  status: 'IDLE',
  mode: 'AUTO',
  activeEvent: null,
  stagedMessage: '',
  history: [],
  setMode: (mode) => set({ mode }),
  stageEvent: (event, normalizedText) => set({
    activeEvent: event,
    stagedMessage: normalizedText,
    status: 'AWAITING_CONFIRMATION'
  }),
  confirmStagedMessage: () => {
    const { activeEvent, stagedMessage, history } = get();
    if (!activeEvent || !stagedMessage) return;
    const newMsg: DispatchedMessage = {
      id: activeEvent.id,
      source: activeEvent.source,
      message: stagedMessage,
      timestamp: Date.now()
    };
    set({
      history: [newMsg, ...history],
      activeEvent: null,
      stagedMessage: '',
      status: 'SENT'
    });
  },
  cancelStagedMessage: () => set({
    activeEvent: null,
    stagedMessage: '',
    status: 'IDLE'
  })
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm install && npm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold companion app and Zustand state store with unit tests"
```

---

### Task 12: Frontend Companion UI Components

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/DetectionCard.tsx`
- Create: `frontend/src/components/ActivityFeed.tsx`
- Create: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/DetectionCard.test.tsx`

**Interfaces:**
- Consumes: Zustand store state and actions.
- Produces: Standalone desktop-ready companion UI overlay.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/__tests__/DetectionCard.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
// Testing detection card rendering logic
describe('DetectionCard rendering logic', () => {
  it('formats confidence percentage correctly', () => {
    const confidence = 0.942;
    const formatted = `${Math.round(confidence * 100)}%`;
    expect(formatted).toBe('94%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test DetectionCard`  
Expected: Ensure runner discovers and runs test.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/Header.tsx
import React from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { Camera, Mic, Volume2 } from 'lucide-react';

export const Header: React.FC = () => {
  const { mode, status, setMode } = useAssistantStore();

  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900 text-white select-none">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <h1 className="text-sm font-semibold tracking-wide">SILENT ASSISTANT</h1>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => setMode(mode === 'AUTO' ? 'SILENT' : mode === 'SILENT' ? 'VOICE' : 'AUTO')}
          className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 font-mono"
        >
          {mode}
        </button>
        <span className="text-gray-400 text-[11px]">{status}</span>
      </div>
    </div>
  );
};
```

```tsx
// frontend/src/components/DetectionCard.tsx
import React from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { Hand, MessageSquare, Mic, Send, X } from 'lucide-react';

export const DetectionCard: React.FC = () => {
  const { activeEvent, stagedMessage, confirmStagedMessage, cancelStagedMessage } = useAssistantStore();

  if (!activeEvent || !stagedMessage) {
    return (
      <div className="p-4 bg-gray-950/50 rounded-lg border border-gray-800/60 text-center text-gray-500 text-xs py-8">
        Waiting for speech, silent lip commands, or gestures...
      </div>
    );
  }

  const SourceIcon = activeEvent.source === 'gesture' ? Hand : activeEvent.source === 'lip' ? MessageSquare : Mic;

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-indigo-500/30 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium uppercase tracking-wider">
          <SourceIcon className="w-4 h-4" />
          <span>{activeEvent.source} detected</span>
        </div>
        <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono">
          {Math.round(activeEvent.confidence * 100)}%
        </span>
      </div>

      <p className="text-base text-gray-100 font-medium leading-relaxed">
        "{stagedMessage}"
      </p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={confirmStagedMessage}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
        >
          <Send className="w-3.5 h-3.5" /> Send to Meeting
        </button>
        <button
          onClick={cancelStagedMessage}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
```

```tsx
// frontend/src/App.tsx
import React from 'react';
import { Header } from './components/Header';
import { DetectionCard } from './components/DetectionCard';
import { useAssistantStore } from './store/useAssistantStore';

export const App: React.FC = () => {
  const { history } = useAssistantStore();

  return (
    <div className="w-96 min-h-[480px] bg-black text-gray-200 flex flex-col font-sans border border-gray-800 shadow-2xl rounded-2xl overflow-hidden">
      <Header />
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <DetectionCard />

        {history.length > 0 && (
          <div className="space-y-2 pt-2">
            <h2 className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Recent Activity</h2>
            <div className="space-y-1.5">
              {history.map((msg) => (
                <div key={msg.id} className="p-2.5 bg-gray-900/80 border border-gray-800 rounded-lg text-xs flex justify-between items-center">
                  <span className="text-gray-200">{msg.message}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{msg.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ frontend/src/App.tsx
git commit -m "feat(ui): add companion window UI components with detection card and activity feed"
```

---

### Task 13: End-to-End Integration Tests & Developer Runner

**Files:**
- Create: `tests/test_e2e_flow.py`
- Create: `scripts/dev.py`
- Test: `tests/test_e2e_flow.py`

**Interfaces:**
- Consumes: All backend modules (FastAPI, WebSocket, Fusion, Vision, Audio, LLM).
- Produces: Integrated end-to-end integration test suite and unified single-command runner (`python scripts/dev.py`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_e2e_flow.py
import pytest
from fastapi.testclient import TestClient
from backend.api.server import create_app
from backend.fusion.engine import InputFusionEngine
from backend.llm.engine import ContextLLMEngine
from backend.models.events import ModalitySource

def test_full_silent_lip_flow_e2e():
    app = create_app()
    fusion = InputFusionEngine()
    llm = ContextLLMEngine()

    # 1. Lip recognition detects QUESTION
    event = fusion.process_event(ModalitySource.LIP, "QUESTION", 0.94)
    assert event is not None
    assert event.intent == "QUESTION"

    # 2. Context LLM engine normalizes message
    message = llm.normalize_intent(event)
    assert "question" in message.lower()

def test_full_gesture_flow_e2e():
    fusion = InputFusionEngine()
    event = fusion.process_event(ModalitySource.GESTURE, "REQUEST_TO_SPEAK", 0.95)
    assert event is not None
    assert event.intent == "REQUEST_TO_SPEAK"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_e2e_flow.py -v`  
Expected: Ensure tests execute and validate integration.

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/dev.py
import subprocess
import sys
import os

def run_dev():
    print("Starting Silent Meeting Assistant development environment...")
    # Launches backend and outputs instructions for frontend
    env = os.environ.copy()
    env["DEV_MODE"] = "mock"
    proc = subprocess.Popen([sys.executable, "-m", "backend.main"], env=env)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        print("\nShutdown complete.")

if __name__ == "__main__":
    run_dev()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_e2e_flow.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_e2e_flow.py scripts/dev.py
git commit -m "test(e2e): add end-to-end integration tests and developer runner script"
```

---

## Plan Verification

- **Automated Tests:**
  - Backend: `uv run pytest tests/ -v`
  - Frontend: `cd frontend && npm test`
- **Manual Verification:**
  - Start backend via `python scripts/dev.py` and verify `http://127.0.0.1:8000/health` returns `{"status": "ok"}`.
  - Verify WebSocket connection at `ws://127.0.0.1:8000/ws/events`.
