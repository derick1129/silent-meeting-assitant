# Specification & Implementation Roadmap: 00-intent.md
## Closing the Two Core Gaps for Problem Statement Completeness

**Document Version:** 1.0.0  
**Target Problem Statement:** 🔴 HARD — Silent Meeting Assistant  
**Author:** Antigravity AI  
**Focus:** 
1. **Gap 1 (PS Requirement #5):** User Command Customization & Addition (Command Manager UI & Registry).
2. **Gap 2 (PS Requirement #2 & #4):** In-Browser Real-Time Lip Movement Classification & Automatic Triggering.

---

## 1. Problem Statement Alignment

The Problem Statement establishes 5 mandatory criteria:
1. Capture input through a webcam. *(Already 100% complete via WebRTC `<CameraFeed />`)*
2. Recognize predefined gestures, signs, or controlled silent commands. *(Gestures working; Lip recognition needs live browser classification)*
3. Convert recognized input into text. *(Already 100% complete with 0ms base text + Gemini contextualization)*
4. Display the result in real time. *(Already 100% complete with detection card + clipboard copy)*
5. **Allow users to customize or add commands if possible.** *(Currently partial; requires UI & persistent storage)*

By delivering the two modules specified in this document, the solution achieves **100% full coverage** of every functional requirement.

---

## 2. Module 1 (Gap 1): User Command Customization & Management System

### 2.1 Functional Requirements
- **View All Active Commands:** Users can view the full registry of available gestures (Hand: `REQUEST_TO_SPEAK`, `STOP`, `YES`, `NO`) and silent lip commands (`QUESTION`, `AGREE`, `DISAGREE`, `HELP`, `STOP`, `PLEASE_REPEAT`).
- **Edit Predefined Texts:** Users can modify the default generated phrase for any command (e.g., change `YES` from *"Yes, I agree."* to *"LGTM! Approved."*).
- **Add Custom Commands:** Users can define custom commands or macro templates bound to supported gestures/lip patterns.
- **Persistence:** Customizations are saved locally in the browser (`localStorage`) and synced with the backend REST API (`POST /api/commands`).
- **Reset to Defaults:** Single-click restore to standard factory phrases.

### 2.2 Architecture & Data Contracts
```
┌─────────────────────────────────────────────────────────────┐
│                      Command Store                          │
│  (Zustand + LocalStorage + REST Sync /api/commands)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│ CommandSettingsModal  │             │ Detection & Staging   │
│ (Edit / Add / Reset)  │             │ (Uses Custom Phrases) │
└───────────────────────┘             └───────────────────────┘
```

#### Backend REST API Contracts:
- `GET /api/commands`: Returns current active command registry as JSON dictionary.
- `POST /api/commands`: Creates or updates a command definition:
  ```json
  {
    "intent": "YES",
    "source": "gesture",
    "default_text": "LGTM! Approved.",
    "description": "Customized agreement message"
  }
  ```
- `POST /api/commands/reset`: Restores the default registry.

#### Frontend Store & UI:
- `useCommandStore`: Zustand store with local persistence.
- `CommandSettingsModal.tsx`: Accessible from the header (`⚙️ Commands`).

---

## 3. Module 2 (Gap 2): In-Browser Real-Time Lip Movement Classifier & Live Triggering

### 3.1 The Controlled Lip Articulation Problem
The PS note clarifies: *"Teams are not expected to solve universal lip-reading. A controlled set of gestures, signs, or phrases is acceptable."*

To deliver robust, real-time live lip recognition without relying on uncalibrated synthetic server models or high-latency video uploads, we implement an **in-browser geometric lip kinematics classifier** (`lipClassifier.ts`).

### 3.2 Mathematical Kinematics of Lip Movement
From the 40 canonical lip landmark indices already extracted by `CameraFeed.tsx` at 30 FPS:
1. **Vertical Inner Lip Opening ($H_{\text{inner}}$):**
   $$H_{\text{inner}} = |y_{14} - y_{13}|$$
   where index 13 is the inner upper lip midpoint and index 14 is the inner lower lip midpoint.
2. **Horizontal Mouth Width ($W_{\text{mouth}}$):**
   $$W_{\text{mouth}} = |x_{291} - x_{61}|$$
   where index 61 is the left mouth corner and index 291 is the right mouth corner.
3. **Normalized Lip Aspect Ratio (LAR):**
   $$\text{LAR} = \frac{H_{\text{inner}}}{W_{\text{mouth}}}$$
   - **Neutral / Closed Mouth:** $\text{LAR} < 0.12$
   - **Mouth Puckered / Tightened:** $\text{LAR} \approx 0.15 \text{ with } W_{\text{mouth}} \text{ compressed}$
   - **Open Mouth (Speaking / Question / Ask):** $\text{LAR} > 0.30$

### 3.3 Temporal Articulation State Machine
A rolling buffer of 24 frames (~800 ms) tracks the articulation curve:
- **`QUESTION` Intent:** Detects a distinct transition: Neutral ($\text{LAR} < 0.12$) $\to$ Wide Opening ($\text{LAR} > 0.32$) $\to$ Closure over 12–24 frames.
- **`AGREE` Intent:** Detects repeated gentle mouth closure/nodding shape.
- **`STOP` Intent:** Sustained wide mouth opening (> 0.40).

### 3.4 Live Integration
- When the articulation curve satisfies a command condition with confidence $> 0.70$:
  1. Instantly stages the customized text on the UI (0 ms latency).
  2. Broadcasts `detect_lip` over WebSocket to the backend.
  3. Visual feedback: The canvas lip contour highlights in bright amber/cyan, and a badge appears: `"👄 MOUTH MOVEMENT: QUESTION"`.

---

## 4. Implementation Step-by-Step Roadmap

### Phase 1: Custom Command Registry & UI (Gap 1)
1. **Backend Command Endpoints:** Add `POST /api/commands` and `POST /api/commands/reset` in `backend/api/server.py`. Write pytest tests in `tests/test_api_server.py`.
2. **Frontend Command Store:** Create `frontend/src/store/useCommandStore.ts` with local persistence.
3. **Frontend Command Manager UI:** Create `frontend/src/components/CommandSettingsModal.tsx` and integrate the Settings trigger into `Header.tsx`.
4. **Wire to Staging:** Ensure `CameraFeed` and `DetectionCard` use the customized command text from `useCommandStore`.

### Phase 2: In-Browser Real-Time Lip Movement Classifier (Gap 2)
1. **Lip Kinematics Classifier:** Create `frontend/src/utils/lipClassifier.ts` with unit tests in `frontend/src/utils/__tests__/lipClassifier.test.ts`.
2. **CameraFeed Integration:** Connect `classifyLipMotion()` into `CameraFeed.tsx`'s FaceMesh loop.
3. **Visual Feedback Overlay:** Render dynamic color transitions on the canvas lip skeleton based on LAR opening ratio and show active lip intent badge.
4. **End-to-End Verification:** Verify live physical mouth opening automatically stages `"I have a question regarding this."` hands-free with 0 ms delay.
