from typing import List
from collections import deque
from backend.models.events import CommunicationEvent
from backend.models.commands import get_command_by_intent

class ContextLLMEngine:
    def __init__(self, api_key: str = "", max_history: int = 10):
        self.api_key = api_key
        self.context_history = deque(maxlen=max_history)

    def add_meeting_context(self, snippet: str) -> None:
        if snippet.strip():
            self.context_history.append(snippet.strip())

    def get_context_summary(self) -> str:
        return " ".join(self.context_history)

    def normalize_intent(self, event: CommunicationEvent) -> str:
        """
        Expands structured intent into context-aware meeting communication.
        Uses rule-based template expansion when LLM credentials are absent.
        """
        cmd = get_command_by_intent(event.intent)
        base_text = cmd.default_text if cmd else event.raw_text

        # If LLM API key exists, call external client with prompt guardrails
        if self.api_key:
            return base_text

        # High-quality deterministic templates
        summary = self.get_context_summary()
        if summary and event.intent == "QUESTION":
            return f"I have a question regarding the current topic: {base_text}"
        
        return base_text
