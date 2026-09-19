# Pretrained Visual Speech Recognition Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the untrained lip GRU path with an optional local Hugging Face visual-speech-recognition provider that reads short mouth-video clips, maps recognized text to controlled meeting intents, and preserves the existing instant geometric lip fallback.

**Architecture:** MediaPipe FaceMesh remains in the browser for local face/mouth tracking and instant shape-based commands. A deliberate “Read silent phrase” capture sends a short WebM clip only to the local FastAPI backend, where a lazily loaded `MahmoodAnaam/MSP-VSR` provider performs video-to-text inference; the backend maps the text to a controlled intent and emits the existing staged-message event. If the model is disabled, unavailable, low-confidence, or the clip is invalid, the existing geometric classifier continues to work and the UI reports the failure without staging a false command.

**Tech Stack:** Python 3.12, FastAPI, PyTorch, Hugging Face Transformers, PyAV, React 18, TypeScript, MediaPipe FaceMesh, WebSocket events, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-19-silent-meeting-assistant-spec.md`

## Global Constraints

- “Local Vision Execution”: no video or landmark data is ever serialized or transmitted over external networks; the VSR clip may be sent only to the local FastAPI process and must be deleted immediately after inference.
- “Zero Persistent Media”: no raw audio or video files are written to disk during regular operation; any decoder scratch file must be created in a temporary context and removed before the request returns.
- “Controlled Silent Vocabulary”: use VSR to recognize a bounded set of English commands and map unknown text to `None`; do not present arbitrary low-confidence transcription as a meeting message.
- “Deterministic User Control”: VSR results are detected and staged, but are not copied to the meeting until the existing explicit confirmation action is used.
- Keep the current gesture and geometric-lip path under the existing sub-250 ms interaction target; pretrained VSR is an opt-in capture path with a separate seconds-scale latency indicator.
- Keep API keys in backend environment variables and do not expose Hugging Face credentials or model-loading configuration in the frontend bundle.
- Load custom model code only from a pinned Hugging Face revision configured in the backend; never accept a model identifier or revision from a browser request.
- Keep the current default `DEV_MODE=mock` behavior working without downloading a model or requiring Transformers, PyAV, a GPU, or network access.

## Review Focus

- A malformed, oversized, or non-video upload must return a stable 4xx response and must not create a staged message; test this in the API task.
- A missing model dependency, disabled VSR setting, or failed model load must leave gesture/geometric-lip recognition usable; test this in the provider and API tasks.
- Unknown, ambiguous, empty, or low-confidence VSR text must map to no intent rather than a random command; test this in the intent-mapping task.
- A user who records fewer frames, stops early, denies camera permission, or has no detected face must see a recoverable UI state and may retry; test this in the frontend capture task.
- Temporary video material must not remain after inference, including provider exceptions; test this with a temporary-directory assertion in the provider task.

---

## File and Interface Map

**Backend model boundary**

- Create `backend/vsr/__init__.py`: package export boundary.
- Create `backend/vsr/types.py`: `VSRPrediction` and `VSRProvider` contracts.
- Create `backend/vsr/msp_provider.py`: lazy Hugging Face/Transformers loader and clip inference implementation.
- Create `backend/vsr/intent_mapper.py`: deterministic text-to-intent mapping for the controlled vocabulary.
- Modify `backend/config.py`: VSR enablement, model ID, pinned revision, device, clip limits, and confidence settings.
- Modify `backend/pyproject.toml`: optional runtime dependencies needed by the local provider.

**Backend integration boundary**

- Modify `backend/api/server.py`: local `POST /api/vsr/predict` endpoint, provider injection for tests, request validation, and staged event emission.
- Modify `backend/orchestrator.py`: add a VSR-result method that creates a normal `CommunicationEvent` with recognized text in metadata and the mapped command template as `raw_text`.
- Modify `backend/fusion/engine.py`: accept an optional recognized-text override while retaining command registry templates and existing debounce rules.

**Frontend capture boundary**

- Create `frontend/src/hooks/useSilentPhraseCapture.ts`: MediaRecorder lifecycle, clip-size/time limits, local API request, retry/reset states, and typed response handling.
- Modify `frontend/src/components/CameraFeed.tsx`: add an opt-in capture control and provide the active webcam stream to the capture hook without opening a second camera stream.
- Modify `frontend/src/App.tsx`: pass the VSR result into the existing assistant staging flow and display capture status.
- Modify `frontend/src/types.ts`: typed VSR prediction and capture-state contracts.

**Tests and documentation**

- Create `tests/test_vsr_provider.py`: provider contract, lazy loading, decoding, cleanup, and failure behavior.
- Create `tests/test_vsr_intent_mapper.py`: aliases, normalization, unknown text, and confidence gates.
- Modify `tests/test_api_server.py`: endpoint validation, provider injection, and staged event integration.
- Create `frontend/src/hooks/__tests__/useSilentPhraseCapture.test.ts`: MediaRecorder, request, retry, and failure behavior.
- Modify `frontend/src/components/__tests__/CameraFeed.test.tsx`: capture control and disabled states.
- Modify `README.md`: setup, model license, offline/mock behavior, and realistic latency/accuracy expectations.
- Modify `intent/00-audit.md`: replace stale claims that FaceMesh is unwired and state that the new VSR provider is optional and clip-based.

## Interfaces

The implementation must use these exact boundaries:

```python
# backend/vsr/types.py
class VSRPrediction(BaseModel):
    text: str
    intent: str | None
    confidence: float
    latency_ms: float
    model_id: str

