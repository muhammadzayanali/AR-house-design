"""Part A logic: tie-break, polygon rejection, one cost basis, CORS without DEBUG."""

import math

from django.test import TestCase

from config.runtime_hosts import resolve_hosts
from planning.geometry import area_sqm_from_points, assess_polygon, rectangle_area_sqm
from planning.models import HouseDesign
from planning.recommendation import recommend_house
from planning.services.local_rag import answer


def _pt(x, z):
    return {"x": x, "y": 0, "z": z}


def _rotate(x, z, ang):
    c, s = math.cos(ang), math.sin(ang)
    return _pt(x * c - z * s, x * s + z * c)


class PolygonTests(TestCase):
    def test_rotated_rectangle_keeps_area(self):
        ang = 0.4
        pts = [_rotate(x, z, ang) for x, z in ((0, 0), (10, 0), (10, 4), (0, 4))]
        found = assess_polygon(pts)
        self.assertEqual(found["status"], "ok")
        self.assertAlmostEqual(found["area_sqm"], 40.0, places=4)
        self.assertAlmostEqual(area_sqm_from_points(pts), 40.0, places=4)

    def test_bow_tie_is_rejected(self):
        pts = [_pt(0, 0), _pt(2, 2), _pt(2, 0), _pt(0, 2)]
        found = assess_polygon(pts)
        self.assertEqual(found["status"], "self_intersecting")
        self.assertEqual(found["area_sqm"], 0.0)
        self.assertEqual(area_sqm_from_points(pts), 0.0)

    def test_collinear_is_not_squared(self):
        pts = [_pt(0, 0), _pt(5, 0), _pt(10, 0)]
        found = assess_polygon(pts)
        self.assertEqual(found["status"], "collinear")
        self.assertEqual(found["area_sqm"], 0.0)
        self.assertNotEqual(area_sqm_from_points(pts), 100.0)

    def test_two_points_ask_for_a_third(self):
        found = assess_polygon([_pt(0, 0), _pt(15, 0)])
        self.assertEqual(found["status"], "need_third_corner")
        self.assertEqual(area_sqm_from_points([_pt(0, 0), _pt(15, 0)]), 0.0)
        self.assertEqual(rectangle_area_sqm(15, 12), 180.0)


class TieBreakTests(TestCase):
    def test_equal_distance_prefers_lower_coverage_then_price(self):
        HouseDesign.objects.update(active=False)
        compact = dict(
            style="Italian Villa",
            glb_url="",
            recommended_min_plot=120,
            recommended_max_plot=180,
            building_width_m=10,
            building_depth_m=9,
            building_footprint_sqm=90,
            estimated_cost_pkr=16_000_000,
            bedrooms=3,
            bathrooms=3,
            floors=2,
            parking=True,
            active=True,
        )
        family = dict(
            style="Italian Villa",
            glb_url="",
            recommended_min_plot=160,
            recommended_max_plot=260,
            building_width_m=12,
            building_depth_m=11,
            building_footprint_sqm=132,
            estimated_cost_pkr=24_000_000,
            bedrooms=3,
            bathrooms=3,
            floors=2,
            parking=True,
            active=True,
        )
        HouseDesign.objects.update_or_create(name="Italian Compact Villa", defaults=compact)
        HouseDesign.objects.update_or_create(name="Italian Family Villa", defaults=family)
        house, reason = recommend_house(180)
        self.assertEqual(house.name, "Italian Compact Villa")
        self.assertIn("Also fits: Italian Family Villa", reason)


class CostBasisTests(TestCase):
    def test_budget_shows_one_range(self):
        facts = {
            "house_name": "Italian Compact Villa",
            "house_style": "Italian Villa",
            "land_size_sqm": 180,
            "land_size_marla": 7.12,
            "building_width_m": 10,
            "building_depth_m": 9,
            "building_height_m": 7,
            "floors": 2,
            "estimated_cost_min": 14_000_000,
            "estimated_cost_max": 19_000_000,
            "estimated_cost_pkr": 16_000_000,
            "room_program": {"bedrooms": 3, "bathrooms": 3, "floors": 2},
            "feasibility": {"building_footprint_sqm": 90, "remaining_area_sqm": 90, "ground_coverage_percent": 50},
            "cost_estimate": {
                "min": 7_650_000,
                "max": 9_737_000,
                "reference_rate_pkr_per_sqft": 4487,
            },
        }
        text = answer(facts, "give me the construction budget and add the LDA tax")["text"]
        self.assertIn("Primary basis: catalogue band", text)
        self.assertIn("14,000,000", text)
        self.assertIn("19,000,000", text)
        self.assertNotIn("7,650,000", text)
        self.assertNotIn("9,737,000", text)


class HostTests(TestCase):
    def test_debug_off_uses_env_only(self):
        found = resolve_hosts(False, "api.example.com,.trycloudflare.com", "https://plotline.netlify.app")
        self.assertFalse(found["cors_allow_all"])
        self.assertEqual(found["hosts"], ["api.example.com", ".trycloudflare.com"])
        self.assertEqual(found["cors_origins"], ["https://plotline.netlify.app"])
        self.assertNotIn("*", found["hosts"])
