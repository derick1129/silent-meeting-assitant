import numpy as np
import pytest
from backend.vision.lips import extract_lip_features, LipSequenceBuffer

def test_extract_lip_features():
    landmarks = [{"x": 0.5 + i * 0.0001, "y": 0.5 + i * 0.0001, "z": 0.0} for i in range(468)]
    features = extract_lip_features(landmarks)
    assert features is not None
    # 40 lip landmark coordinates (x, y) = 80 dimensions
    assert features.shape == (80,)
    assert isinstance(features, np.ndarray)

def test_lip_sequence_buffer():
    buf = LipSequenceBuffer(window_size=24, feature_dim=80)
    assert not buf.is_full()
    for _ in range(23):
        buf.push(np.zeros(80, dtype=np.float32))
    assert not buf.is_full()
    buf.push(np.ones(80, dtype=np.float32))
    assert buf.is_full()
    seq = buf.get_sequence()
    assert seq.shape == (24, 80)
    assert np.all(seq[-1] == 1.0)