class VSRProvider(Protocol):
    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        ...
```

```python
# backend/vsr/intent_mapper.py
def map_text_to_intent(text: str, minimum_confidence: float = 0.80) -> tuple[str | None, float]:
    ...
```

```python
# backend/orchestrator.py
def process_vsr_prediction(self, prediction: VSRPrediction) -> str | None:
    ...
```

```text
POST /api/vsr/predict
Content-Type: video/webm
Body: raw short video clip
Response: {"text": str, "intent": str | null, "confidence": float, "latency_ms": float, "model_id": str}
```

### Task 1: Add the VSR provider contract and configuration

**Files:**
- Create: `backend/vsr/__init__.py`
- Create: `backend/vsr/types.py`
- Create: `backend/vsr/msp_provider.py`
- Modify: `backend/config.py`
- Modify: `backend/pyproject.toml`
- Create: `tests/test_vsr_provider.py`

**Interfaces:**
- Consumes: raw bytes from the local API and configuration from `Settings`.
- Produces: `VSRPrediction` through `MSPVSRProvider.predict(video_bytes, filename)`; no model import at module import time.

- [ ] **Step 1: Write the failing provider tests**

```python
def test_provider_returns_prediction_from_fake_processor_and_model():
    provider = MSPVSRProvider(
        model_id="test/model",
        revision="test-revision",
        processor=FakeProcessor(),
        model=FakeModel(),
    )
    result = provider.predict(b"valid-video-bytes", "clip.webm")
    assert result.text == "yes"
    assert result.model_id == "test/model"
    assert 0.0 <= result.confidence <= 1.0

def test_provider_removes_decoder_scratch_file_after_success(tmp_path, monkeypatch):
    provider = MSPVSRProvider(
        model_id="test/model",
        revision="test-revision",
        processor=FakeProcessor(),
        model=FakeModel(),
        temp_dir=tmp_path,
    )
    provider.predict(b"valid-video-bytes", "clip.webm")
    assert list(tmp_path.iterdir()) == []

def test_disabled_provider_fails_before_loading_model():
    provider = MSPVSRProvider(model_id="test/model", enabled=False)
    with pytest.raises(VSRError, match="disabled"):
        provider.predict(b"valid-video-bytes")
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_vsr_provider.py -q`

Expected: FAIL because `VSRPrediction`, `MSPVSRProvider`, `VSRError`, and the fake-provider seams do not exist.

- [ ] **Step 3: Implement the provider boundary and lazy model loading**

Implement `MSPVSRProvider` with these concrete behaviors:

```python
class MSPVSRProvider:
    def __init__(self, model_id: str, revision: str | None = None,
                 enabled: bool = False, device: str = "cpu",
                 processor=None, model=None, temp_dir: Path | None = None):
        ...

    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        ...
