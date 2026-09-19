# Silent Meeting Assistant — Specification

**Version:** 1.0.0  
**Date:** 2026-09-19  
**Status:** Approved for Implementation

---

## 1. Executive Summary & Goals

The **Silent Meeting Assistant** is a real-time, local-first multimodal companion application that runs alongside video meeting platforms (Google Meet, Zoom, Microsoft Teams). It allows users to communicate naturally through speech, silent lip movements, hand gestures, and controlled signs, converting all inputs into a unified communication stream and contextualizing them with an LLM into meeting-ready text or synthesized speech.

### Core Objectives
1. **Multimodal Accessibility**: Enable seamless participation whether the user speaks verbally, mouths words silently, or signals via gestures.
2. **Controlled Silent Vocabulary**: Avoid universal visual speech recognition complexity by focusing on high-accuracy classification of a controlled vocabulary.
3. **Local-First Privacy**: Run OpenCV and MediaPipe landmark extraction locally; never stream raw camera frames to cloud APIs.
4. **Interchangeable Providers**: Keep STT (Deepgram), TTS, and LLM (Gemini/OpenAI) behind strict abstract interfaces.
5. **Deterministic User Control**: Distinguish between *Detected* and *Sent*, requiring explicit or configurable auto-dispatch with debounce and cancel safeguards.

---

## 2. System Architecture

```text
                  +----------------------------------------------+
                  |                 USER / SENSORS               |
                  +----------------------+-----------------------+
                                         |
                       +-----------------+-----------------+
                       | (Audio Stream)                    | (Video Frames)
                       v                                   v
             +--------------------+              +--------------------+
             | Microphone Capture |              |   OpenCV Capture   |
             +---------+----------+              +---------+----------+
                       |                                   |
                       v                                   v
             +--------------------+              +--------------------+
             | SpeechSTT Provider |              | MediaPipe Pipeline |
             | (Deepgram / Mock)  |              | (FaceLips + Hands) |
             +---------+----------+              +---------+----------+
                       |                                   |
                       |                          +--------+--------+
                       |                          |                 |
                       |                          v                 v
                       |                   +-------------+   +-------------+
                       |                   |  Lip Model  |   |Gesture Model|
                       |                   | (GRU Seq)   |   | (Landmarks) |
                       |                   +------+------+   +------+------+
                       |                          |                 |
                       +-------------------+------+-----------------+
                                           |
                                           v
                              +-------------------------+
                              |    Input Fusion Engine   |
                              | (Debounce, Priority,    |
                              |  Confidence Filtering)  |
                              +------------+------------+
                                           |
                                           v
                              +-------------------------+
                              |   Context & LLM Engine  |
                              | (Meeting transcript,    |
                              |  intent normalization)  |
                              +------------+------------+
                                           |
                                           v
                              +-------------------------+
                              |    WebSocket Server     |
                              |   (FastAPI Event Bus)   |
                              +------------+------------+
                                           |
                                           v
                              +-------------------------+
                              |  Frontend Companion UI  |
                              |   (React + TypeScript)  |
                              +-------------------------+
```

---

## 3. Data Contracts & Event Protocol

All recognition sources produce a standardized `CommunicationEvent` before arriving at the Context and LLM layers.

### 3.1 Communication Event Schema
```json
{
  "id": "evt_01J8ABC123XYZ",
  "type": "communication_event",
  "source": "lip",
  "intent": "I_HAVE_A_QUESTION",
  "raw_text": "I have a question",
  "confidence": 0.93,
  "timestamp": 1726723200.123,
  "metadata": {
    "fps": 30.0,
    "landmarks_detected": true
  }
}
```

- `source`: `"speech"` | `"lip"` | `"gesture"` | `"system"`
- `intent`: Canonical uppercase command key (e.g. `REQUEST_TO_SPEAK`, `YES`, `NO`, `FREEFORM_SPEECH`)
- `raw_text`: Direct translation or transcription
- `confidence`: Floating-point scalar `[0.0, 1.0]`

### 3.2 WebSocket Wire Protocol
The backend exposes `ws://127.0.0.1:8000/ws/events`. Messages are JSON envelopes:

```json
{
  "event": "prediction_update" | "speech_interim" | "speech_final" | "event_detected" | "message_staged" | "message_dispatched" | "system_status" | "error",
  "data": { ... },
  "timestamp": 1726723200.123
}
```

Client commands to server:
- `{"action": "set_mode", "mode": "AUTO" | "VOICE" | "SILENT"}`
- `{"action": "confirm_message", "event_id": "evt_..."}`
- `{"action": "cancel_message", "event_id": "evt_..."}`
- `{"action": "update_context", "transcript_snippet": "..."}`

---

## 4. Controlled Command Vocabulary & Mapping

The MVP supports an initial registry of 11 controlled actions across 3 modalities:

| Intent ID | Display Text / Template | Supported Modalities | Gesture Trigger / Lip Signature |
|:---|:---|:---|:---|
| `YES` | "Yes, I agree." | Gesture, Lip, Speech | Thumbs Up / "Yes" |
| `NO` | "No, I disagree." | Gesture, Lip, Speech | Thumbs Down / "No" |
| `HELP` | "I need assistance." | Lip, Speech | "Help" |
| `STOP` | "Please pause or stop here." | Gesture, Lip, Speech | Open Palm facing camera / "Stop" |
| `THANK_YOU` | "Thank you." | Lip, Speech | "Thank you" |
| `REQUEST_TO_SPEAK` | "I would like to speak." | Gesture, Lip, Speech | Raised Hand / "I want to speak" |
| `QUESTION` | "I have a question." | Lip, Speech | "I have a question" |
| `PLEASE_REPEAT` | "Could you please repeat that?" | Lip, Speech | "Please repeat" |
| `NEXT_TOPIC` | "Let's move to the next topic." | Lip, Speech | "Next topic" |
| `AGREE` | "I agree with this point." | Gesture, Lip, Speech | Nodding / "Agree" |
| `DISAGREE` | "I have concerns regarding this." | Gesture, Lip, Speech | Head shake / "Disagree" |

