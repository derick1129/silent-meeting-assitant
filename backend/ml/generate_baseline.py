"""Generates synthetic initial weights checkpoint so the system is immediately runnable."""
import os
import torch
from backend.ml.lip_model import LipGRUModel, VOCABULARY_CLASSES

def generate_checkpoint(save_path: str = "backend/ml/checkpoints/baseline_lip_gru.pth"):
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
    torch.save({
        "model_state_dict": model.state_dict(),
        "classes": VOCABULARY_CLASSES,
        "version": "1.0.0-baseline"
    }, save_path)
    print(f"Generated baseline checkpoint at {save_path}")

if __name__ == "__main__":
    generate_checkpoint()