```

Write bytes to a uniquely named file inside `tempfile.TemporaryDirectory`, reject empty input and extensions other than `.webm`, `.mp4`, or `.mov`, call `AutoProcessor.from_pretrained(model_id, revision=revision, trust_remote_code=True)` and `AutoModelForCTC.from_pretrained(...)` only when injected objects are absent, run `processor(videos=temporary_path, return_tensors="pt")`, run inference under `torch.inference_mode()`, decode with the processor tokenizer, and compute confidence as the mean maximum softmax probability over non-padding timesteps. Raise `VSRError` with stable messages for disabled mode, empty input, model-load failures, decoding failures, and empty transcription. Always clean the temporary directory in `finally`.

Add the dependency declarations `transformers`, `safetensors`, and `av` to `backend/pyproject.toml` without importing them from mock-mode code paths. Add settings with these defaults:

```python
vsr_enabled: bool = False
vsr_model_id: str = "MahmoodAnaam/MSP-VSR"
vsr_model_revision: str = "main"
vsr_device: str = "cpu"
vsr_max_clip_bytes: int = 8_000_000
vsr_min_confidence: float = 0.80
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_vsr_provider.py -q`

Expected: PASS, including the temporary-file cleanup assertion, without downloading the Hugging Face model.

- [ ] **Step 5: Commit the provider boundary**

```bash
git add backend/vsr backend/config.py backend/pyproject.toml tests/test_vsr_provider.py
git commit -m "feat: add local pretrained VSR provider boundary"
```

### Task 2: Map VSR text to controlled meeting intents

**Files:**
- Create: `backend/vsr/intent_mapper.py`
- Create: `tests/test_vsr_intent_mapper.py`

**Interfaces:**
- Consumes: normalized text and a minimum confidence threshold.
- Produces: `(intent, confidence)` where intent is one of the existing command registry keys or `None`.

- [ ] **Step 1: Write the failing mapping tests**

```python
@pytest.mark.parametrize("text,expected", [
    ("Yes, I agree", "YES"),
    ("can you repeat that please", "PLEASE_REPEAT"),
    ("I have a question about this", "QUESTION"),
    ("please stop here", "STOP"),
])
def test_common_phrases_map_to_controlled_intents(text, expected):
    intent, confidence = map_text_to_intent(text)
    assert intent == expected
    assert confidence >= 0.80

def test_unknown_text_is_not_converted_to_a_random_intent():
    intent, confidence = map_text_to_intent("the quarterly revenue forecast is updated")
    assert intent is None
    assert confidence == 0.0

def test_empty_text_is_rejected():
    assert map_text_to_intent("") == (None, 0.0)
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_vsr_intent_mapper.py -q`

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Implement deterministic normalization and aliases**

Normalize lowercase text by replacing punctuation with spaces and collapsing whitespace. Match aliases using a fixed ordered table so specific phrases win before single-word phrases:

```python
INTENT_ALIASES = {
    "PLEASE_REPEAT": ("please repeat", "repeat that", "say that again"),
    "REQUEST_TO_SPEAK": ("i want to speak", "let me speak", "request to speak"),
    "THANK_YOU": ("thank you", "thanks"),
    "QUESTION": ("i have a question", "can i ask a question", "question"),
    "NEXT_TOPIC": ("next topic", "move on"),
    "DISAGREE": ("i disagree", "no i disagree", "i have concerns"),
    "AGREE": ("i agree", "agree with this"),
    "HELP": ("help", "i need assistance"),
    "STOP": ("stop", "please stop", "pause"),
    "YES": ("yes", "yeah", "i agree"),
    "NO": ("no", "no i disagree"),
}
```

Return `None` for empty or unmatched text. Use `difflib.SequenceMatcher` only for aliases with at least four characters and return `None` when the best score is below `minimum_confidence`; do not use an LLM for this safety-critical classification step.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_vsr_intent_mapper.py -q`

Expected: PASS for aliases, punctuation, unknown text, and empty input.

- [ ] **Step 5: Commit the intent mapper**

```bash
git add backend/vsr/intent_mapper.py tests/test_vsr_intent_mapper.py
git commit -m "feat: map visual speech text to controlled intents"
```

### Task 3: Integrate VSR prediction with FastAPI and the orchestrator

**Files:**
- Modify: `backend/fusion/engine.py`
- Modify: `backend/orchestrator.py`
- Modify: `backend/api/server.py`
- Modify: `tests/test_api_server.py`
- Modify: `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `VSRPrediction` from Task 1 and `map_text_to_intent()` from Task 2.
- Produces: `POST /api/vsr/predict`; a normal `message_staged` event; no second independent GRU emission for VSR clips.

- [ ] **Step 1: Write failing orchestration and API tests**

```python
def test_process_vsr_prediction_stages_command_and_preserves_recognized_text():
    broadcasts = []
    orchestrator = AssistantOrchestrator(on_broadcast=lambda event, data: broadcasts.append((event, data)))
    prediction = VSRPrediction(
        text="can you repeat that",
        intent="PLEASE_REPEAT",
        confidence=0.91,
        latency_ms=420.0,
        model_id="test/model",
    )
    result = orchestrator.process_vsr_prediction(prediction)
    assert result == "Could you please repeat that?"
    assert broadcasts[-1][0] == "message_staged"
    assert broadcasts[-1][1]["event"]["metadata"]["recognized_text"] == "can you repeat that"

