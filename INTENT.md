# Silent Meeting Assistant — Intent Specification

## 1. Document Purpose

This document defines the complete product intent for the **Silent Meeting Assistant**.

It describes:

- What the application is
- Why it exists
- Who it is for
- What users should be able to do
- How the multimodal input system should behave
- How speech, lip movements, gestures, and signs should interact
- How the application should work alongside meeting applications
- What role AI/LLMs should play
- What is explicitly inside and outside the MVP
- Expected system behavior
- Functional and non-functional requirements
- Architectural intent
- Privacy expectations
- Extensibility requirements
- Success criteria

This document is **not an implementation plan**.

It should be used as the source of truth from which an implementation plan, technical tasks, milestones, and engineering decisions can be created.

---

# 2. Product Identity

## Product Name

**Silent Meeting Assistant**

Working title; the final product name may be changed later.

---

# 3. Product Vision

Build a multimodal AI meeting assistant that allows a person to communicate naturally during an online meeting regardless of whether they want or are able to communicate through normal speech.

The assistant should support:

1. Normal speech
2. Silent lip movements
3. Hand gestures
4. Predefined signs
5. Controlled silent commands
6. Context-aware conversion of recognized input into meeting-ready communication

The system should operate as a companion application running alongside meeting software such as:

- Google Meet
- Zoom
- Microsoft Teams
- Other browser-based or desktop meeting applications

The assistant should not initially require deep integration with the meeting platform.

Instead, it should operate independently on the user's computer and process the user's microphone and webcam in real time.

---

# 4. Core Product Intent

The central intent is:

> A multimodal AI meeting assistant that enables users to communicate naturally through speech, silent lip movements, hand gestures, or predefined signs, and converts all inputs into real-time meeting-ready communication.

The system should treat all supported communication methods as different input modalities that eventually converge into a common communication representation.

Conceptually:

```text
                 USER
                   |
       +-----------+-----------+
       |           |           |
     SPEECH      LIPS       GESTURES
       |           |           |
       v           v           v
   Speech STT   Lip Model   Gesture Model
       |           |           |
       +-----------+-----------+
                   |
                   v
             Input Fusion
                   |
                   v
          Intent / Message
                   |
                   v
             Context Layer
                   |
                   v
                 LLM
                   |
                   v
        Meeting-ready message
```

The key product principle is:

> **The user chooses how they communicate; the assistant normalizes that communication into a form usable during a meeting.**

---

# 5. Problem Being Solved

Some people may:

- Be unable to speak during a meeting
- Prefer not to speak
- Need to remain silent in their environment
- Have temporary situations where speaking is inconvenient
- Prefer gesture-based interaction
- Need an alternative communication mechanism during online meetings

Existing meeting software generally assumes that users communicate primarily through:

- microphone
- keyboard
- chat
- camera-based visual presence

This product introduces a dedicated multimodal communication layer.

The user should be able to communicate through:

```text
Voice
Lip movement
Hand gestures
Predefined signs
Controlled silent commands
```

and have the system convert those signals into meaningful communication.

---

# 6. Target Users

The system is primarily intended for users who:

- Cannot communicate verbally in a particular situation
- Do not want to communicate verbally
- Need silent interaction during meetings
- Want hands-free or low-interruption interaction
- Want an alternative input mechanism during video meetings

The product should also remain useful for ordinary users as a multimodal meeting assistant.

---

# 7. Primary User Scenario

A user joins a Google Meet or Zoom meeting.

The Silent Meeting Assistant is running in the background.

The user can communicate using:

### Voice

```text
User speaks
    |
    v
Speech recognition
    |
    v
Text
```

### Silent lip movement

```text
User silently mouths a predefined phrase
    |
    v
Webcam
    |
    v
Face/Lip landmark extraction
    |
    v
Lip recognition model
    |
    v
Command
```

### Hand gesture

```text
User performs gesture
    |
    v
Webcam
    |
    v
Hand landmark extraction
    |
    v
Gesture classifier
    |
    v
Command
```

All three paths should eventually produce a common internal representation.

Example:

```text
{
  "source": "gesture",
  "intent": "REQUEST_TO_SPEAK",
  "text": "I would like to speak.",
  "confidence": 0.94
}
```

---

# 8. Important Product Constraint

The system is **not intended to solve universal lip reading**.

