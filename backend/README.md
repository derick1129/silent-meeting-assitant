# Silent Meeting Assistant — Backend

Multimodal Silent Meeting Assistant Companion backend service powered by FastAPI, MediaPipe, Deepgram, Gemini, and Pretrained Visual Speech Recognition (VSR).

## Key Features

- **FastAPI Endpoints:**
  - `POST /api/commands` & `POST /api/commands/reset`: Dynamic command configuration.
  - `POST /api/vsr/predict`: Deliberate silent phrase video clip transcription.
  - `WebSocket /ws/events`: Real-time bidirectional streaming for audio chunks, gestures, lip predictions, and Gemini contextual refinement.
- **Deepgram Live STT:** Pre-buffered 16 kHz streaming WebSocket client to Deepgram `nova-2`.
- **Pretrained VSR (Visual Speech Recognition):**
  - Model: [`MahmoodAnaam/MSP-VSR`](https://huggingface.co/MahmoodAnaam/MSP-VSR) Conformer CTC model.
  - Reads short WebM clips and maps recognized phrases to controlled meeting intents (`YES`, `QUESTION`, `PLEASE_REPEAT`, `STOP`, etc.).
  - Configuration: `VSR_ENABLED=true` in `.env` (disabled by default for instant 0 ms lightweight startup).
- **AI Meeting Copilot:**
  - Google Gemini structured answer and action item synthesis.
  - Multi-model failover (`gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.6-flash`).
