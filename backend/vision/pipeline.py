import threading
import time
from typing import Callable, Optional
import numpy as np

class VisionPipeline:
    def __init__(self, mode: str = "mock", on_event: Optional[Callable[[str, str, float], None]] = None):
        self.mode = mode
        self.on_event = on_event
        self.is_running = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self.is_running = True
        if self.mode != "mock":
            self._thread = threading.Thread(target=self._capture_loop, daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)

    def step_mock(self, source: str, intent: str, confidence: float) -> None:
        if self.on_event:
            self.on_event(source, intent, confidence)

    def _capture_loop(self) -> None:
        try:
            import cv2
            cap = cv2.VideoCapture(0)
            while self.is_running and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue
                time.sleep(0.03)  # ~30 fps cap
            cap.release()
        except ImportError:
            time.sleep(0.1)