The product should explicitly use a controlled vocabulary for silent communication.

The initial system should support a predefined collection of:

- words
- phrases
- commands
- gestures
- signs

For example:

```text
YES
NO
HELP
STOP
THANK YOU
I HAVE A QUESTION
I WANT TO SPEAK
PLEASE REPEAT
NEXT TOPIC
I AGREE
I DISAGREE
```

This constraint is intentional.

The objective is to create a reliable controlled silent communication system rather than attempting to solve unrestricted visual speech recognition.

---

# 9. Communication Modes

The application should support three primary modes.

## 9.1 Voice Mode

The user's microphone is the primary input.

Pipeline:

```text
Microphone
    |
    v
Real-time Speech-to-Text
    |
    v
Transcript / Utterance
    |
    v
Context processing
    |
    v
Meeting-ready text
```

Deepgram is intended to be used for real-time speech recognition.

---

# 9.2 Silent Mode

The user's microphone may be muted or ignored.

The webcam becomes the primary communication input.

The system analyzes:

- lip movements
- hand gestures
- predefined signs

Pipeline:

```text
Webcam
   |
   +----------------+
   |                |
   v                v
Face/Lips          Hands
   |                |
   v                v
Lip Model       Gesture Model
   |                |
   +-------+--------+
           |
           v
      Input Fusion
           |
           v
        Intent
```

---

# 9.3 Automatic Mode

The application should support a mode where the system accepts both speech and visual input.

Example:

```text
Speech ----------------+
                       |
Lip movement ----------+--> Input Fusion
                       |
Gesture ----------------+
```

This is the preferred long-term interaction model.

---

# 10. Meeting Companion Behavior

The application should be designed as a **companion application**.

It runs independently from:

- Google Meet
- Zoom
- Microsoft Teams
- other meeting software

The initial MVP should not depend on private APIs or deep integration with these platforms.

Instead:

```text
+---------------------+
| Google Meet / Zoom  |
|                     |
|      Meeting        |
+---------------------+

          +

+-------------------------+
| Silent Meeting          |
| Assistant               |
|                         |
| Camera                  |
| Microphone              |
| Recognition             |
| AI                      |
+-------------------------+
```

The application should run in the background and provide a small overlay/window showing the user's recognized communication.

---

# 11. Meeting Context

The assistant may optionally maintain meeting context.

Context can include:

- recent recognized speech
- recent user messages
- recognized silent commands
- conversation transcript
- current communication state

The context layer exists so that the LLM can transform short commands into useful meeting-ready communication.

Example:

Input:

```text
I HAVE A QUESTION
```

Meeting context:

```text
The meeting is currently discussing database architecture.
```

Possible generated message:

```text
I have a question regarding the database architecture.
```

The LLM should not invent factual content.

It should primarily:

- expand
- normalize
- phrase
- contextualize
- format

recognized user intent.

---

# 12. Role of the LLM

The LLM is **not the primary computer vision recognition model**.

The LLM should not be responsible for:

```text
Raw video -> LLM -> gesture/lip recognition
```

Instead:

```text
Video
  |
  v
Computer Vision
  |
  v
Recognition Model
  |
  v
Structured Intent
  |
  v
LLM
```

The LLM's responsibilities may include:

- converting controlled commands into natural language
- contextualizing short commands
- combining multiple recognized inputs
- resolving simple intent combinations
- formatting meeting-ready messages
- maintaining conversational context
- optionally generating spoken output text

Example:

```text
Gesture:
REQUEST_TO_SPEAK

Lip command:
QUESTION

Meeting context:
Current discussion is about project architecture.

LLM output:
"I have a question regarding the current architecture."
```

---

# 13. Role of Deepgram

Deepgram should primarily handle the **voice communication layer**.

Expected responsibilities:

- real-time speech-to-text
- streaming transcription
- interim transcription
- final utterance detection
- optional speaker-related metadata where useful
- text-to-speech for generated spoken output if required

The architecture should keep Deepgram behind an abstraction/interface so that another STT provider can be substituted later.

Conceptually:

```text
SpeechProvider
    |
    +-- Deepgram
    |
    +-- Local Whisper
    |
    +-- Future provider
```

The application should not become tightly coupled to Deepgram-specific implementation details.

---

# 14. Role of OpenCV

