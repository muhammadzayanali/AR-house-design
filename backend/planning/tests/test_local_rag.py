"""Local RAG unit tests — consultant answers without Hugging Face."""
from django.test import TestCase

from planning.services import local_rag


def _italian_facts():
    return {
        "land_size_sqm": 180.0,
        "land_size_marla": 7.12,
        "land_size_kanal": 0.356,
        "land_size_acre": 0.0445,
        "measurement_type": "manual",
        "preferred_style": "Italian Villa",
        "house_name": "Italian Compact Villa",
        "house_style": "Italian Villa",
        "bedrooms": 3,
        "bathrooms": 2,
        "floors": 2,
        "building_footprint_sqm": 90,
        "estimated_cost_min": 14000000,
        "estimated_cost_max": 19000000,
        "estimated_cost_pkr": 16500000,
        "currency": "PKR",
        "model_type": "procedural",
        "recommendation_reason": "Exact match for Italian Villa on 7.12 Marla (180.0 m²).",
        "room_program": {
            "bedrooms": 3,
            "bathrooms": 2,
            "floors": 2,
            "living_rooms": 1,
            "dining_rooms": 1,
            "kitchens": 1,
            "parking_spaces": 1,
        },
        "feasibility": {
            "building_footprint_sqm": 90,
            "remaining_area_sqm": 90,
            "ground_coverage_percent": 50.0,
        },
    }


class LocalRagTests(TestCase):
    def test_beautify_italian_intent(self):
        q = "bro can you please explain me that how i made this house more beautify"
        self.assertEqual(local_rag.detect_intent(q), "beautify")
        result = local_rag.answer(_italian_facts(), q)
        self.assertEqual(result["source"], "local_rag")
        self.assertEqual(result["intent"], "beautify")
        text = result["text"].lower()
        self.assertIn("italian", text)
        self.assertTrue(
            "terracotta" in text or "portico" in text or "shutter" in text,
            msg="Expected villa beauty cues in answer",
        )
        self.assertNotIn("hf_token", text)
        self.assertTrue(result["passages"])

    def test_why_recommended(self):
        result = local_rag.answer(_italian_facts(), "Why was this house recommended?")
        self.assertEqual(result["intent"], "why")
        self.assertIn("Exact match", result["text"])
        self.assertIn("rule", result["text"].lower())

    def test_cost_grounded(self):
        result = local_rag.answer(_italian_facts(), "What is the estimated cost?")
        self.assertEqual(result["intent"], "cost")
        self.assertIn("14,000,000", result["text"])
        self.assertIn("19,000,000", result["text"])

    def test_retrieve_includes_project_facts(self):
        passages = local_rag.retrieve("coverage footprint", _italian_facts(), top_k=5)
        ids = {p["id"] for p in passages}
        self.assertIn("project-facts", ids)
