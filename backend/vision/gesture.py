from typing import List, Dict, Optional, Tuple

def classify_hand_gesture(landmarks: List[Dict[str, float]]) -> Optional[Tuple[str, float]]:
    """
    Classifies a hand pose using 21 MediaPipe hand landmarks.
    Landmarks indices:
    Wrist: 0
    Thumb: 1..4 (Tip: 4, IP: 3, MCP: 2)
    Index: 5..8 (Tip: 8, PIP: 6, MCP: 5)
    Middle: 9..12 (Tip: 12, PIP: 10, MCP: 9)
    Ring: 13..16 (Tip: 16, PIP: 14, MCP: 13)
    Pinky: 17..20 (Tip: 20, PIP: 18, MCP: 17)
    """
    if not landmarks or len(landmarks) < 21:
        return None

    wrist = landmarks[0]
    
    thumb_extended = landmarks[4]["y"] < landmarks[3]["y"]
    index_extended = landmarks[8]["y"] < landmarks[6]["y"]
    middle_extended = landmarks[12]["y"] < landmarks[10]["y"]
    ring_extended = landmarks[16]["y"] < landmarks[14]["y"]
    pinky_extended = landmarks[20]["y"] < landmarks[18]["y"]

    extended_count = sum([index_extended, middle_extended, ring_extended, pinky_extended])

    # Open Palm -> STOP (All 5 extended)
    if thumb_extended and extended_count == 4:
        return ("STOP", 0.95)

    # Raised Hand (4 fingers extended, thumb folded or neutral) -> REQUEST_TO_SPEAK
    if extended_count == 4 and not thumb_extended:
        return ("REQUEST_TO_SPEAK", 0.92)

    # Thumbs Up -> YES (Thumb up, 4 fingers folded, thumb tip higher than wrist)
    if thumb_extended and extended_count == 0 and landmarks[4]["y"] < wrist["y"]:
        return ("YES", 0.90)

    # Thumbs Down -> NO (Thumb pointing downward below wrist, 4 fingers folded)
    thumb_down = landmarks[4]["y"] > landmarks[3]["y"] and landmarks[4]["y"] > wrist["y"]
    if thumb_down and extended_count == 0:
        return ("NO", 0.90)

    return None