OpenCV is the primary webcam/video processing layer.

Responsibilities include:

- webcam access
- frame capture
- frame preprocessing
- resolution management
- frame-rate management
- camera lifecycle
- optional visualization/debugging
- image conversion

OpenCV should not be responsible for semantic recognition.

Conceptually:

```text
Webcam
   |
   v
OpenCV
   |
   v
Frames
   |
   v
MediaPipe
```

---

# 15. Role of MediaPipe

MediaPipe is intended to provide real-time landmark extraction.

The system should use:

### Face landmarks

For:

- mouth/lip landmarks
- facial geometry
- relevant facial movement

### Hand landmarks

For:

- hand pose
- finger positions
- gesture recognition

MediaPipe should provide structured geometric information to downstream models.

It is not itself the semantic command recognizer.

---

# 16. Silent Lip Recognition

The initial implementation should use **controlled visual speech recognition**.

The intended pipeline:

```text
Webcam
   |
   v
OpenCV
   |
   v
MediaPipe Face Landmarker
   |
   v
Lip landmarks
   |
   v
Normalization
   |
   v
Temporal sequence
   |
   v
GRU/LSTM model
   |
   v
Controlled command
```

The model should operate on landmark sequences rather than attempting to directly classify arbitrary full-resolution video.

---

# 17. Lip Recognition Data Representation

A single frame is insufficient for most lip commands.

The model should receive a temporal sequence.

Conceptually:

```text
Frame 1 -> lip landmarks
Frame 2 -> lip landmarks
Frame 3 -> lip landmarks
...
Frame N -> lip landmarks
```

This becomes:

```text
Sequence:
[N frames x feature dimensions]
```

The model then predicts:

```text
{
  "command": "I_HAVE_A_QUESTION",
  "confidence": 0.91
}
```

The exact sequence length and feature representation are implementation decisions.

---

# 18. Lip Recognition Model

The initial intended architecture is:

```text
Lip landmarks
      |
      v
Feature normalization
      |
      v
Temporal sequence
      |
      v
GRU / LSTM
      |
      v
Dense classifier
      |
      v
Softmax
      |
      v
Command
```

PyTorch is the intended ML framework.

The model should be lightweight enough for real-time local inference.

---

# 19. Gesture Recognition

Gesture recognition should follow a similar pipeline.

```text
Webcam
   |
   v
OpenCV
   |
   v
MediaPipe Hands
   |
   v
Hand landmarks
   |
   v
Feature normalization
   |
   v
Gesture classifier
   |
   v
Command
```

The initial gesture vocabulary should be small and controlled.

Example:

```text
Thumbs Up      -> YES
Thumbs Down    -> NO
Open Palm      -> STOP
Raised Hand    -> REQUEST_TO_SPEAK
Pointing       -> SELECT / REFER
```

Exact gestures should be configurable.

---

# 20. Unified Input Representation

All recognition systems should output a common internal event structure.

Example:

```json
{
  "type": "communication_event",
  "source": "lip",
  "intent": "REQUEST_TO_SPEAK",
  "text": "I would like to speak.",
  "confidence": 0.92,
  "timestamp": 0
}
```

For speech:

```json
{
  "type": "communication_event",
  "source": "speech",
  "intent": "FREEFORM_SPEECH",
  "text": "I think we should use PostgreSQL.",
  "confidence": 0.98,
  "timestamp": 0
}
```

For gestures:

```json
{
  "type": "communication_event",
  "source": "gesture",
  "intent": "YES",
  "text": "Yes.",
  "confidence": 0.95,
  "timestamp": 0
}
```

This abstraction is important because downstream systems should not need to know whether the message came from:

- speech
- lips
- hands
- signs

---

# 21. Input Fusion

The system should contain an input-fusion layer.

Its purpose is to combine multiple recognized events.

Example:

```text
Gesture:
REQUEST_TO_SPEAK

Lip:
QUESTION
```

becomes:

```text
Intent:
QUESTION_REQUEST
```

which can become:

```text
"I have a question."
```

The fusion system should handle:

- simultaneous inputs
- sequential commands
- duplicate detections
- confidence thresholds
- temporal smoothing
- command cooldowns
- conflicting inputs

---

# 22. Confidence Handling

Recognition should not immediately emit every prediction.

The system should use:

