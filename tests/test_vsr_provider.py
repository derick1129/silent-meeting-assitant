import pytest
import torch

from backend.vsr.msp_provider import MSPVSRProvider, VSRError


class FakeTokenizer:
    pad_token_id = 0

    def batch_decode(self, ids, skip_special_tokens=True):
        return ["yes"]


class FakeProcessor:
    tokenizer = FakeTokenizer()

    def __call__(self, videos, return_tensors):
        return {"input_values": torch.zeros((1, 3))}


class FakeModel:
    def __call__(self, **inputs):
        return type(
            "Output",
            (),
            {"logits": torch.tensor([[[4.0, 1.0], [3.0, 0.0], [4.0, 1.0]]])},
        )()


def test_provider_returns_prediction_from_fake_processor_and_model():
    provider = MSPVSRProvider(
        model_id="test/model",
        revision="test-revision",
        processor=FakeProcessor(),
        model=FakeModel(),
    )

    result = provider.predict(b"valid-video-bytes", "clip.webm")

    assert result.text == "yes"
    assert result.model_id == "test/model"
    assert 0.0 <= result.confidence <= 1.0


def test_provider_removes_decoder_scratch_file_after_success(tmp_path):
    provider = MSPVSRProvider(
        model_id="test/model",
        revision="test-revision",
        processor=FakeProcessor(),
        model=FakeModel(),
        temp_dir=tmp_path,
    )

    provider.predict(b"valid-video-bytes", "clip.webm")

    assert list(tmp_path.iterdir()) == []


def test_disabled_provider_fails_before_loading_model():
    provider = MSPVSRProvider(model_id="test/model", enabled=False)

    with pytest.raises(VSRError, match="disabled"):
        provider.predict(b"valid-video-bytes")
