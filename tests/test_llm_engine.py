import pytest
from backend.llm.engine import ContextLLMEngine
from backend.models.events import CommunicationEvent, ModalitySource

def test_template_fallback_without_api_key():
    engine = ContextLLMEngine(api_key="")
    event = CommunicationEvent(
        source=ModalitySource.LIP,
        intent="QUESTION",
        raw_text="I have a question.",
        confidence=0.95
    )
    result = engine.normalize_intent(event)
    assert "question" in result.lower()

def test_contextual_expansion():
    engine = ContextLLMEngine(api_key="")
    engine.add_meeting_context("Discussion on microservices vs monolith architecture.")
    event = CommunicationEvent(
        source=ModalitySource.GESTURE,
        intent="REQUEST_TO_SPEAK",
        raw_text="I would like to speak.",
        confidence=0.92
    )
    result = engine.normalize_intent(event)
    assert len(result) > 5
    assert "speak" in result.lower()

def test_generate_solution_from_speech_fallback():
    engine = ContextLLMEngine(api_key="")
    query = "How should we scale our API to handle 10,000 requests per second?"
    solution = engine.generate_solution_from_speech(query)
    
    assert solution["query"] == query
    assert len(solution["suggested_answer"]) > 10
    assert len(solution["solution_points"]) >= 2
    assert "category" in solution
    assert "timestamp" in solution and solution["timestamp"] > 0

def test_generate_solution_empty_query():
    engine = ContextLLMEngine(api_key="")
    solution = engine.generate_solution_from_speech("   ")
    assert solution["query"] == ""
    assert solution["suggested_answer"] == ""
    assert solution["solution_points"] == []

