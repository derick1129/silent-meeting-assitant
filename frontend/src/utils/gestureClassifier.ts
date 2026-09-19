export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface GestureResult {
  intent: string;
  defaultText: string;
  confidence: number;
}

const GESTURE_TEXT_MAP: Record<string, string> = {
  STOP: 'Please pause or stop here.',
  REQUEST_TO_SPEAK: 'I would like to speak.',
  YES: 'Yes, I agree.',
  NO: 'No, I disagree.',
};

export function classifyHandLandmarks(landmarks: LandmarkPoint[]): GestureResult | null {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];

  // In screen coordinates, y=0 is top, y=1 is bottom.
  const thumbExtended = landmarks[4].y < landmarks[3].y;
  const indexExtended = landmarks[8].y < landmarks[6].y;
  const middleExtended = landmarks[12].y < landmarks[10].y;
  const ringExtended = landmarks[16].y < landmarks[14].y;
  const pinkyExtended = landmarks[20].y < landmarks[18].y;

  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

  // Open Palm -> STOP (All 5 extended)
  if (thumbExtended && extendedCount === 4) {
    return {
      intent: 'STOP',
      defaultText: GESTURE_TEXT_MAP.STOP,
      confidence: 0.95,
    };
  }

  // Raised Hand -> REQUEST_TO_SPEAK (4 fingers extended, thumb folded/neutral)
  if (extendedCount === 4 && !thumbExtended) {
    return {
      intent: 'REQUEST_TO_SPEAK',
      defaultText: GESTURE_TEXT_MAP.REQUEST_TO_SPEAK,
      confidence: 0.92,
    };
  }

  // Thumbs Up -> YES (Thumb pointing up, 4 fingers folded)
  if (thumbExtended && extendedCount === 0 && landmarks[4].y < wrist.y) {
    return {
      intent: 'YES',
      defaultText: GESTURE_TEXT_MAP.YES,
      confidence: 0.90,
    };
  }

  // Thumbs Down -> NO (Thumb pointing down below wrist, 4 fingers folded)
  const thumbDown = landmarks[4].y > landmarks[3].y && landmarks[4].y > wrist.y;
  if (thumbDown && extendedCount === 0) {
    return {
      intent: 'NO',
      defaultText: GESTURE_TEXT_MAP.NO,
      confidence: 0.90,
    };
  }

  return null;
}
