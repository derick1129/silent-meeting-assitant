from pathlib import Path
import tempfile
import time

import torch

from .types import VSRPrediction


def _crop_mouth_region(frames_list: list) -> list:
    """If a face is detected in the video, crop the mouth ROI centered on lips."""
    try:
        import cv2
        import numpy as np

        if not frames_list:
            return frames_list

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            return frames_list

        # Detect face in middle or first frame
        mid_idx = len(frames_list) // 2
        gray = cv2.cvtColor(frames_list[mid_idx], cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=3)
        if len(faces) == 0:
            gray = cv2.cvtColor(frames_list[0], cv2.COLOR_RGB2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=3)

        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
            # Mouth is typically in the lower 35-40% of the face, centered
            my = int(y + 0.60 * h)
            mh = int(0.38 * h)
            mx = int(x + 0.15 * w)
            mw = int(0.70 * w)

            H, W, _ = frames_list[0].shape
            my = max(0, min(my, H - 1))
            mh = max(10, min(mh, H - my))
            mx = max(0, min(mx, W - 1))
            mw = max(10, min(mw, W - mx))

            cropped = [
                cv2.resize(f[my : my + mh, mx : mx + mw], (96, 96)) for f in frames_list
            ]
            return cropped
    except Exception:
        pass
    return frames_list


def _decode_video_frames(video_bytes: bytes) -> torch.Tensor:
    import io
    import av
    import numpy as np

    container = av.open(io.BytesIO(video_bytes))
    frames = []
    for frame in container.decode(video=0):
        frames.append(frame.to_ndarray(format="rgb24"))
    container.close()
    if not frames:
        raise ValueError("No video frames found in clip")

    frames = _crop_mouth_region(frames)
    return torch.from_numpy(np.stack(frames))


class VSRError(RuntimeError):
    """Stable, user-safe errors raised by the local VSR provider."""


class MSPVSRProvider:
    def __init__(
        self,
        model_id: str,
        revision: str | None = None,
        enabled: bool = False,
        device: str = "cpu",
        processor=None,
        model=None,
        temp_dir: Path | None = None,
    ):
        self.model_id = model_id
        self.revision = revision
        self.enabled = enabled
        self.device = device
        self.processor = processor
        self.model = model
        self.temp_dir = temp_dir

    @staticmethod
    def _patch_layer_forward(layer) -> None:
        orig_forward = getattr(layer, "forward", None)
        if orig_forward is None:
            return

        def patched_forward(hidden_states, attention_mask=None, output_attentions=False):
            attn_residual = hidden_states
            hidden_states = layer.layer_norm(hidden_states)
            attn_outputs = layer.attention(
                hidden_states,
                attention_mask=attention_mask,
                output_attentions=output_attentions,
            )
            hidden_states = attn_outputs[0]
            attn_weights = attn_outputs[1] if len(attn_outputs) > 1 else None
            hidden_states = layer.dropout(hidden_states)
            hidden_states = attn_residual + hidden_states

            residual = hidden_states
            hidden_states = layer.final_layer_norm(hidden_states)
            hidden_states = residual + layer.feed_forward(hidden_states)

            outputs = (hidden_states,)
            if output_attentions:
                outputs += (attn_weights,)
            return outputs

        layer.forward = patched_forward

    def _load_model(self) -> None:
        if self.processor is not None and self.model is not None:
            return
        try:
            from transformers import AutoModelForCTC, AutoProcessor

            self.processor = AutoProcessor.from_pretrained(
                self.model_id, revision=self.revision, trust_remote_code=True
            )
            self.model = AutoModelForCTC.from_pretrained(
                self.model_id, revision=self.revision, trust_remote_code=True
            )
            # Patch encoder layers to be compatible with newer transformers where attention returns 2 values
            if hasattr(self.model, "msp_visual") and hasattr(self.model.msp_visual, "encoder"):
                for layer in getattr(self.model.msp_visual.encoder, "layers", []):
                    self._patch_layer_forward(layer)

            self.model.to(self.device)
            self.model.eval()
        except Exception as exc:
            raise VSRError("VSR model load failed") from exc

    def predict(self, video_bytes: bytes, filename: str = "clip.webm") -> VSRPrediction:
        if not self.enabled and (self.processor is None or self.model is None):
            raise VSRError("VSR provider is disabled")
        if not video_bytes:
            raise VSRError("VSR video input is empty")
        suffix = Path(filename).suffix.lower()
        if suffix not in {".webm", ".mp4", ".mov"}:
            raise VSRError("VSR video format is unsupported")

        started = time.perf_counter()
        try:
            self._load_model()
            with tempfile.TemporaryDirectory(
                dir=str(self.temp_dir) if self.temp_dir else None
            ) as scratch:
                video_path = Path(scratch) / f"clip{suffix}"
                video_path.write_bytes(video_bytes)
                try:
                    # Robust in-memory decoding with PyAV (avoids torchcodec missing system FFmpeg)
                    frames_tensor = None
                    try:
                        frames_tensor = _decode_video_frames(video_bytes)
                    except Exception:
                        pass

                    if frames_tensor is not None:
                        inputs = self.processor(
                            videos=frames_tensor, return_tensors="pt"
                        )
                    else:
                        inputs = self.processor(
                            videos=str(video_path), return_tensors="pt"
                        )

                    inputs = {
                        key: value.to(self.device) if hasattr(value, "to") else value
                        for key, value in inputs.items()
                    }
                    with torch.inference_mode():
                        output = self.model(**inputs)
                    logits = output.logits
                    probabilities = torch.softmax(logits, dim=-1)
                    token_ids = probabilities.argmax(dim=-1)
                    confidence = float(
                        probabilities.max(dim=-1).values.mean().item()
                    )
                    decoded = self.processor.tokenizer.batch_decode(
                        token_ids, skip_special_tokens=True
                    )
                    text = decoded[0].strip() if decoded else ""
                except Exception as exc:
                    raise VSRError("VSR decoding failed") from exc
                if not text:
                    raise VSRError("No lip movement recognized. Please face the camera directly and articulate clearly.")
                return VSRPrediction(
                    text=text,
                    confidence=max(0.0, min(1.0, confidence)),
                    latency_ms=(time.perf_counter() - started) * 1000,
                    model_id=self.model_id,
                )
        except VSRError:
            raise
        except Exception as exc:
            raise VSRError("VSR decoding failed") from exc
