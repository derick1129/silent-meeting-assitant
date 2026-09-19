# Hands-Free Camera & Zero-Latency AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable automatic hands-free physical gesture recognition via an in-browser camera stream and eliminate UI latency using two-phase immediate staging and background Gemini refinement.

**Architecture:** The backend orchestrator immediately emits raw template messages over WebSocket upon gesture detection before dispatching asynchronous Gemini refinement tasks. The React companion mounts a MediaPipe Hands WebRTC camera feed that tracks physical hand landmarks, classifies gestures at 30 FPS, and auto-stages messages without user clicks.

**Tech Stack:** React 18, TypeScript, `@mediapipe/hands`, `@mediapipe/camera_utils`, FastAPI, WebSockets, Python 3.12, Pytest, Vitest.

---

### Task 1: Backend Zero-Latency Staging & Asynchronous Gemini Refinement

**Files:**
- Modify: `backend/orchestrator.py`
- Test: `tests/test_orchestrator.py`

**Interfaces:**
- Produces: Immediate `message_staged` broadcast followed by asynchronous `message_refined` broadcast.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update `backend/orchestrator.py`**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**

---

### Task 2: Frontend Gesture Classifier & Refinement Store Support

**Files:**
- Create: `frontend/src/utils/gestureClassifier.ts`
- Modify: `frontend/src/store/useAssistantStore.ts`
- Modify: `frontend/src/hooks/useWebSocket.ts`
- Test: `frontend/src/utils/__tests__/gestureClassifier.test.ts`

**Interfaces:**
- Produces: In-browser 0ms geometric gesture classification + `refineStagedMessage(text)` in Zustand store.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `gestureClassifier.ts` and store update**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**

---

### Task 3: In-Browser Hands-Free Camera Feed Component

**Files:**
- Create: `frontend/src/components/CameraFeed.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/__tests__/CameraFeed.test.tsx`

**Interfaces:**
- Produces: `<CameraFeed />` with WebRTC video element, MediaPipe Hands tracking loop, landmark overlay canvas, and camera toggle.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `CameraFeed.tsx` and UI integration**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit**
