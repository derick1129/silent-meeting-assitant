import json
import time
from typing import List, Dict, Any, Optional
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

        # If LLM API key exists, call Gemini client with prompt guardrails and fast fallback
        if self.api_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                summary = self.get_context_summary()
                prompt = (
                    "You are an AI companion assisting a user in a professional online meeting.\n"
                    f"Recent meeting discussion: {summary if summary else 'General team sync'}\n"
                    f"Recognized user command: {event.intent} (Standard phrase: '{base_text}')\n"
                    "Convert this into a single, polite, professional, contextual meeting-ready message.\n"
                    "Rules: Output ONLY the message text without quotes or explanations. Never invent new factual information."
                )
                models_to_try = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]
                for model_name in models_to_try:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                        )
                        if response and response.text:
                            return response.text.strip().strip('"')
                    except Exception:
                        continue
            except Exception:
                # Fallback to rule-based template on network/API failure
                pass

        # High-quality deterministic templates
        summary = self.get_context_summary()
        if summary and event.intent == "QUESTION":
            return f"I have a question regarding the current topic: {base_text}"
        
        return base_text

    def generate_solution_from_speech(self, query_text: str, meeting_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Takes the spoken utterance/question from the meeting and generates:
        1. A concise, professional direct answer (ready to send to meeting).
        2. Key solution talking points / options.
        3. Category.
        """
        clean_query = query_text.strip()
        if not clean_query:
            return {
                "query": "",
                "suggested_answer": "",
                "solution_points": [],
                "category": "General",
            }

        context = meeting_context or self.get_context_summary() or "General meeting discussion"

        if self.api_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                prompt = (
                    "You are an AI meeting copilot assisting a participant in an ongoing meeting.\n"
                    f"Overall meeting context: {context}\n"
                    f"Speaker's spoken statement / question: \"{clean_query}\"\n\n"
                    "Generate:\n"
                    "1. A direct, concise, articulate response (1-2 sentences) that the user can say or paste into the meeting chat.\n"
                    "2. 2-3 key technical solution points / recommendations.\n"
                    "3. A short category topic name.\n\n"
                    "Return strictly as a JSON object with keys:\n"
                    "- 'suggested_answer': string\n"
                    "- 'solution_points': list of strings\n"
                    "- 'category': string\n"
                )

                models_to_try = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]
                for model_name in models_to_try:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config={"response_mime_type": "application/json"}
                        )
                        if response and response.text:
                            data = json.loads(response.text.strip())
                            return {
                                "query": clean_query,
                                "suggested_answer": data.get("suggested_answer", "").strip(),
                                "solution_points": data.get("solution_points", []),
                                "category": data.get("category", "Meeting Solution").strip(),
                                "timestamp": time.time(),
                            }
                    except Exception:
                        continue
            except Exception:
                pass

        # High-quality deterministic fallback
        return {
            "query": clean_query,
            "suggested_answer": f"Regarding '{clean_query}': We should align on the key requirements and evaluate our available options.",
            "solution_points": [
                f"Review the primary objectives for '{clean_query}'.",
                "Assess implementation trade-offs with the team.",
                "Proceed with an iterative rollout to minimize risk."
            ],
            "category": "Meeting Discussion",
            "timestamp": time.time(),
        }

