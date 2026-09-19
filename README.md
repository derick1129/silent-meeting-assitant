# 🎙️ Silent Meeting Assistant (AI-Powered Multimodal Meeting Companion)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![MediaPipe](https://img.shields.io/badge/Computer%20Vision-MediaPipe%20WASM-FF6F00?logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![Deepgram](https://img.shields.io/badge/Audio%20STT-Deepgram%20Nova--2-13EF93?logo=deepgram&logoColor=black)](https://deepgram.com/)
[![Gemini](https://img.shields.io/badge/LLM-Google%20Gemini%203.5-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-63%20Passing%20(33%20Pytest%20%2B%2030%20Vitest)-brightgreen)]()

> **Target Problem Statement (🔴 HARD — Silent Meeting Assistant):**  
> *In some situations, people may not be able to speak aloud during a meeting or may prefer to communicate silently. Build an AI-powered silent communication system that uses a webcam to interpret specific facial or hand movements and converts them into text in real time with command customization.*

Silent Meeting Assistant is an ultra-low-latency, privacy-first companion application designed to run alongside active video conferences (Google Meet, Zoom, Microsoft Teams). It enables users to silently participate in meetings using hands-free physical gestures, controlled silent lip movements, and live background meeting transcription.

---

## 🚀 Key Architectural Highlights

- **🔒 Local-First Privacy (0 ms Video Latency):** Video frames from your webcam **never leave your computer**. MediaPipe Hands and MediaPipe FaceMesh execute completely in-browser via WebAssembly (WASM) at 30 FPS.
- **⚡ Two-Phase Staging Architecture:**
  - **Phase 1 (0 ms Instant Staging):** Recognized gestures and lip motions instantly stage pre-configured or customized text locally in the browser with zero perceptible delay.
  - **Phase 2 (~1.1 s Contextual Expansion):** In the background, Google Gemini (via multi-model failover) merges the intent with the active meeting discussion to generate natural, conversation-aware phrasing.
- **🎙️ Live Streaming Audio Pipeline (Deepgram STT):** Streams 16 kHz linear PCM audio buffers directly to Deepgram's `nova-2` model via WebSocket, maintaining a continuous rolling memory of the meeting's live context.
- **👄 Geometric Lip Kinematics & HUD:** Computes the instantaneous **Lip Aspect Ratio (LAR)** across 40 canonical landmarks, classifying controlled silent articulations (`QUESTION`, `STOP`, `AGREE`) with dynamic canvas visual contours and numerical HUD feedback.
- **⚙️ User Command Customization:** Includes a built-in Command Settings Manager to customize phrase templates for any gesture or lip command, add custom commands, and persist configurations across sessions.

---

## 📐 Complete End-to-End System Flow

```mermaid
flowchart TD
    subgraph Inputs["1. Hardware Ingestion Layer"]
        Webcam["Webcam Video Stream<br/>(30 FPS, 640x480)"]
        Mic["Microphone Audio Stream<br/>(Web Audio API)"]
    end

    subgraph Browser["2. Browser Client-Side Processing (0 ms Staging)"]
        WASM_Hands["MediaPipe Hands (WASM)<br/>Extracts 21 3D Hand Points"]
        WASM_Face["MediaPipe FaceMesh (WASM)<br/>Extracts 468 Facial Points"]
        PCM_Conv["Audio Processor<br/>Downsamples to 16kHz Linear16 PCM"]

        Gesture_Class["gestureClassifier.ts<br/>Calculates Finger Extensions<br/>(STOP, REQUEST_TO_SPEAK, YES, NO)"]
        Lip_Extractor["lipExtractor.ts<br/>Filters 40 Lip Landmarks"]
        Lip_Kinematics["lipClassifier.ts (LipKinematicsTracker)<br/>Calculates Lip Aspect Ratio (LAR)<br/>State Machine: OPENING, STOP, PURSED"]

        Canvas_HUD["Canvas Video Overlay<br/>- Indigo Hand Skeleton<br/>- Dynamic Lip Contours (Emerald/Amber)<br/>- Real-Time LAR Metric HUD"]
        Cmd_Store["useCommandStore<br/>(User Custom Phrases & LocalStorage)"]
        Local_Staging["useAssistantStore<br/>⚡ 0 ms Instant Local Staging Card"]
    end

    subgraph Transport["3. Bidirectional WebSocket (/ws/events)"]
        WS_Audio["Action: 'audio_chunk'"]
        WS_Gesture["Action: 'detect_gesture'"]
        WS_Lip["Action: 'detect_lip'"]
        WS_Out["Events: 'message_staged', 'message_refined', 'context_updated'"]
    end

    subgraph Backend["4. Backend Server (FastAPI + Python Orchestrator)"]
        Deepgram["Deepgram Live STT<br/>('nova-2' WebSocket Streaming)"]
        Context_Buffer["Rolling Context Memory<br/>(Last 10 spoken meeting utterances)"]
        Fusion_Engine["InputFusionEngine<br/>Debouncing & Confidence Gates"]
        Gemini_LLM["ContextLLMEngine<br/>(Gemini 3.5 Flash Multi-Model Failover)"]
    end

    subgraph Meeting["5. Meeting Output Layer"]
        Staged_UI["Frontend Detection Card<br/>(Shows Refined Message)"]
        Clipboard["1-Click Clipboard Copy<br/>(Cmd+V into Google Meet / Teams)"]
    end

    %% Audio Flow
    Mic --> PCM_Conv
    PCM_Conv --> WS_Audio
    WS_Audio --> Deepgram
    Deepgram -->|Transcribed Text in ~250ms| Context_Buffer

    %% Video / Gesture Flow
    Webcam --> WASM_Hands
    WASM_Hands --> Gesture_Class
    Gesture_Class --> Canvas_HUD
    Gesture_Class -->|Intent + Cooldown Check| Cmd_Store
    Cmd_Store -->|Customized Phrase| Local_Staging
    Gesture_Class --> WS_Gesture

    %% Video / Lip Flow
    Webcam --> WASM_Face
    WASM_Face --> Lip_Extractor
    Lip_Extractor --> Lip_Kinematics
    Lip_Kinematics --> Canvas_HUD
    Lip_Kinematics -->|Intent Triggered| Cmd_Store
    Lip_Kinematics --> WS_Lip

    %% Backend Fusion & Contextualization
    WS_Gesture --> Fusion_Engine
    WS_Lip --> Fusion_Engine
    Fusion_Engine --> Gemini_LLM
    Context_Buffer -->|Recent Discussion Context| Gemini_LLM
    Gemini_LLM -->|Refined Phrase (~1.1s)| WS_Out
    WS_Out --> Staged_UI
    Local_Staging --> Staged_UI
    Staged_UI --> Clipboard
```

---

## 🛠️ Subsystems & Pipelines

### 1. Live Audio Speech-to-Text (Deepgram STT)
- Captures microphone audio using the Web Audio API.
- Converts floating-point audio into **16 kHz, 16-bit mono linear PCM** buffers streamed every 256 ms over WebSockets.
- Backend streaming client opens a persistent connection to Deepgram's `nova-2` speech model, returning live finalized transcripts in **~250 ms**.
- Transcripts update a rolling 10-utterance context memory buffer used to inform AI generation.

### 2. Physical Gesture Pipeline (MediaPipe Hands)
- 21 canonical 3D hand landmarks are processed at 30 FPS.
- Geometric relative finger-extension heuristics classify:
  - **Open Palm (5 fingers extended):** `STOP` (*"Please pause or stop here."*)
  - **Raised Hand (4 fingers up, thumb folded):** `REQUEST_TO_SPEAK` (*"I would like to speak."*)
  - **Thumbs Up (Thumb pointing up, 4 fingers folded):** `YES` (*"Yes, I agree."*)
  - **Thumbs Down (Thumb pointing down below wrist):** `NO` (*"No, I disagree."*)
- Enforces a 1,500 ms cooldown debounce filter to prevent repeated firings.

### 3. Lip Articulation Kinematics Pipeline (MediaPipe FaceMesh)
- Filters the 40 inner and outer lip landmark indices (`LIP_INDICES`).
- Computes the normalized **Lip Aspect Ratio (LAR)**:
  $$\text{LAR} = \frac{\sqrt{(x_{14} - x_{13})^2 + (y_{14} - y_{13})^2}}{\sqrt{(x_{291} - x_{61})^2 + (y_{291} - y_{61})^2}}$$
- Temporal state machine (`LipKinematicsTracker`) evaluates a 24-frame rolling window (~800 ms):
  - **`QUESTION`**: Rapid transition from closed mouth ($\text{LAR} < 0.16$) to wide articulation ($\text{LAR} \ge 0.28$).
  - **`STOP`**: Sustained wide mouth opening ($\text{LAR} > 0.35$) for $\ge 12$ consecutive frames.
  - **`AGREE`**: Lips compressed/pursed ($\text{LAR} < 0.09$) for $\ge 8$ consecutive frames.
- Renders dynamic canvas visual feedback:
  - 🟢 **Emerald**: Neutral mouth at rest.
  - 🟡 **Glowing Amber**: Mouth opening / articulating.
  - 🔴 **Crimson Red**: Sustained wide opening (`STOP`).
  - 🔵 **Cyan**: Pursed lips (`AGREE`).

### 4. Background Contextualization (Gemini 3.5 Flash)
- Fast multi-model failover across `["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]`.
- Rewrites generic phrases to match what was spoken in the meeting:
  - *Generic intent:* `"QUESTION"` (*"I have a question."*)
  - *With meeting context:* *"I have a quick question about the Q3 budget timeline we just discussed."*
- Generation completes in **~1.1 seconds**.

### 5. Command Customization System
- Accessible via the **`[⚙️ Commands]`** button in the header.
- Users can edit any predefined phrase, add brand-new custom commands, or restore factory defaults.
- Saved automatically in `localStorage` and synced with backend REST endpoints (`POST /api/commands` and `POST /api/commands/reset`).

---

## 📋 Prerequisites & Installation

### Prerequisites
- **Python 3.11+** (Tested on Python 3.12)
- **Node.js 18+** (Tested on Node.js 20 & 26)
- **Google Chrome** (Recommended for WebRTC & WebAssembly SIMD support)
- API Keys:
  - [Google Gemini API Key](https://aistudio.google.com/) (`GEMINI_API_KEY`)
  - [Deepgram API Key](https://console.deepgram.com/) (`DEEPGRAM_API_KEY`)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/silent-meeting-assistant.git
   cd silent-meeting-assistant
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   DEEPGRAM_API_KEY="your-deepgram-api-key-here"
   DEV_MODE="false"
   ```

3. **Install Backend Dependencies:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

---

## 🏃 How to Run the Application

### Option 1: Run Backend & Frontend Concurrently
In Terminal 1 (Backend):
```bash
source .venv/bin/activate
python scripts/dev.py
```
*Backend runs on `http://127.0.0.1:8000` with WebSocket endpoint at `ws://127.0.0.1:8000/ws/events`.*

In Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```
*Frontend opens on `http://localhost:5173`.*

---

## 💻 Meeting Companion Workflow (Google Meet / Zoom / Teams)

1. Open `http://localhost:5173` in Google Chrome and position the window next to your active Google Meet tab.
2. In the **Meeting Context Drawer**, toggle **"Stream Mic"**:
   - The assistant listens to the meeting audio and populates context in real time.
3. Click **"Turn on Live Camera"**:
   - The MediaPipe camera overlay starts tracking your hands and lip movements.
4. **Trigger Hands-Free Silent Commands:**
   - **Lip Question:** Open your mouth naturally to ask a question. The lip contour turns glowing amber, the HUD indicates `LAR: 0.35 | OPENING`, and `"I have a question regarding this."` is staged in **0 ms**.
   - **Hand Gestures:** Raise your hand (🙋), show a thumbs up (👍), or show an open palm (✋).
5. In ~1 second, Gemini refines the staged message using the ongoing discussion context.
6. Click **[Send to Meeting]** (or press Enter) $\to$ The message is copied to your clipboard.
7. Switch to Google Meet and press `Cmd+V` (or `Ctrl+V`) to send the message into the chat silently.

---

## 🧪 Testing & Verification

The codebase includes a comprehensive automated test suite across both backend and frontend:

```bash
# Run Backend Pytest Suite (33 tests)
PYTHONPATH=. .venv/bin/pytest tests/ -v

# Run Frontend Vitest Suite (30 tests)
cd frontend && npm test -- --run

# Verify Frontend Production Build & TypeScript Type Checking
cd frontend && npm run build
```

### Test Coverage Highlights:
- **`tests/test_api_server.py`**: Validates REST endpoints (`GET /api/commands`, `POST /api/commands`, `POST /api/commands/reset`) and WebSockets.
- **`tests/test_audio_stt.py`**: Tests Deepgram live streaming STT provider and PCM buffer chunking.
- **`tests/test_lip_features.py` & `tests/test_lip_model.py`**: Verifies 80-dim lip landmark extraction and PyTorch GRU inference (1.01 ms).
- **`frontend/src/utils/__tests__/lipClassifier.test.ts`**: Tests geometric LAR calculation, temporal state progression, and cooldowns.
- **`frontend/src/store/__tests__/useCommandStore.test.ts`**: Verifies client-side persistence and API synchronization.

---

## 📁 Repository Structure

```
slient-meeting-assitant/
├── backend/                        # Python FastAPI Backend
│   ├── api/
│   │   └── server.py               # REST & WebSocket Endpoints
│   ├── audio/
│   │   └── stt.py                  # Deepgram Live Streaming STT Provider
│   ├── llm/
│   │   └── engine.py               # Contextual Expansion & Multi-Model Failover
│   ├── models/
│   │   ├── commands.py             # Command Registry & Dynamic Updates
│   │   ├── events.py               # Multimodal Communication Event Schemas
│   │   └── lip_model.py            # PyTorch Bidirectional GRU Lip Classifier
│   ├── vision/
│   │   ├── gesture.py              # Backend Geometric Gesture Classifier
│   │   └── lip_features.py         # 40-Point Lip Feature Vector Extraction
│   ├── fusion.py                   # Confidence Thresholds & Multi-Modality Debouncing
│   └── orchestrator.py             # Central Event Dispatcher & State Coordinator
├── frontend/                       # React 18 + Vite Frontend Companion App
│   ├── public/mediapipe/           # Bundled Local WASM Assets (Hands & FaceMesh)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraFeed.tsx      # Video Stream, Canvas Contours & Kinematic HUD
│   │   │   ├── CommandSettingsModal.tsx # Command Customization UI Modal
│   │   │   ├── ContextDrawer.tsx   # Meeting Transcript & Mic Streaming Toggle
│   │   │   ├── DetectionCard.tsx   # Staged Message, Refinement Shimmer & Copy
│   │   │   ├── Header.tsx          # App Header, Mode Toggles & Settings Trigger
│   │   │   └── SimulationBar.tsx   # Live Modality Manual Testing Controls
│   │   ├── hooks/
│   │   │   ├── useAudioStreamer.ts # 16kHz Linear16 PCM Web Audio Hook
│   │   │   └── useWebSocket.ts     # Persistent WebSocket Client Hook
│   │   ├── store/
│   │   │   ├── useAssistantStore.ts# Staged Message & History State
│   │   │   └── useCommandStore.ts  # Custom Commands & LocalStorage Persistence
│   │   └── utils/
│   │       ├── gestureClassifier.ts# In-Browser Hand Geometric Classifier
│   │       ├── lipClassifier.ts    # In-Browser Lip Kinematics (LAR State Machine)
│   │       └── lipExtractor.ts     # 40 Canonical Lip Point Isolator
│   └── vite.config.ts              # Vite Bundler & WebSocket Proxy Configuration
├── intent/                         # Problem Statement Audits & Intent Specs
│   ├── 00-audit.md                 # Empirical Benchmarks (Gemini, Deepgram, GRU)
│   ├── 00-intent.md                # Gaps Roadmap & Mathematical Specifications
│   └── 00-changes-made.md          # Completed Changes Log
├── tests/                          # Backend Pytest Test Suite (33 tests)
└── README.md                       # Comprehensive Project Documentation
```

---

## 📜 License

This project was built for the **AI Engineering Hackathon** under the **🔴 HARD — Silent Meeting Assistant** problem statement. Licensed under the MIT License.