---

## 5. Input Pipeline Specifications

### 5.1 Vision Pipeline (OpenCV + MediaPipe)
- **Frame Ingestion**: OpenCV captures webcam at 640x480 resolution, 30 FPS.
- **MediaPipe Hands**: Extracts 21 3D landmarks per hand.
  - Normalization: Coordinates centered at wrist landmark (index 0) and scaled by palm size.
  - Classification: Geometric heuristics + rule-based joint-angle classifier for high-precision, low-latency zero-shot recognition.
- **MediaPipe Face Landmarker**: Extracts 468/478 facial landmarks.
  - Mouth ROI: 40 inner/outer lip landmarks extracted and normalized relative to inter-ocular distance.
  - Temporal Buffer: Rolling window of $T=24$ frames (0.8 seconds at 30 FPS) with shape $(24, 80)$.

### 5.2 Lip Classification Architecture (PyTorch GRU)
- **Input**: Temporal tensor `(batch_size, 24, 80)` representing normalized `(x, y)` lip coordinates.
- **Model**:
  - Layer 1: Bidirectional GRU (`input_size=80`, `hidden_size=64`, `num_layers=2`, `dropout=0.2`).
  - Layer 2: Linear projection (`128 -> 64`) + ReLU + Dropout.
  - Layer 3: Classifier (`64 -> num_classes`) + LogSoftmax.
- **Inference Latency Target**: $< 15$ ms per evaluation on CPU.
- **Bootstrap Artifacts**: Synthetic dataset generator + baseline checkpoint included in repo to ensure immediate testability and runnable status before recording custom samples.

### 5.3 Audio & STT Pipeline
- **Abstraction**: `BaseSTTProvider` with `start_stream()`, `send_audio(chunk)`, and callback event emission.
- **Deepgram Implementation**: Streaming WebSocket client consuming 16kHz linear PCM audio chunks, emitting interim transcripts and finalized utterances.
- **Mock Implementation**: Deterministic audio provider simulating speech utterances for development and CI testing without external credentials.

### 5.4 Input Fusion & Debouncing
- **Confidence Gate**: Predictions with confidence $< 0.70$ are discarded. Predictions between $0.70$ and $0.85$ require 3 consecutive frames of agreement.
- **Cooldown Interval**: A triggered intent imposes a 1.5-second cooldown on the same intent to prevent double-firing.
- **Priority Resolution**:
  - `FREEFORM_SPEECH` supersedes simultaneous gestures unless gesture is `STOP`.
  - Simultaneous `REQUEST_TO_SPEAK` (Gesture) + `QUESTION` (Lip) fuses into unified intent `QUESTION_REQUEST`.

### 5.5 Context & LLM Normalization
- **Role**: Expands short intents into polite, context-aware meeting dialogue using recent transcript context.
- **Guardrails**: Temperature $\le 0.3$. Prompt forbids introducing new factual claims.
- **Fallback**: If LLM is unreachable or disabled, default template string is used directly.

---

## 6. Frontend Companion UI

- **Framework**: React 18 / Vite / TypeScript / Tailwind CSS.
- **Display Modes**: Compact floating widget / companion window.
- **Key UI Elements**:
  1. **Status Header**: Modality status indicators (Camera ●, Mic ●, Mode: AUTO/VOICE/SILENT).
  2. **Active Recognition Card**: Real-time intent banner showing source icon (👄 Lip, ✋ Gesture, 🎙️ Speech), confidence score meter, and staged message.
  3. **Action Controls**: Quick-action buttons: `[Confirm / Send]`, `[Cancel]`, `[Regenerate via LLM]`.
  4. **Recent Activity Feed**: Chronological list of confirmed and dispatched messages.
  5. **Meeting Context Drawer**: Collapsible view showing recent meeting context snippets.

---

## 7. Operating Modes

1. **Mock Mode (`DEV_MODE=mock`)**:
   Runs entirely without camera, microphone, or external API keys. Synthesizes vision and audio events for rapid UI/flow iteration and automated tests.
2. **Local Vision Mode (`DEV_MODE=local_vision`)**:
   Runs OpenCV + MediaPipe + local PyTorch models + local mock STT. No cloud API keys required.
3. **Production Mode (`DEV_MODE=production`)**:
   Full live camera, live microphone, Deepgram live STT, and LLM intent contextualization.

---

## 8. Privacy, Security & Non-Functional Requirements

- **Local Vision Execution**: No video or landmark data is ever serialized or transmitted over external networks.
- **Zero Persistent Media**: No raw audio or video files are written to disk during regular operation.
- **Credential Safety**: All API keys (`DEEPGRAM_API_KEY`, `GEMINI_API_KEY`) reside strictly in backend `.env` variables and are never transmitted to client bundles.
- **Latency Budget**: End-to-end recognition-to-display latency $< 250$ ms for gestures and lips; interim speech $< 300$ ms.
