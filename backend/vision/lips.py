import numpy as np
from typing import List, Dict, Optional
from collections import deque

# Standard MediaPipe 40 inner & outer lip landmark indices
LIP_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 61, 185, 40, 39, 37, 0, 267,
    269, 270, 409, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80,
    81, 82, 13, 312, 311
]

def extract_lip_features(landmarks: List[Dict[str, float]]) -> Optional[np.ndarray]:
    """
    Extracts and normalizes the 40 canonical lip landmark coordinates.
    Returns a flattened 1D array of shape (80,) containing centered (x, y) coordinates.
    """
    if not landmarks or len(landmarks) < 468:
        return None

    coords = []
    for idx in LIP_INDICES:
        pt = landmarks[idx]
        coords.append([pt["x"], pt["y"]])
    
    arr = np.array(coords, dtype=np.float32)  # shape: (40, 2)
    # Center relative to the mean of lip landmarks
    center = np.mean(arr, axis=0)
    arr -= center
    
    # Scale normalization by width (max x - min x)
    width = np.max(arr[:, 0]) - np.min(arr[:, 0])
    if width > 1e-4:
        arr /= width

    return arr.flatten()  # shape: (80,)

class LipSequenceBuffer:
    def __init__(self, window_size: int = 24, feature_dim: int = 80):
        self.window_size = window_size
        self.feature_dim = feature_dim
        self.buffer = deque(maxlen=window_size)

    def push(self, features: np.ndarray) -> None:
        if features.shape == (self.feature_dim,):
            self.buffer.append(features)

    def is_full(self) -> bool:
        return len(self.buffer) == self.window_size

    def get_sequence(self) -> np.ndarray:
        return np.array(self.buffer, dtype=np.float32)

    def clear(self) -> None:
        self.buffer.clear()
