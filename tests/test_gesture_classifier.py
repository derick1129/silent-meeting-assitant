import pytest
from backend.vision.gesture import classify_hand_gesture

def create_synthetic_hand_landmarks(finger_states):
    """
    finger_states: dict with 'thumb', 'index', 'middle', 'ring', 'pinky' -> bool (extended=True)
    """
    landmarks = [{"x": 0.5, "y": 0.8, "z": 0.0} for _ in range(21)]
    # Wrist is at index 0
    landmarks[0] = {"x": 0.5, "y": 0.8, "z": 0.0}
    # Thumb: 1, 2, 3, 4
    landmarks[4]["y"] = 0.4 if finger_states.get("thumb") else 0.7
    landmarks[3]["y"] = 0.5 if finger_states.get("thumb") else 0.6
    # Index: 5, 6, 7, 8
    landmarks[8]["y"] = 0.3 if finger_states.get("index") else 0.75
    landmarks[6]["y"] = 0.5 if finger_states.get("index") else 0.65
    # Middle: 9, 10, 11, 12
    landmarks[12]["y"] = 0.3 if finger_states.get("middle") else 0.75
    landmarks[10]["y"] = 0.5 if finger_states.get("middle") else 0.65
    # Ring: 13, 14, 15, 16
    landmarks[16]["y"] = 0.3 if finger_states.get("ring") else 0.75
    landmarks[14]["y"] = 0.5 if finger_states.get("ring") else 0.65
    # Pinky: 17, 18, 19, 20
    landmarks[20]["y"] = 0.3 if finger_states.get("pinky") else 0.75
    landmarks[18]["y"] = 0.5 if finger_states.get("pinky") else 0.65
    return landmarks

def test_open_palm_stop_gesture():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": True, "index": True, "middle": True, "ring": True, "pinky": True
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "STOP"
    assert confidence >= 0.85

def test_raised_hand_request_to_speak():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": False, "index": True, "middle": True, "ring": True, "pinky": True
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "REQUEST_TO_SPEAK"

def test_thumbs_up_yes():
    landmarks = create_synthetic_hand_landmarks({
        "thumb": True, "index": False, "middle": False, "ring": False, "pinky": False
    })
    result = classify_hand_gesture(landmarks)
    assert result is not None
    intent, confidence = result
    assert intent == "YES"