- confidence thresholds
- temporal consistency
- debounce/cooldown logic
- optional confirmation

Example:

```text
Prediction 1: HELP 0.52
Prediction 2: HELP 0.61
Prediction 3: HELP 0.88
```

Only after sufficient confidence/stability should the command be emitted.

This is important to prevent repeated or accidental commands.

---

# 23. Command Vocabulary

The system should have a configurable command registry.

Example:

```json
{
  "id": "request_to_speak",
  "name": "I want to speak",
  "type": "gesture",
  "output": "I would like to speak.",
  "enabled": true
}
```

Another:

```json
{
  "id": "question",
  "name": "I have a question",
  "type": "lip",
  "output": "I have a question.",
  "enabled": true
}
```

---

# 24. Custom Commands

The application should eventually allow users to add custom commands.

Desired flow:

```text
Add Command
     |
     v
Command name
     |
     v
Select modality
     |
     +--> Gesture
     |
     +--> Lip movement
     |
     v
Record examples
     |
     v
Extract landmarks
     |
     v
Train/update classifier
     |
     v
Command available
```

This feature may be implemented after the first MVP if time is limited.

The architecture should nevertheless allow it.

---

# 25. Real-Time UI

The UI should clearly communicate what the system currently understands.

Example:

```text
+------------------------------------------+
|       SILENT MEETING ASSISTANT           |
+------------------------------------------+
| Status: ● Listening                      |
| Mode: AUTO                               |
|                                          |
| Detected:                                |
|                                          |
| "I have a question."                     |
|                                          |
| Input: 👄 Lip Recognition                |
| Confidence: 94%                          |
|                                          |
| [ Send ]     [ Cancel ]                  |
+------------------------------------------+
```

The UI should not overwhelm the user.

The most important information is:

1. Current state
2. Detected communication
3. Input modality
4. Confidence
5. Send/confirm/cancel action where appropriate

---

# 26. Application States

The system should have explicit states.

Example:

```text
IDLE
LISTENING
PROCESSING
RECOGNIZED
AWAITING_CONFIRMATION
SENT
ERROR
```

Possible flow:

```text
IDLE
  |
  v
LISTENING
  |
  v
PROCESSING
  |
  v
RECOGNIZED
  |
  +----> CANCEL
  |
  v
AWAITING_CONFIRMATION
  |
  v
SENT
```

---

# 27. "I Want to Speak" Flow

This is an important product interaction.

The user performs a predefined gesture or silent command:

```text
REQUEST_TO_SPEAK
```

The system recognizes it.

Possible behavior:

```text
Gesture
   |
   v
REQUEST_TO_SPEAK
   |
   v
UI notification
   |
   v
Enable microphone / enter speech mode
   |
   v
User speaks
   |
   v
Deepgram STT
   |
   v
Meeting-ready text
```

Whether the application automatically unmutes the meeting application is **not required for the initial MVP**.

The initial MVP should simply indicate:

```text
"Microphone mode ready"
```

and capture the user's speech through its own microphone pipeline.

Direct control of Zoom/Meet microphone state can be explored later.

---

# 28. Optional Text-to-Speech

The system may support:

```text
Silent input
    |
    v
Recognized message
    |
    v
LLM
    |
    v
Natural-language message
    |
    v
TTS
    |
    v
Audio output
```

This allows the assistant to speak on behalf of the user.

TTS should be optional.

The default MVP should prioritize text output.

---

# 29. Meeting Context

The assistant should maintain short-term context.

Example:

```text
Recent meeting context:

Participant:
"Should we migrate to PostgreSQL?"

User:
"I disagree."

Assistant:
"Could you explain why?"

User:
"Because..."
```

The context should be limited and configurable.

The assistant should not retain meeting data indefinitely by default.

---

# 30. Privacy Intent

Privacy is a core requirement.

The system processes:

- microphone data
- webcam data
- potentially meeting transcript data

The user should clearly understand:

- when the camera is active
- when the microphone is active
- when speech is being transmitted externally
- when an LLM API is being used
- what data is stored

The application should visibly indicate active capture.

Example:

```text
● Camera Active
● Microphone Active
```

---

# 31. Local Processing Preference

Computer vision should preferably happen locally.

The intended design is:

```text
Webcam
  |
  v
Local OpenCV
  |
  v
Local MediaPipe
  |
  v
Local lip/gesture model
```

