# Live Runtime Wiring Specification

**Feature:** Live Multimodal Pipeline & WebSocket Companion Integration  
**Date:** 2026-09-19  
**Status:** Approved for Implementation  

---

## 1. Goal & Overview

Transform the verified offline models and component libraries into an active, real-time end-to-end companion experience. 

When running alongside Google Meet in the browser, the companion must:
1. Actively connect the React frontend to the backend via WebSocket (`ws://127.0.0.1:8000/ws/events`).
2. Capture live user video in the browser via `navigator.mediaDevices.getUserMedia` with seamless macOS/Chrome permissions.
3. Process live hand gestures and facial lip movements, routing landmark vectors to the backend.
4. Run the full live pipeline: Landmark Analysis $\to$ Input Fusion & Debouncing $\to$ Live Gemini AI Contextualization $\to$ WebSocket Broadcast $\to$ Reactive UI Staging.
5. Provide automatic clipboard dispatch ("Send to Meeting") so the user can paste (`Cmd+V`) directly into Google Meet or Zoom chat.
6. Provide an interactive Testing Toolbar directly in the UI to trigger/simulate any modality on-demand for rapid demonstration and verification.

---

## 2. Architecture & Data Flow

```text
  +-------------------------------------------------------------+
  |              FRONTEND COMPANION (PORT 5173)                 |
  |                                                             |
  |  +--------------------+         +------------------------+  |
  |  | WebRTC UserMedia   |         | Zustand AssistantStore |  |
  |  | (Camera & Mic)     |         | (Status, Staged, Hist) |  |
  |  +---------+----------+         +-----------^------------+  |
  |            |                                |               |
  |            | Landmarks / Actions            | Events / Staged
  |            v                                | Messages      |
  |  +------------------------------------------+------------+  |
  |  |               useWebSocket Client Hook                |  |
  |  +--------------------------+----------------------------+  |
  +-----------------------------|-------------------------------+
                                | WebSocket (ws://127.0.0.1:8000/ws/events)
                                v
  +-------------------------------------------------------------+
  |                  BACKEND SERVICE (PORT 8000)                |
  |                                                             |
  |  +-------------------------------------------------------+  |
  |  |             AssistantOrchestrator                     |  |
  |  |                                                       |  |
  |  |  [Vision & Gesture]   [Deepgram STT]   [Context Buffer] |
  |  |           |                  |                |       |  |
  |  |           +--------->+<------+                |       |  |
  |  |                      v                        v       |  |
  |  |            [InputFusionEngine] ----> [Gemini Context] |  |
  |  |                                               |       |  |
  |  +-----------------------------------------------+-------+  |
  |                                                  |          |
  |                                                  v          |
  |                                        [WebSocket Broadcast]|
  +-------------------------------------------------------------+
```

---

## 3. Communication Protocol Details

### Client-to-Server Actions:
1. `{"action": "detect_gesture", "landmarks": [...]}`: Passes real-time normalized hand coordinates.
2. `{"action": "simulate_intent", "intent": "QUESTION" | "REQUEST_TO_SPEAK" | "STOP" | "YES" | "NO", "source": "lip" | "gesture"}`: Direct trigger for testing.
3. `{"action": "update_context", "transcript_snippet": "..."}`: Ingests meeting transcript context for Gemini.
4. `{"action": "set_mode", "mode": "AUTO" | "SILENT" | "VOICE"}`: Adjusts active listening mode.

### Server-to-Client Events:
1. `system_status`: Active mode, connection health, and AI readiness.
2. `event_detected`: Raw modality intent and confidence score.
3. `message_staged`: Contextualized Gemini natural-language message ready for user review.
4. `message_dispatched`: Confirmation of message sent/copied.

---

## 4. UI/UX Interaction Design

1. **Live Camera Toggle & Indicator**:
   - Small toggle switch in the companion header to enable/disable camera preview.
   - Video preview rendered in a compact canvas with overlay detection indicators.
2. **Context Input Drawer**:
   - Collapsible panel allowing the user to view or edit the current meeting topic (e.g. *"Discussing database migration to PostgreSQL"*).
3. **Detection Card with Auto-Copy**:
   - When a gesture/lip movement is recognized, card lights up with confidence badge.
   - Clicking **[Send to Meeting]** copies the text to the system clipboard and displays a green *"Copied to Clipboard! Paste in Meet (Cmd+V)"* notification.
4. **Interactive Simulation Bar**:
   - Quick-action buttons allowing immediate verification of gestures without awkward hand positioning during testing.
