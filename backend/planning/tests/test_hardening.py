"""Hardening tests: grounded facts, AI validator, master dataset, RAG."""
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from planning.geometry import area_sqm_from_points, rectangle_area_sqm
from planning.grounded_context import build_grounded_context, match_reason_block
from planning.models import HouseDesign, Project
from planning.narration import answer_question, project_facts
from planning.services.ai_validator import validate_ai_text
from planning.services import local_rag
from planning.test_dataset import CASE_10X10, CASE_10X20, CASE_15X12, CASE_TRIANGLE_50
from planning.units import sqm_to_units


class MasterDatasetTests(TestCase):
    def test_case_15x12(self):
        self.assertEqual(rectangle_area_sqm(CASE_15X12["length_m"], CASE_15X12["width_m"]), 180)
        self.assertEqual(area_sqm_from_points(CASE_15X12["polygon_xz"]), 180)
        units = sqm_to_units(180)
        self.assertAlmostEqual(units["marla"], CASE_15X12["marla"], places=3)
        self.assertAlmostEqual(units["kanal"], CASE_15X12["kanal"], places=4)

    def test_case_10x20(self):
        self.assertEqual(
            rectangle_area_sqm(CASE_10X20["length_m"], CASE_10X20["width_m"]),
            CASE_10X20["area_sqm"],
        )

    def test_case_10x10(self):
        self.assertEqual(
            rectangle_area_sqm(CASE_10X10["length_m"], CASE_10X10["width_m"]),
            CASE_10X10["area_sqm"],
        )

    def test_triangle(self):
        self.assertEqual(
            area_sqm_from_points(CASE_TRIANGLE_50["polygon_xz"]),
            CASE_TRIANGLE_50["area_sqm"],
        )


class GroundedContextTests(TestCase):
    def setUp(self):
        self.house = HouseDesign.objects.create(
            name="Italian Compact Villa",
            style="Italian Villa",
            glb_url="",
            recommended_min_plot=120,
            recommended_max_plot=180,
            building_width_m=10,
            building_depth_m=9,
            building_footprint_sqm=90,
            bedrooms=3,
            bathrooms=2,
            floors=2,
            living_rooms=1,
            dining_rooms=1,
            kitchens=1,
            parking_spaces=1,
            estimated_cost_pkr=16_000_000,
            estimated_cost_min=14_000_000,
            estimated_cost_max=19_000_000,
            model_type="procedural",
            active=True,
        )
        self.user = User.objects.create_user("guser", password="pass12345")
        self.project = Project.objects.create(
            user=self.user,
            name="T15x12",
            land_size_sqm=180,
            plot_length_m=15,
            plot_width_m=12,
            measurement_type="manual",
            preferred_style="Italian Villa",
            selected_house=self.house,
            recommendation_reason="test",
        )

    def test_facts_vs_estimates(self):
        facts = project_facts(self.project)
        g = facts["grounded"]
        self.assertIn("facts", g)
        self.assertIn("estimates", g)
        self.assertIn("limitations", g)
        self.assertEqual(g["facts"]["plot_area_sqm"], 180)
        self.assertEqual(g["facts"]["bedrooms"], 3)
        self.assertEqual(g["facts"]["building_footprint_sqm"], 90)
        self.assertEqual(g["facts"]["coverage_percent"], 50.0)
        self.assertEqual(g["estimates"]["catalog_cost_min"], 14_000_000)
        self.assertEqual(g["estimates"]["catalog_cost_max"], 19_000_000)
        self.assertIn("Lahore", g["estimates"]["cost_source"] or "")
        self.assertGreater(g["estimates"]["cost_min"], 0)
        self.assertGreaterEqual(g["estimates"]["cost_max"], g["estimates"]["cost_min"])
        self.assertTrue(len(g["limitations"]) >= 3)

    def test_match_reason_block(self):
        text = match_reason_block(
            plot_area=180,
            land_label="7.12 Marla (180.0 m²)",
            house=self.house,
            feasibility={
                "building_footprint_sqm": 90,
                "remaining_area_sqm": 90,
                "ground_coverage_percent": 50.0,
            },
            exact=True,
        )
        self.assertIn("180", text)
        self.assertIn("90", text)
        self.assertIn("50.0%", text)
        self.assertIn("deterministic", text.lower())