Raw camera frames should not be sent to an external API unless explicitly required.

Speech may be sent to Deepgram when the user enables cloud speech recognition.

The architecture should make this distinction clear.

---

# 32. API Architecture Intent

The application should have a clean separation between:

### Frontend

Responsible for:

- UI
- state
- visualization
- user configuration
- command management

### Backend

Responsible for:

- camera pipeline
- microphone pipeline
- model inference
- input fusion
- LLM orchestration
- Deepgram integration
- WebSocket communication

### ML layer

Responsible for:

- lip recognition
- gesture recognition
- feature extraction

---

# 33. Real-Time Communication

WebSockets should be used for real-time events between backend and frontend.

Example:

```text
Backend
   |
   | WebSocket
   |
   v
Frontend
```

Events may include:

```text
camera_status
microphone_status
lip_prediction
gesture_prediction
speech_partial
speech_final
communication_event
llm_response
tts_status
error
```

---

# 34. Suggested Event Flow

### Speech

```text
Microphone
    |
    v
Deepgram
    |
    v
Partial transcript
    |
    v
UI

Final transcript
    |
    v
Input Fusion
    |
    v
LLM/context layer
    |
    v
Communication event
```

### Lip

```text
Camera
    |
    v
OpenCV
    |
    v
MediaPipe
    |
    v
Lip features
    |
    v
Temporal model
    |
    v
Stable prediction
    |
    v
Input Fusion
```

### Gesture

```text
Camera
    |
    v
OpenCV
    |
    v
MediaPipe Hands
    |
    v
Gesture classifier
    |
    v
Stable prediction
    |
    v
Input Fusion
```

---

# 35. Error Handling Intent

The application should gracefully handle:

- camera unavailable
- microphone unavailable
- Deepgram unavailable
- LLM unavailable
- model unavailable
- low-confidence recognition
- insufficient lighting
- face not detected
- hand not detected
- multiple faces
- network interruption
- WebSocket disconnection

The system should degrade gracefully.

Example:

If Deepgram is unavailable:

```text
Speech recognition unavailable.

Silent gesture/lip communication remains available.
```

If the camera is unavailable:

```text
Camera unavailable.

Voice communication remains available.
```

---

# 36. Multiple Face Handling

The MVP should primarily analyze the **user's own camera feed**.

The system should not attempt to perform general multi-person lip reading.

If multiple faces are visible, the system should either:

- identify the primary user face
- or display an appropriate warning

Example:

```text
Multiple faces detected.

Please position yourself clearly in front of the camera.
```

---

# 37. Lighting and Camera Constraints

The MVP may assume:

- reasonable lighting
- frontal or near-frontal face
- visible mouth
- visible hands
- ordinary laptop webcam

The application should provide basic feedback when conditions are poor.

Example:

```text
Face detected
Lighting: Low

Recognition confidence may be reduced.
```

---

# 38. Performance Intent

The application should aim for real-time behavior.

The user should not experience significant delay between:

```text
Input
  ->
Recognition
  ->
Display
```

The computer-vision recognition path should preferably run locally.

The implementation should avoid unnecessary frame processing.

Possible optimizations include:

- processing at controlled FPS
- resizing frames
- processing only relevant regions
- temporal buffering
- lightweight models
- asynchronous pipelines

Exact performance targets should be determined during implementation benchmarking.

---

# 39. Security

API keys must never be placed in frontend code.

Secrets should be stored using environment variables or a secure local configuration mechanism.

Example:

```env
DEEPGRAM_API_KEY=
LLM_API_KEY=
```

The frontend should communicate with the backend rather than exposing provider credentials.

---

# 40. Extensibility

The architecture should allow future support for:

- additional gestures
- additional silent phrases
- custom gesture models
- custom lip models
- different STT providers
- local STT
- different LLM providers
- different TTS providers
- meeting-platform integrations
- accessibility devices
- keyboard shortcuts
- eye tracking
- additional sign-language support

Provider-specific logic should therefore be abstracted.

---

# 41. Provider Abstraction

The system should avoid hardcoding the entire application around one AI provider.

Recommended conceptual interfaces:

```text
SpeechToTextProvider
TextToSpeechProvider
LLMProvider
LipRecognitionModel
GestureRecognitionModel
```

