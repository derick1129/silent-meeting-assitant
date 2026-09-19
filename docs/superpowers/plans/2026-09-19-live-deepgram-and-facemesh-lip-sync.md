# Live Deepgram Streaming STT & Browser FaceMesh Lip Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement true real-time Deepgram Nova-2 streaming STT audio ingestion and in-browser MediaPipe FaceMesh lip tracking alongside hands-free gesture recognition.

**Architecture:** The browser captures raw 16kHz linear PCM audio and streams chunks over WebSocket to the backend, which forwards them directly to Deepgram's live streaming WebSocket (`nova-2`) to continuously populate the meeting context buffer. Simultaneously, `<CameraFeed />` mounts MediaPipe FaceMesh alongside Hands, extracts 40 lip landmarks at 30 FPS, and streams them to the backend orchestrator's `LipSequenceBuffer` and `LipGRUModel` for multimodal fusion.

**Tech Stack:** Python 3.12, PyTorch, Deepgram SDK 7.9.0, FastAPI, WebSockets, React 18, TypeScript, `@mediapipe/face_mesh`, `@mediapipe/hands`, Vitest, Pytest.

---

### Task 1: Backend Live Deepgram STT Streaming Service

**Files:**
- Modify: `backend/audio/stt.py`
- Modify: `backend/api/server.py`
- Test: `tests/test_audio_stt.py`

**Interfaces:**
- Produces: `DeepgramSTTProvider.process_audio_chunk(chunk: bytes)` sending to `client.send_media(chunk)`, invoking `on_transcript`. WebSocket action `"audio_chunk"`.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement DeepgramSTTProvider streaming and WebSocket audio chunk handler**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**

---

### Task 2: Backend Lip Landmark Ingestion & Inference

**Files:**
- Modify: `backend/orchestrator.py`
- Modify: `backend/api/server.py`
- Test: `tests/test_orchestrator.py`

**Interfaces:**
- Produces: `AssistantOrchestrator.process_lip_landmarks(landmarks)` running `extract_lip_features`, `LipSequenceBuffer`, and `predict_lip_intent`. WebSocket action `"detect_lip"`.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement orchestrator lip processing and server route**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**

---

### Task 3: Frontend Real-Time Audio Streaming Hook

**Files:**
- Create: `frontend/src/hooks/useAudioStreamer.ts`
- Modify: `frontend/src/components/ContextDrawer.tsx`
- Test: `frontend/src/hooks/__tests__/useAudioStreamer.test.ts`

**Interfaces:**
- Produces: `useAudioStreamer` hook converting mic stream to 16kHz 16-bit linear PCM and sending `"audio_chunk"` over WebSocket.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement useAudioStreamer and connect to ContextDrawer**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**

---

### Task 4: Frontend Live MediaPipe FaceMesh & Lip Tracking

**Files:**
- Modify: `frontend/src/components/CameraFeed.tsx`
- Test: `frontend/src/components/__tests__/CameraFeed.test.tsx`

**Interfaces:**
- Produces: Dual tracker in `<CameraFeed />` running Hands and FaceMesh, canvas overlay with lip contour points, and streaming lip landmarks to backend.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement FaceMesh tracking loop and canvas visualization in CameraFeed**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**
