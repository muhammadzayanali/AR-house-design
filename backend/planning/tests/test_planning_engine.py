"""Tests for planning bands, room sizes, Lahore cost, and 180 m² demo."""
from django.test import TestCase

from planning.cost_estimate import estimate_construction_cost
from planning.feasibility import compute_feasibility, preliminary_space_estimate
from planning.models import HouseDesign
from planning.planning_engine import (
    build_preliminary_plan,
    calculate_room_area,
    design_planning_overlay,
    get_planning_band,
    validate_planning_profile,
    validate_room_program,
)
from planning.units import sqm_to_sqft, sqm_to_units


class PlanningEngineTests(TestCase):
    def test_band_boundaries(self):
        cases = [
            (50, "0_100"),
            (100, "100_150"),
            (100.01, "100_150"),
            (150, "150_220"),
            (150.01, "150_220"),
            (180, "150_220"),
            (220, "220_350"),
            (220.01, "220_350"),
            (350, "350_500"),
            (500, "500_plus"),
            (501, "500_plus"),
        ]
        for area, band_id in cases:
            self.assertEqual(get_planning_band(area)["id"], band_id, msg=area)

    def test_180_units(self):
        units = sqm_to_units(180)
        self.assertAlmostEqual(units["marla"], 7.117, places=2)
        self.assertAlmostEqual(units["sqft"], 1937.5, places=0)

    def test_180_preliminary_program(self):
        plan = build_preliminary_plan(180)
        prog = plan["room_program"]
        self.assertEqual(prog["bedrooms"], 3)
        self.assertEqual(prog["bathrooms"], 3)
        self.assertEqual(prog["powder_rooms"], 1)
        self.assertEqual(prog["kitchens"], 1)
        self.assertEqual(prog["dining_rooms"], 1)
        self.assertEqual(prog["drawing_rooms"], 1)
        self.assertEqual(prog["family_lounges"], 1)
        self.assertEqual(prog["parking_spaces_min"], 1)
        self.assertEqual(prog["parking_spaces_max"], 2)
        self.assertEqual(prog["floors"], 2)
        sizes = plan["room_sizes"]
        self.assertEqual(sizes["master_bedroom"]["length_ft"], 12)
        self.assertEqual(sizes["master_bedroom"]["width_ft"], 14)
        self.assertEqual(sizes["bedroom_2"]["length_ft"], 11)
        self.assertEqual(sizes["bedroom_2"]["width_ft"], 12)
        self.assertEqual(sizes["bedroom_3"]["length_ft"], 10)
        self.assertEqual(sizes["bedroom_3"]["width_ft"], 12)
        cost = plan["cost_estimate"]
        self.assertEqual(cost["currency"], "PKR")
        self.assertEqual(cost["source"], "Lahore reference benchmark")
        self.assertTrue(cost["is_estimate"])
        self.assertGreaterEqual(cost["min"], 0)
        self.assertGreaterEqual(cost["max"], cost["min"])

    def test_room_area_validation(self):
        self.assertEqual(calculate_room_area(12, 14), 168)
        with self.assertRaises(ValueError):
            calculate_room_area(0, 10)
        ok, _ = validate_room_program({"bedrooms": 3, "bathrooms": 3})
        self.assertTrue(ok)
        ok, reason = validate_planning_profile(
            {
                "room_program": {"bedrooms": 3},
                "room_sizes": {"master_bedroom": {"length_ft": 12, "width_ft": 14, "area_sqft": 999}},
            }
        )
        self.assertFalse(ok)

    def test_cost_non_negative_covered(self):
        cost = estimate_construction_cost(covered_area_m2=90, plot_area_m2=180)
        self.assertGreater(cost["covered_area_sqft"], 0)
        self.assertGreater(cost["reference_rate_pkr_per_sqft"], 0)
        self.assertIn("Lahore", cost["source"])


class ItalianCompactIntegrationTests(TestCase):
    def setUp(self):
        self.house = HouseDesign.objects.create(
            name="Italian Compact Villa Test",
            style="Italian Villa",
            recommended_min_plot=120,
            recommended_max_plot=180,
            building_width_m=10,
            building_depth_m=9,
            building_footprint_sqm=90,
            floors=2,
            bedrooms=3,
            bathrooms=3,
            powder_rooms=1,
            living_rooms=1,
            family_rooms=1,
            dining_rooms=1,
            drawing_rooms=1,
            kitchens=1,
            parking_spaces=1,
            parking_spaces_max=2,
            room_sizes={
                "master_bedroom": {"length_ft": 12, "width_ft": 14, "area_sqft": 168},
                "bedroom_2": {"length_ft": 11, "width_ft": 12, "area_sqft": 132},
                "bedroom_3": {"length_ft": 10, "width_ft": 12, "area_sqft": 120},
            },
            estimated_cost_pkr=16_000_000,
            estimated_cost_min=14_000_000,
            estimated_cost_max=19_000_000,
            active=True,
        )

    def test_feasibility_180(self):
        f = compute_feasibility(180, self.house, 15, 12)
        self.assertEqual(f["building_footprint_sqm"], 90)
        self.assertEqual(f["remaining_area_sqm"], 90)
        self.assertEqual(f["ground_coverage_percent"], 50.0)
        self.assertEqual(f["status"], "suitable_preliminary")

    def test_design_overlay_authoritative(self):
        overlay = design_planning_overlay(self.house, 180)
        self.assertEqual(overlay["room_program"]["bathrooms"], 3)
        self.assertEqual(overlay["room_program"]["powder_rooms"], 1)
        self.assertEqual(overlay["planning"]["covered_area_m2"], 90)
        self.assertEqual(overlay["room_sizes"]["master_bedroom"]["length_ft"], 12)

    def test_space_estimate_api(self):
        r = self.client.post(
            "/api/space-estimate/",
            {"land_size_sqm": 180},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["planning_summary"]["room_program"]["bedrooms"], 3)
        self.assertIn("sqft", r.data["land_units"])

    def test_planning_summary_with_house(self):
        r = self.client.post(
            "/api/planning/summary/",
            {"land_size_sqm": 180, "house_id": self.house.id},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["feasibility"]["building_footprint_sqm"], 90)
        self.assertEqual(r.data["cost_estimate"]["currency"], "PKR")

    def test_preliminary_space_wrapper(self):
        prelim = preliminary_space_estimate(180)
        self.assertEqual(prelim["room_program"]["bedrooms"], 3)
        self.assertIn("cost_estimate", prelim)