Deepgram can implement:

```text
SpeechToTextProvider
TextToSpeechProvider
```

A future provider should be replaceable without redesigning the application.

---

# 42. MVP Definition

The MVP should demonstrate the complete core loop.

### Required MVP capabilities

1. Start webcam
2. Start microphone
3. Detect face
4. Detect lips
5. Detect hands
6. Recognize a small controlled set of gestures
7. Recognize a small controlled set of silent lip commands
8. Perform real-time speech-to-text
9. Normalize all inputs into a common event format
10. Display recognized communication in real time
11. Support basic input confirmation
12. Support basic meeting context
13. Use an LLM to convert recognized intent into natural-language communication
14. Run as a standalone companion application

---

# 43. Recommended MVP Vocabulary

The first version should intentionally remain small.

Suggested commands:

```text
YES
NO
HELP
STOP
THANK YOU
I HAVE A QUESTION
I WANT TO SPEAK
PLEASE REPEAT
NEXT TOPIC
I AGREE
I DISAGREE
```

Not every command needs to support every modality.

For example:

```text
Speech:
Free-form speech

Gesture:
YES
NO
STOP
I WANT TO SPEAK

Lip:
I HAVE A QUESTION
HELP
YES
NO
PLEASE REPEAT
```

The exact mapping should be configurable.

---

# 44. Out of Scope for MVP

The following should not be required initially:

### Universal lip reading

The system does not need to convert arbitrary silent speech into arbitrary text.

### Full sign-language translation

The MVP does not need to recognize unrestricted sign language.

### Deep Zoom integration

The system does not need to control Zoom internally.

### Deep Google Meet integration

The system does not need to modify Google Meet internals.

### Perfect speaker identification

The system does not need to identify every participant.

### Perfect LLM understanding

The LLM is an enhancement layer, not the core recognition engine.

### Fully autonomous meeting participation

The assistant should not independently speak or send messages without an appropriate user action/confirmation in the MVP.

---

# 45. User Control

The user should remain in control of communication.

The assistant should distinguish between:

```text
DETECTED
```

and:

```text
SENT
```

Example:

```text
Detected:
"I have a question."

[ Send ] [ Cancel ]
```

The system should not automatically send uncertain recognition results to a meeting.

---

# 46. Confidence UX

The UI should communicate uncertainty.

Example:

```text
Detected:
"I want to speak"

Confidence:
93%

[Send] [Cancel]
```

For low confidence:

```text
Possible command:
"I want to speak"

Confidence:
58%

Please repeat the gesture.
```

---

# 47. Accessibility Intent

The UI should itself be accessible.

Important considerations:

- readable text
- high contrast
- keyboard controls
- clear state indicators
- minimal reliance on tiny visual indicators
- optional audio feedback
- configurable font size

The assistant should reduce communication barriers rather than introduce additional interaction complexity.

---

# 48. Data Storage Intent

The MVP should minimize persistent storage.

By default:

- webcam frames should not be stored
- microphone audio should not be stored
- temporary recognition data should remain in memory
- meeting context should be temporary

Training data for custom models is an explicit exception and should require user action.

---

# 49. Training Data Intent

The system should support collection of controlled training samples.

Example:

```text
Command: I HAVE A QUESTION

Recording 1
Recording 2
Recording 3
...
Recording N
```

Each sample should ideally contain landmark sequences rather than unnecessary raw video.

Conceptually:

```text
Raw video
   |
   v
Landmark extraction
   |
   v
Feature sequence
   |
   v
Dataset
```

This reduces storage and privacy requirements.

---

# 50. Model Training Intent

Training should be separated from inference.

Conceptually:

```text
Training Pipeline

Dataset
   |
   v
Preprocessing
   |
   v
Feature normalization
   |
   v
Train/Validation split
   |
   v
GRU/LSTM
   |
   v
Evaluation
   |
   v
Model artifact
```

Runtime:

```text
Webcam
   |
   v
Features
   |
   v
Trained model
   |
   v
Prediction
```

---

# 51. Testing Intent

The system should have tests for:

### Unit tests

- command parsing
- confidence thresholds
- event normalization
- input fusion
- configuration
- provider abstractions

### Model tests

- gesture classification
- lip classification
- false positive behavior
- confidence thresholds

### Integration tests

