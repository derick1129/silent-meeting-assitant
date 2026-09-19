import torch
import numpy as np
import pytest
from backend.ml.lip_model import LipGRUModel, predict_lip_intent, VOCABULARY_CLASSES

def test_lip_gru_forward():
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    dummy_input = torch.randn(2, 24, 80)
    output = model(dummy_input)
    assert output.shape == (2, len(VOCABULARY_CLASSES))

def test_predict_lip_intent():
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    model.eval()
    dummy_seq = np.random.randn(24, 80).astype(np.float32)
    intent, conf = predict_lip_intent(model, dummy_seq, VOCABULARY_CLASSES)
    assert intent in VOCABULARY_CLASSES
    assert 0.0 <= conf <= 1.0
