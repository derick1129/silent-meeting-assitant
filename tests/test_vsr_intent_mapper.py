import pytest

from backend.vsr.intent_mapper import map_text_to_intent


@pytest.mark.parametrize("text,expected", [
    ("Yes, I agree", "YES"),
    ("can you repeat that please", "PLEASE_REPEAT"),
    ("I have a question about this", "QUESTION"),
    ("please stop here", "STOP"),
])
def test_common_phrases_map_to_controlled_intents(text, expected):
    intent, confidence = map_text_to_intent(text)
    assert intent == expected
    assert confidence >= 0.80


def test_unknown_text_is_not_converted_to_a_random_intent():
    intent, confidence = map_text_to_intent("the quarterly revenue forecast is updated")
    assert intent is None
    assert confidence == 0.0


def test_empty_text_is_rejected():
    assert map_text_to_intent("") == (None, 0.0)