- webcam → MediaPipe
- microphone → Deepgram
- recognition → WebSocket
- event → LLM
- LLM → UI

### End-to-end tests

Example:

```text
Perform gesture
    |
    v
Gesture detected
    |
    v
Intent generated
    |
    v
UI displays message
```

---

# 52. Observability

The application should provide development-time observability.

Useful metrics include:

```text
Camera FPS
Recognition latency
Speech latency
Lip recognition confidence
Gesture confidence
WebSocket latency
LLM latency
STT latency
Error count
```

The system should not log sensitive raw audio/video by default.

---

# 53. Development Modes

The application should support:

## Mock Mode

Used without:

- webcam
- Deepgram credentials
- LLM credentials
- trained lip model

Example:

```text
Mock gesture:
HELP

Mock speech:
"I have a question."
```

This allows frontend and orchestration development independently.

---

## Local Vision Mode

Uses:

```text
OpenCV
MediaPipe
Local models
```

---

## Production-like Mode

Uses:

```text
OpenCV
MediaPipe
trained models
Deepgram
LLM
WebSockets
```

---

# 54. Suggested High-Level Repository Structure

The exact structure is an implementation decision, but the project should conceptually separate:

```text
silent-meeting-assistant/
|
├── docs/
│   └── ...
|
├── backend/
│   ├── api/
│   ├── audio/
│   ├── vision/
│   ├── models/
│   ├── fusion/
│   ├── llm/
│   ├── providers/
│   └── main.py
|
├── frontend/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   ├── services/
│   └── ...
|
├── ml/
│   ├── datasets/
│   ├── training/
│   ├── inference/
│   └── checkpoints/
|
├── scripts/
|
├── tests/
|
├── .env.example
└── README.md
```

The final implementation may change this structure if a better architecture is identified.

---

# 55. Technology Intent

The intended technology stack is:

## Computer Vision

```text
Python
OpenCV
MediaPipe
NumPy
```

## Machine Learning

```text
PyTorch
GRU/LSTM
```

## Backend

```text
Python
FastAPI
WebSockets
```

## Speech

```text
Deepgram
```

## LLM

```text
Gemini or another interchangeable LLM provider
```

## Frontend

```text
React
TypeScript
```

The final implementation should preserve provider abstraction where practical.

---

# 56. Deployment Intent

The initial target is a local desktop development environment.

The application should run on the user's laptop.

The long-term application should ideally become a desktop application using a suitable desktop shell if required.

Possible future packaging options include:

- Tauri
- Electron
- native Python desktop wrapper

The MVP does not require selecting a final desktop packaging technology unless necessary.

---

# 57. Meeting Platform Integration Roadmap

The integration should be staged.

## Phase 1

Standalone assistant running alongside the meeting.

```text
Zoom / Meet
+
Silent Meeting Assistant
```

## Phase 2

Overlay/window integration.

## Phase 3

Optional meeting-platform integrations.

Potential features:

- mute/unmute
- send chat
- request to speak
- meeting transcript access
- meeting context integration

These are future capabilities and should not block the MVP.

---

# 58. Example End-to-End Scenarios

## Scenario A — Normal speech

```text
User:
"I disagree with the proposed architecture."

        |
        v

Deepgram STT

        |
        v

Speech event

        |
        v

Meeting UI

        |
        v

"I disagree with the proposed architecture."
```

---

## Scenario B — Silent lip communication

```text
User silently mouths:

"I have a question"

        |
        v

Camera

        |
        v

MediaPipe Face

        |
        v

Lip landmarks

        |
        v

Temporal classifier

        |
        v

I_HAVE_A_QUESTION

        |
        v

LLM/context layer

        |
        v

"I have a question regarding this topic."
```

---

## Scenario C — Gesture

```text
User raises hand

        |
        v

MediaPipe Hands

        |
        v

Gesture classifier

        |
        v

REQUEST_TO_SPEAK

        |
        v

UI

        |
        v

"Ready to speak"
```

---

## Scenario D — Silent + speech

```text
Gesture:
REQUEST_TO_SPEAK

        +

Speech:
"Can you explain the database choice?"

        |
        v

Input Fusion

        |
        v

Meeting-ready message

        |
        v

"I'd like to ask about the database choice."
```

---

## Scenario E — Silent communication with TTS

