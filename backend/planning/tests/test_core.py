from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from planning.geometry import area_sqm_from_points, rectangle_area_sqm, shoelace_xz
from planning.models import HouseDesign, Project
from planning.recommendation import recommend_house
from planning.units import ACRE_SQM, KANAL_SQM, MARLA_SQM, sqm_to_units


class UnitsTests(TestCase):
    def test_one_marla(self):
        units = sqm_to_units(MARLA_SQM)
        self.assertAlmostEqual(units["marla"], 1.0, places=3)

    def test_one_kanal(self):
        units = sqm_to_units(KANAL_SQM)
        self.assertAlmostEqual(units["kanal"], 1.0, places=3)
        self.assertAlmostEqual(units["marla"], 20.0, places=3)

    def test_one_acre(self):
        units = sqm_to_units(ACRE_SQM)
        self.assertAlmostEqual(units["acre"], 1.0, places=4)
        self.assertAlmostEqual(units["marla"], 160.0, places=3)

    def test_example_180(self):
        units = sqm_to_units(180)
        self.assertAlmostEqual(units["marla"], 180 / MARLA_SQM, places=3)
        self.assertAlmostEqual(units["kanal"], 180 / KANAL_SQM, places=3)


class GeometryTests(TestCase):
    def test_rectangle_15x12(self):
        self.assertEqual(rectangle_area_sqm(15, 12), 180)

    def test_negative_rectangle(self):
        with self.assertRaises(ValueError):
            rectangle_area_sqm(-1, 12)

    def test_triangle(self):
        pts = [
            {"x": 0, "y": 0, "z": 0},
            {"x": 10, "y": 0, "z": 0},
            {"x": 0, "y": 0, "z": 10},
        ]
        self.assertAlmostEqual(shoelace_xz(pts), 50.0, places=5)

    def test_irregular_quad(self):
        pts = [
            {"x": 0, "y": 0, "z": 0},
            {"x": 20, "y": 0, "z": 0},
            {"x": 20, "y": 0, "z": 15},
            {"x": 0, "y": 0, "z": 12},
        ]
        self.assertGreater(area_sqm_from_points(pts), 0)

    def test_insufficient_points(self):
        self.assertEqual(area_sqm_from_points([]), 0)
        self.assertEqual(area_sqm_from_points([{"x": 0, "y": 0, "z": 0}]), 0)


class RecommendationTests(TestCase):
    def setUp(self):
        HouseDesign.objects.create(
            name="Small",
            style="A",
            glb_url="/models/a.glb",
            recommended_min_plot=50,
            recommended_max_plot=140,
            bedrooms=2,
            bathrooms=1,
            floors=1,
            parking=False,
            active=True,
        )
        HouseDesign.objects.create(
            name="Medium",
            style="B",
            glb_url="/models/b.glb",
            recommended_min_plot=140,
            recommended_max_plot=280,
            bedrooms=3,
            bathrooms=2,
            floors=2,
            parking=True,
            active=True,
        )
        HouseDesign.objects.create(
            name="Inactive Large",
            style="C",
            glb_url="/models/c.glb",
            recommended_min_plot=280,
            recommended_max_plot=560,
            bedrooms=5,
            bathrooms=4,
            floors=2,
            parking=True,
            active=False,
        )

    def test_small_plot(self):
        house, reason = recommend_house(90)
        self.assertEqual(house.name, "Small")
        self.assertIn("lookup", reason.lower())

    def test_medium_plot(self):
        house, _ = recommend_house(180)
        self.assertEqual(house.name, "Medium")

    def test_boundary_min(self):
        house, _ = recommend_house(141)
        self.assertEqual(house.name, "Medium")

    def test_shared_boundary_prefers_closer_midpoint(self):
        house, _ = recommend_house(140)
        self.assertEqual(house.name, "Small")

    def test_inactive_excluded(self):
        house, reason = recommend_house(400)
        self.assertNotEqual(house.name, "Inactive Large")
        self.assertIn("outside", reason.lower())


