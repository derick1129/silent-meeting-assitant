# Hands-Free Camera & Zero-Latency AI Pipeline Specification

**Date:** 2026-09-19  
**Status:** Approved for Implementation

---

## 1. Problem Statement & User Experience Objectives

### 1.1 Hands-Free Automatic Recognition
Previously, user interaction required clicking a button in the simulation toolbar because no camera capture stream was active in the browser. In this milestone:
- The companion window embeds an active WebRTC video capture loop.
- MediaPipe Hands tracks 21 hand landmarks at 30 FPS.
- Physical gestures (`REQUEST_TO_SPEAK`, `STOP`, `YES`, `NO`) are recognized completely hands-free.

### 1.2 Zero-Latency Instant Feedback
Previously, recognized commands waited ~1 second for Gemini's cloud API response before appearing on the UI. In this milestone:
- **Two-phase delivery**:
  1. *Immediate Phase (0 ms)*: As soon as a gesture is recognized, the base message (e.g. `"I would like to speak."`) is staged and displayed immediately.
  2. *Refinement Phase (Background)*: Gemini contextualizes the intent with the meeting discussion and silently refines the text to the professional contextualized phrasing without blocking the user.

---

## 2. Technical Contracts & Data Flow

### 2.1 Two-Phase WebSocket Events
1. `message_staged`:
   ```json
   {
     "event": "message_staged",
     "data": {
       "event": { "id": "evt_...", "source": "gesture", "intent": "REQUEST_TO_SPEAK" },
       "normalized_text": "I would like to speak.",
       "is_refined": false
     }
   }
   ```
2. `message_refined`:
   ```json
   {
     "event": "message_refined",
     "data": {
       "event_id": "evt_...",
       "refined_text": "I would like to share a few thoughts regarding the database migration, if I may."
     }
   }
   ```

### 2.2 In-Browser MediaPipe Integration
- Capture source: `navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true })`.
- Hand tracker: `@mediapipe/hands` running in WebAssembly.
- Debounce gate: 1.5-second cooldown between emitted gestures to prevent flickering.