```text
Lip:
HELP

        |
        v

Recognition

        |
        v

Intent

        |
        v

LLM

        |
        v

"I need some assistance."

        |
        v

TTS

        |
        v

Audio output
```

---

# 59. Product Success Criteria

The MVP should demonstrate that:

1. The user can launch the assistant alongside a meeting.
2. The assistant can access the webcam.
3. The assistant can detect the user's face.
4. The assistant can extract lip landmarks.
5. The assistant can recognize a controlled set of silent lip commands.
6. The assistant can detect hand gestures.
7. The assistant can recognize a controlled set of gestures.
8. The assistant can capture normal speech.
9. Speech can be converted to text in real time.
10. All modalities produce a common communication event.
11. The system displays the recognized communication in real time.
12. The LLM can convert recognized intent into natural meeting-ready language.
13. The user can confirm or reject generated communication.
14. The system can operate without requiring deep integration with Zoom/Meet.
15. The system can operate locally for webcam/landmark processing.
16. The architecture supports adding new commands and modalities.

---

# 60. Definition of Done for MVP

The MVP is considered complete when a live demonstration can perform the following:

### Setup

```text
Launch application
        |
        v
Camera initialized
Microphone initialized
        |
        v
Assistant ready
```

### Speech

```text
User speaks
        |
        v
Deepgram
        |
        v
Text appears in UI
```

### Gesture

```text
User performs predefined gesture
        |
        v
MediaPipe
        |
        v
Gesture model
        |
        v
Command appears in UI
```

### Silent speech

```text
User performs predefined silent phrase
        |
        v
MediaPipe Face
        |
        v
Lip model
        |
        v
Command appears in UI
```

### AI

```text
Recognized intent
        |
        v
Meeting context
        |
        v
LLM
        |
        v
Natural-language message
```

### User control

```text
Generated message

[Confirm] [Cancel]
```

---

# 61. Important Engineering Principles

The implementation should follow these principles:

## Local-first vision

Computer vision should run locally whenever practical.

## Modular providers

External AI providers should be replaceable.

## Real-time first

Latency is a first-class concern.

## Controlled recognition

The MVP should prioritize reliability over vocabulary size.

## Explicit user control

The assistant should not silently send uncertain communication.

## Privacy by default

Do not persist raw audio/video unnecessarily.

## Graceful degradation

One unavailable modality should not break the entire system.

## Extensible architecture

New modalities and commands should be addable without rewriting the core system.

---

# 62. Non-Goals

The project is not intended to be:

- a universal lip-reading system
- a complete sign-language translator
- a replacement for Zoom or Google Meet
- an autonomous meeting participant
- a general surveillance system
- a system that continuously records meetings
- a system that automatically speaks without user control
- a system that sends raw webcam footage to an LLM for recognition

---

# 63. Long-Term Vision

The long-term vision is a general-purpose **multimodal accessibility layer for digital communication**.

Instead of requiring users to adapt to one communication interface, the assistant adapts to the user's available communication method.

Potential future modalities:

```text
Speech
   |
Lip movement
   |
Hand gestures
   |
Sign language
   |
Keyboard
   |
Eye tracking
   |
Facial expressions
   |
Assistive devices
   |
       v
Unified Communication Layer
       |
       v
AI Context Engine
       |
       v
Human-readable communication
```

The meeting is the initial use case.

The underlying technology could eventually support:

- classrooms
- interviews
- customer support
- telehealth interfaces
- accessibility applications
- presentations
- collaborative work
- other real-time communication environments

---

# 64. Final Product Definition

The product should ultimately be understood as:

> **A real-time multimodal communication layer that sits alongside online meetings and allows users to communicate through speech, silent lip movements, hand gestures, and predefined signs, while AI converts those different forms of input into clear, contextual, meeting-ready communication.**

The system should not attempt to replace human communication.

It should provide users with **more ways to participate in it**.

---

# 65. Source of Truth

This `INTENT.md` file defines the intended product behavior and boundaries.

Any future implementation plan should derive from this document.

The implementation plan should decide:

- exact repository structure
- exact framework versions
- model architecture details
- dataset format
- training strategy
- API contracts
- WebSocket protocol
- frontend architecture
- deployment approach
- testing strategy
- milestones
- engineering tasks

Those implementation details should remain subordinate to the product intent defined here.