class FeasibilityTests(TestCase):
    def setUp(self):
        self.house = HouseDesign.objects.create(
            name="FitHouse",
            style="Modern",
            recommended_min_plot=140,
            recommended_max_plot=220,
            bedrooms=3,
            bathrooms=2,
            floors=2,
            building_width_m=10,
            building_depth_m=10,
            building_footprint_sqm=100,
            parking_spaces=1,
            living_rooms=1,
            dining_rooms=1,
            kitchens=1,
            active=True,
        )

    def test_coverage(self):
        from planning.feasibility import compute_feasibility

        f = compute_feasibility(180, self.house, 15, 12)
        self.assertEqual(f["building_footprint_sqm"], 100)
        self.assertAlmostEqual(f["remaining_area_sqm"], 80)
        self.assertAlmostEqual(f["ground_coverage_percent"], 55.6, places=0)
        self.assertEqual(f["status"], "suitable_preliminary")

    def test_oversized(self):
        from planning.feasibility import compute_feasibility

        big = HouseDesign.objects.create(
            name="Huge",
            style="Luxury Villa",
            recommended_min_plot=400,
            recommended_max_plot=800,
            bedrooms=6,
            bathrooms=5,
            floors=2,
            building_width_m=20,
            building_depth_m=20,
            building_footprint_sqm=400,
            active=True,
        )
        f = compute_feasibility(180, big)
        self.assertEqual(f["status"], "oversized")

    def test_style_filter_exact(self):
        from planning.feasibility import filter_designs

        result = filter_designs(
            HouseDesign.objects.all(), style="Modern", plot_area=180
        )
        self.assertEqual(result["match_kind"], "exact")
        self.assertTrue(any(h.name == "FitHouse" for h in result["exact"]))

    def test_style_filter_nearby(self):
        from planning.feasibility import filter_designs

        result = filter_designs(
            HouseDesign.objects.all(), style="Modern", plot_area=90
        )
        self.assertEqual(result["match_kind"], "nearby")
        self.assertEqual(len(result["exact"]), 0)
        self.assertTrue(len(result["nearby"]) >= 1)


class DesignMatchApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        HouseDesign.objects.create(
            name="Italian Family Villa Test",
            style="Italian Villa",
            recommended_min_plot=160,
            recommended_max_plot=260,
            bedrooms=3,
            bathrooms=3,
            floors=2,
            building_width_m=12,
            building_depth_m=11,
            building_footprint_sqm=132,
            parking_spaces=1,
            active=True,
        )

    def test_match_italian_180(self):
        r = self.client.get("/api/designs/match/", {"style": "Italian Villa", "plot_area": 180})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["match_kind"], "exact")
        self.assertGreaterEqual(len(r.data["exact"]), 1)

    def test_styles_list(self):
        r = self.client.get("/api/styles/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data["styles"]), 7)


class AuthOwnershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.a = User.objects.create_user("alice", password="secret12")
        self.b = User.objects.create_user("bob", password="secret12")
        self.house = HouseDesign.objects.create(
            name="H",
            style="S",
            glb_url="/models/h.glb",
            recommended_min_plot=50,
            recommended_max_plot=500,
            bedrooms=2,
            bathrooms=1,
            floors=1,
        )
        self.project_a = Project.objects.create(
            user=self.a,
            land_size_sqm=180,
            selected_house=self.house,
            measurement_type=Project.MEASUREMENT_MANUAL,
        )
        self.token_b = Token.objects.create(user=self.b)

    def test_register_login(self):
        r = self.client.post(
            "/api/auth/register/",
            {"username": "carol", "password": "secret12", "email": "c@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertIn("token", r.data)

    def test_ownership_isolation(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token_b.key)
        r = self.client.get("/api/projects/{}/".format(self.project_a.id))
        self.assertEqual(r.status_code, 404)

    def test_owner_can_delete(self):
        token_a = Token.objects.create(user=self.a)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + token_a.key)
        r = self.client.delete("/api/projects/{}/".format(self.project_a.id))
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Project.objects.filter(pk=self.project_a.id).exists())

    def test_create_project(self):
        token_a = Token.objects.create(user=self.a)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + token_a.key)
        r = self.client.post(
            "/api/projects/",
            {
                "land_size_sqm": 180,
                "measurement_type": "manual",
                "plot_length_m": 15,
                "plot_width_m": 12,
                "selected_house_id": self.house.id,
                "recommendation_reason": "test",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertAlmostEqual(r.data["marla"], 180 / MARLA_SQM, places=2)
