from pathlib import Path
import tempfile
import time

import torch

from .types import VSRPrediction


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
                    raise VSRError("VSR transcription is empty")
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