def test_vsr_endpoint_rejects_oversized_clip():
    app = create_app(vsr_provider=FakeVSRProvider(), settings_override=Settings(vsr_max_clip_bytes=4))
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"12345",
        headers={"content-type": "video/webm"},
    )
    assert response.status_code == 413
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_api_server.py tests/test_orchestrator.py -k vsr -q`

Expected: FAIL because the provider injection, endpoint, and orchestrator method do not exist.

- [ ] **Step 3: Implement the event and endpoint integration**

Extend `InputFusionEngine.process_event()` with an optional `raw_text_override: str | None = None`. Keep the command registry template as the default, but use the override only when it is non-empty and the intent is recognized. In `AssistantOrchestrator`, add:

```python
def process_vsr_prediction(self, prediction: VSRPrediction) -> str | None:
    if not prediction.intent or prediction.confidence < self.settings.vsr_min_confidence:
        return None
    return self.process_intent(
        source=ModalitySource.LIP,
        intent=prediction.intent,
        confidence=prediction.confidence,
        recognized_text=prediction.text,
    )
```

Store `recognized_text`, `model_id`, and `latency_ms` in `CommunicationEvent.metadata`; keep `raw_text` equal to the customized command template so existing command customization remains authoritative.

Update `create_app()` to accept `vsr_provider: VSRProvider | None = None` and `settings_override: Settings | None = None`. Construct `MSPVSRProvider` only when no injected provider is supplied. Add a raw-body endpoint:

```python
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
    prediction = provider.predict(body, request.headers.get("x-filename", "clip.webm"))
    active_orchestrator.process_vsr_prediction(prediction)
    return prediction.model_dump()
```

Map `VSRError` to status 503 for disabled/unavailable model states and 422 for invalid clips. Never swallow provider errors as successful predictions. Remove the normal-path backend `process_lip_landmarks()` GRU emission when the frontend is operating in VSR mode, so a single captured phrase cannot produce both a random GRU command and a VSR command.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_api_server.py tests/test_orchestrator.py -k vsr -q`

Expected: PASS for successful staging, metadata, content-type validation, body-size validation, disabled provider behavior, and provider failure responses.

- [ ] **Step 5: Commit the backend integration**

```bash
git add backend/fusion/engine.py backend/orchestrator.py backend/api/server.py tests/test_api_server.py tests/test_orchestrator.py
git commit -m "feat: expose local VSR prediction endpoint"
```

### Task 4: Add controlled silent-phrase capture to the frontend

**Files:**
- Create: `frontend/src/hooks/useSilentPhraseCapture.ts`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/CameraFeed.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/hooks/__tests__/useSilentPhraseCapture.test.ts`
- Modify: `frontend/src/components/__tests__/CameraFeed.test.tsx`

**Interfaces:**
- Consumes: the existing `HTMLVideoElement` stream and local `/api/vsr/predict` endpoint.
- Produces: `useSilentPhraseCapture(videoRef)` with `startCapture()`, `stopCapture()`, `reset()`, and `{state, error, elapsedMs, prediction}`.

- [ ] **Step 1: Write failing hook tests**

```typescript
it('records a short clip and returns the backend prediction', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      text: 'yes',
      intent: 'YES',
      confidence: 0.92,
      latency_ms: 410,
      model_id: 'MahmoodAnaam/MSP-VSR',
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useSilentPhraseCapture(videoRef));
  act(() => result.current.startCapture());
  mediaRecorder.emitData(new Blob(['video'], { type: 'video/webm' }));
  await act(async () => result.current.stopCapture());
  expect(fetchMock).toHaveBeenCalledWith('/api/vsr/predict', expect.objectContaining({ method: 'POST' }));
  expect(result.current.prediction?.intent).toBe('YES');
});

