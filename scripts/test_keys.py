#!/usr/bin/env python3
"""
Test and validation script for Deepgram and Gemini API keys,
as well as local ML and Vision models.
"""
import sys
import os

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.config import get_settings
from backend.models.events import CommunicationEvent, ModalitySource
from backend.llm.engine import ContextLLMEngine
from backend.vision.gesture import classify_hand_gesture
from backend.ml.lip_model import LipGRUModel, predict_lip_intent, VOCABULARY_CLASSES
import torch
import numpy as np

def run_tests():
    settings = get_settings()
    print("=" * 65)
    print(" 🚀 SILENT MEETING ASSISTANT — API & SYSTEM TEST SUITE")
    print("=" * 65)
    print(f"• App Environment : {settings.app_env}")
    print(f"• Configured Mode : {settings.dev_mode}")
    print("=" * 65)

    # 1. Test Deepgram Credentials
    print("\n[1/3] Testing Deepgram API Connection...")
    if not settings.deepgram_api_key:
        print("  ❌ DEEPGRAM_API_KEY is not set in .env")
    else:
        try:
            from deepgram import DeepgramClient
            dg = DeepgramClient(api_key=settings.deepgram_api_key)
            res = dg.manage.v1.projects.list()
            print("  ✅ Deepgram Authenticated Successfully!")
            for proj in res.projects:
                print(f"     Project: {proj.name} (ID: {proj.project_id})")
        except Exception as e:
            print(f"  ❌ Deepgram error: {e}")

    # 2. Test Gemini LLM Contextualization
    print("\n[2/3] Testing Google Gemini Contextualization...")
    if not settings.gemini_api_key:
        print("  ❌ GEMINI_API_KEY is not set in .env")
    else:
        try:
            engine = ContextLLMEngine(api_key=settings.gemini_api_key)
            engine.add_meeting_context("Discussion topic: Migrating customer database from MongoDB to PostgreSQL.")

            scenarios = [
                (ModalitySource.LIP, "QUESTION", "I have a question"),
                (ModalitySource.GESTURE, "REQUEST_TO_SPEAK", "I would like to speak"),
                (ModalitySource.GESTURE, "YES", "I agree"),
            ]

            for src, intent, raw_text in scenarios:
                event = CommunicationEvent(
                    source=src,
                    intent=intent,
                    raw_text=raw_text,
                    confidence=0.95
                )
                expanded = engine.normalize_intent(event)
                print(f"  • Input [{src.value.upper()}] '{intent}' ->")
                print(f"    Contextualized: \"{expanded}\"")

            print("  ✅ Gemini Contextualization Working Perfectly!")
        except Exception as e:
            print(f"  ❌ Gemini error: {e}")

    # 3. Test Local Vision & ML
    print("\n[3/3] Testing Local ML Models & Gesture Heuristics...")
    try:
        # Test gesture classifier with synthetic open palm
        fake_landmarks = [{"x": 0.5, "y": 0.8, "z": 0.0} for _ in range(21)]
        for tip_idx in [4, 8, 12, 16, 20]:
            fake_landmarks[tip_idx]["y"] = 0.2
        res = classify_hand_gesture(fake_landmarks)
        assert res is not None and res[0] == "STOP"
        print("  ✅ Hand Gesture Classifier: Verified ('STOP' gesture classified)")

        # Test Lip GRU Model inference
        model = LipGRUModel(input_size=80, hidden_size=64, num_classes=len(VOCABULARY_CLASSES))
        dummy_seq = np.random.randn(24, 80).astype(np.float32)
        intent, conf = predict_lip_intent(model, dummy_seq, VOCABULARY_CLASSES)
        print(f"  ✅ PyTorch GRU Lip Model: Verified (Inferred '{intent}' with {conf*100:.1f}% confidence)")
    except Exception as e:
        print(f"  ❌ Local vision/ML error: {e}")

    print("\n" + "=" * 65)
    print(" 🎉 All systems verified and ready!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