class AiValidatorTests(TestCase):
    def setUp(self):
        self.grounded = build_grounded_context(
            {
                "land_size_sqm": 180,
                "land_size_marla": 7.117,
                "land_size_kanal": 0.3558,
                "land_size_acre": 0.04448,
                "house_name": "Italian Compact Villa",
                "house_style": "Italian Villa",
                "preferred_style": "Italian Villa",
                "bedrooms": 3,
                "bathrooms": 2,
                "floors": 2,
                "building_footprint_sqm": 90,
                "building_width_m": 10,
                "building_depth_m": 9,
                "estimated_cost_min": 14_000_000,
                "estimated_cost_max": 19_000_000,
                "estimated_cost_pkr": 16_000_000,
                "room_program": {"bedrooms": 3, "bathrooms": 2, "floors": 2},
                "feasibility": {
                    "building_footprint_sqm": 90,
                    "remaining_area_sqm": 90,
                    "ground_coverage_percent": 50.0,
                },
            }
        )

    def test_rejects_setback_claim(self):
        ok, reason = validate_ai_text(
            "You must keep a 3 metre setback from the road per municipal bylaw.",
            self.grounded,
        )
        self.assertFalse(ok)
        self.assertIn("regulation", reason or "")

    def test_allows_negated_disclaimer(self):
        ok, _ = validate_ai_text(
            "This system does not check setbacks or municipal bylaws.",
            self.grounded,
        )
        self.assertTrue(ok)

    def test_rejects_bedroom_mismatch(self):
        ok, reason = validate_ai_text(
            "Your villa has 5 bedrooms and a large wing.",
            self.grounded,
        )
        self.assertFalse(ok)
        self.assertIn("bedroom", reason or "")

    def test_rejects_footprint_mismatch(self):
        ok, reason = validate_ai_text(
            "The building footprint is exactly 145 square metres.",
            self.grounded,
        )
        self.assertFalse(ok)
        self.assertIn("footprint", reason or "")

    def test_accepts_grounded_text(self):
        ok, _ = validate_ai_text(
            "Your Italian Compact Villa has 3 bedrooms on a 180 m² plot with 50% coverage.",
            self.grounded,
        )
        self.assertTrue(ok)


@override_settings(HF_TOKEN="")
class AskGroundingApiTests(TestCase):
    def setUp(self):
        self.house = HouseDesign.objects.create(
            name="Italian Compact Villa",
            style="Italian Villa",
            glb_url="",
            recommended_min_plot=120,
            recommended_max_plot=180,
            building_width_m=10,
            building_depth_m=9,
            building_footprint_sqm=90,
            bedrooms=3,
            bathrooms=2,
            floors=2,
            living_rooms=1,
            dining_rooms=1,
            kitchens=1,
            parking_spaces=1,
            estimated_cost_min=14_000_000,
            estimated_cost_max=19_000_000,
            estimated_cost_pkr=16_000_000,
            active=True,
            model_type="procedural",
        )
        self.user = User.objects.create_user("asku", password="pass12345")
        self.token = Token.objects.create(user=self.user)
        self.project = Project.objects.create(
            user=self.user,
            land_size_sqm=180,
            plot_length_m=15,
            plot_width_m=12,
            measurement_type="manual",
            preferred_style="Italian Villa",
            selected_house=self.house,
            recommendation_reason="Exact match test",
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

    def test_ask_includes_grounded_and_project_facts(self):
        # Force local path by asking; HF may or may not run — grounded must exist
        r = self.client.post(
            "/api/projects/{}/ask/?debug=1".format(self.project.id),
            {"question": "Why was this house recommended?"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("grounded", r.data)
        self.assertEqual(r.data["grounded"]["facts"]["plot_area_sqm"], 180)
        self.assertEqual(r.data["grounded"]["facts"]["bedrooms"], 3)
        self.assertTrue(r.data.get("debug") is None or r.data["debug"]["project_facts_included"])

    def test_design_match_reason(self):
        r = self.client.get(
            "/api/designs/match/?style=Italian%20Villa&plot_area=180"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["match_kind"], "exact")
        self.assertTrue(r.data["exact"])
        self.assertIn("match_reason", r.data["exact"][0])
        self.assertIn("180", r.data["exact"][0]["match_reason"])
        self.assertIn("feasibility_preview", r.data["exact"][0])