it('returns to idle after a failed request and allows retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend unavailable')));
  const { result } = renderHook(() => useSilentPhraseCapture(videoRef));
  act(() => result.current.startCapture());
  await act(async () => result.current.stopCapture());
  expect(result.current.state).toBe('error');
  expect(result.current.error).toContain('backend unavailable');
  act(() => result.current.reset());
  expect(result.current.state).toBe('idle');
});
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd frontend && npm test -- --run src/hooks/__tests__/useSilentPhraseCapture.test.ts`

Expected: FAIL because the hook and capture state types do not exist.

- [ ] **Step 3: Implement MediaRecorder capture with one existing camera stream**

Define:

```typescript
export type SilentPhraseCaptureState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export interface VSRPrediction {
  text: string;
  intent: string | null;
  confidence: number;
  latency_ms: number;
  model_id: string;
}
```

Use the active `videoRef.current.srcObject` as the `MediaRecorder` source; never call `getUserMedia()` again. Select `video/webm;codecs=vp8,opus` when supported and fall back to `video/webm`. Stop automatically at 4 seconds, collect `Blob` chunks, reject clips with zero chunks, POST the resulting Blob to `/api/vsr/predict` with `Content-Type: video/webm` and `X-Filename: silent-phrase.webm`, and expose the returned typed prediction. Disable capture when no active stream exists. Clear recorder/chunks/timers on unmount and on retry. Show the backend latency separately from the instant geometric detector so the UI does not claim zero-latency VSR.

Add a `Read silent phrase` button to `CameraFeed.tsx` next to the existing camera controls. The button must be disabled while recording or processing, show `Recording…` and `Reading…` states, and show a retry action when state is `error`. On successful prediction with a non-null intent, the backend has already emitted `message_staged`; the hook should not create a second local event.

- [ ] **Step 4: Run focused frontend tests and the production build**

Run: `cd frontend && npm test -- --run src/hooks/__tests__/useSilentPhraseCapture.test.ts src/components/__tests__/CameraFeed.test.tsx && npm run build`

Expected: PASS with the new capture tests and a clean TypeScript/Vite build.

- [ ] **Step 5: Commit the frontend capture flow**

```bash
git add frontend/src/hooks/useSilentPhraseCapture.ts frontend/src/hooks/__tests__/useSilentPhraseCapture.test.ts frontend/src/types.ts frontend/src/components/CameraFeed.tsx frontend/src/components/__tests__/CameraFeed.test.tsx frontend/src/App.tsx
git commit -m "feat: add controlled silent phrase capture"
```

### Task 5: Document model setup, privacy, and verification

**Files:**
- Modify: `README.md`
- Modify: `intent/00-audit.md`
- Modify: `backend/README.md`
- Create: `tests/test_vsr_e2e.py`

**Interfaces:**
- Consumes: the completed provider, endpoint, and frontend capture contracts.
- Produces: reproducible local setup instructions, a mock end-to-end test, and accurate claims about model limits and licensing.

- [ ] **Step 1: Write the failing mock end-to-end test**

```python
def test_vsr_clip_stages_customized_command_without_external_network():
    provider = FakeVSRProvider(
        VSRPrediction(
            text="yes",
            intent="YES",
            confidence=0.92,
            latency_ms=2.0,
            model_id="test/model",
        )
    )
    app = create_app(vsr_provider=provider, settings_override=Settings(vsr_enabled=True))
    response = TestClient(app).post(
        "/api/vsr/predict",
        content=b"fake-webm",
        headers={"content-type": "video/webm"},
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "YES"
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `PYTHONPATH=. .venv/bin/pytest tests/test_vsr_e2e.py -q`

Expected: FAIL until the completed endpoint and fake-provider seam are present.

- [ ] **Step 3: Add the mock end-to-end test and documentation**

Document these exact setup paths:

```bash
pip install -e backend
export VSR_ENABLED=true
export VSR_MODEL_ID=MahmoodAnaam/MSP-VSR
export VSR_MODEL_REVISION=main
python scripts/dev.py
```

Explain that the first real request downloads model weights, that CPU inference is clip-based rather than sub-250 ms, that mock mode never loads the model, and that the model is English-focused with research/demo limitations. Link to the model card and state that the model output is mapped to the controlled command registry rather than treated as unrestricted speech. Update the audit table to distinguish geometric lip commands from pretrained VSR transcription.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest -q
cd frontend && npm test -- --run && npm run build
```

Expected: all backend tests pass, all frontend tests pass, and the production build completes without TypeScript errors.

- [ ] **Step 5: Commit documentation and verification**

```bash
git add README.md backend/README.md intent/00-audit.md tests/test_vsr_e2e.py
git commit -m "docs: document pretrained VSR setup and limitations"
```

## Self-Review Checklist

- Spec coverage: local video processing, controlled vocabulary, explicit confirmation, mock mode, provider abstraction, and privacy constraints are covered by Tasks 1–5.
- Placeholder scan: all steps name concrete files, interfaces, test commands, expected outcomes, or exact implementation behavior; no deferred implementation items are left.
- Type consistency: `VSRPrediction`, `VSRProvider.predict`, `map_text_to_intent`, `process_vsr_prediction`, and `/api/vsr/predict` are defined once and used consistently across tasks.
- Review focus coverage: invalid clips and cleanup are tested in Task 1/3, unknown text in Task 2, provider failures in Task 1/3, frontend retry behavior in Task 4, and offline/mock behavior in Task 5.
- Scope decision: this remains one plan because the backend provider, local endpoint, and browser capture are sequentially dependent parts of one VSR feature; gesture recognition and Deepgram are intentionally not reworked here.
