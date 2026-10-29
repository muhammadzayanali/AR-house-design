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

    def test_lda_tax_not_in_construction_cost(self):
        facts = _italian_facts()
        facts.update(
            {
                "house_name": "Italian Family Villa",
                "estimated_cost_min": 20_000_000,
                "estimated_cost_max": 28_000_000,
                "estimated_cost_pkr": 24_000_000,
                "floors": 2,
                "building_footprint_sqm": 132,
                "feasibility": {
                    "building_footprint_sqm": 132,
                    "remaining_area_sqm": 48,
                    "ground_coverage_percent": 73.3,
                },
                "room_program": {
                    "bedrooms": 3,
                    "bathrooms": 3,
                    "floors": 2,
                },
            }
        )
        q = "is in that we add the LDA tax ?"
        self.assertEqual(local_rag.detect_intent(q), "fees")
        result = local_rag.answer(facts, q)
        text = result["text"]
        self.assertIn("not included", text.lower())
        self.assertIn("20,000,000", text)
        self.assertIn("28,000,000", text)
        self.assertIn("15", text)
        self.assertNotIn("more beautiful", text.lower())
        self.assertNotIn("terracotta", text.lower())
        self.assertIn("lda-map-fee", result["debug"]["retrieved_ids"])

    def test_budget_adds_lda_fee(self):
        facts = _italian_facts()
        facts.update(
            {
                "house_name": "Italian Family Villa",
                "house_description": "Symmetrical Italianate villa with portico, arched openings, and terracotta roof.",
                "building_width_m": 12,
                "building_depth_m": 11,
                "building_height_m": 8.5,
                "floors": 2,
                "estimated_cost_min": 20_000_000,
                "estimated_cost_max": 28_000_000,
                "building_footprint_sqm": 132,
                "feasibility": {
                    "building_footprint_sqm": 132,
                    "remaining_area_sqm": 48,
                    "ground_coverage_percent": 73.3,
                },
                "room_program": {"bedrooms": 3, "bathrooms": 3, "floors": 2, "garage": True},
            }
        )
        q = "give me proper the budget of this house construction and also add the LDA tax in that"
        result = local_rag.answer(facts, q)
        text = result["text"]
        self.assertEqual(result["intent"], "fees")
        self.assertIn("20,000,000", text)
        self.assertIn("28,000,000", text)
        self.assertIn("Combined preliminary total", text)
        self.assertIn("portico", text.lower())
        self.assertNotIn("No. LDA tax is not included", text)

    def test_authority_not_stored(self):
        q = "then how i got that is this land is DHA or LDA?"
        result = local_rag.answer(_italian_facts(), q)
        text = result["text"].lower()
        self.assertEqual(result["intent"], "authority")
        self.assertIn("does not record", text)
        self.assertIn("allotment", text)
        self.assertNotIn("not included in the cost", text)

    def test_unrelated_question_does_not_dump_beauty_notes(self):
        result = local_rag.answer(_italian_facts(), "what is the weather tomorrow")
        self.assertNotIn("more beautiful", result["text"].lower())

    def test_retrieve_includes_project_facts(self):
        passages = local_rag.retrieve("coverage footprint", _italian_facts(), top_k=5)
        ids = {p["id"] for p in passages}
        self.assertIn("project-facts", ids)
