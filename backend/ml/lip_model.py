import torch
import torch.nn as nn
import numpy as np
from typing import List, Tuple

VOCABULARY_CLASSES = [
    "SILENCE",
    "YES",
    "NO",
    "HELP",
    "STOP",
    "THANK_YOU",
    "QUESTION",
    "PLEASE_REPEAT",
    "NEXT_TOPIC",
    "AGREE",
    "DISAGREE"
]

class LipGRUModel(nn.Module):
    def __init__(self, input_size: int = 80, hidden_size: int = 64, num_classes: int = len(VOCABULARY_CLASSES)):
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.1
        )
        self.fc1 = nn.Linear(hidden_size * 2, 64)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(64, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        last_step = out[:, -1, :]
        feat = self.relu(self.fc1(last_step))
        logits = self.fc2(feat)
        return logits

def predict_lip_intent(model: nn.Module, sequence: np.ndarray, classes: List[str]) -> Tuple[str, float]:
    tensor = torch.from_numpy(sequence).unsqueeze(0).float()
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=-1).squeeze(0).numpy()
    
    best_idx = int(np.argmax(probs))
    return classes[best_idx], float(probs[best_idx])
