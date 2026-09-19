"""Deterministic mapping from VSR text to the controlled command vocabulary."""

from difflib import SequenceMatcher
import re


INTENT_ALIASES = {
    "PLEASE_REPEAT": ("please repeat", "repeat that", "say that again"),
    "REQUEST_TO_SPEAK": ("i want to speak", "let me speak", "request to speak"),
    "THANK_YOU": ("thank you", "thanks"),
    "QUESTION": ("i have a question", "can i ask a question", "question"),
    "NEXT_TOPIC": ("next topic", "move on"),
    "DISAGREE": ("i disagree", "no i disagree", "i have concerns"),
    "AGREE": ("i agree", "agree with this"),
    "HELP": ("help", "i need assistance"),
    "STOP": ("stop", "please stop", "pause"),
    "YES": ("yes", "yeah", "i agree"),
    "NO": ("no", "no i disagree"),
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def map_text_to_intent(
    text: str, minimum_confidence: float = 0.80
) -> tuple[str | None, float]:
    """Map normalized-ish VSR text to a safe, bounded meeting intent."""
    if not isinstance(text, str):
        return None, 0.0
    normalized = _normalize(text)
    if not normalized:
        return None, 0.0

    aliases = [(intent, alias) for intent, values in INTENT_ALIASES.items() for alias in values]
    alias_to_intent = {alias: intent for intent, alias in aliases}
    if normalized in alias_to_intent:
        return alias_to_intent[normalized], 1.0
    matches = [
        (normalized.index(alias), -len(alias), intent)
        for intent, alias in aliases
        if f" {alias} " in f" {normalized} "
    ]
    if matches:
        _, _, intent = min(matches)
        return intent, 1.0

    best_intent, best_score = None, 0.0
    for intent, alias in aliases:
        if len(alias) < 4:
            continue
        score = SequenceMatcher(None, normalized, alias).ratio()
        if score > best_score:
            best_intent, best_score = intent, score
    if best_score >= minimum_confidence:
        return best_intent, best_score
    return None, 0.0
