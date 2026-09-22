from django.contrib.auth.models import User
from rest_framework import serializers

from .feasibility import compute_feasibility, design_room_program
from .models import HouseDesign, Project, Report
from .units import sqm_to_units


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "date_joined", "last_login")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )


class HouseDesignSerializer(serializers.ModelSerializer):
    room_program = serializers.SerializerMethodField()
    plot_range = serializers.SerializerMethodField()

    class Meta:
        model = HouseDesign
        fields = (
            "id",
            "name",
            "style",
            "description",
            "glb_url",
            "model_url",
            "thumbnail_url",
            "gallery_images",
            "recommended_min_plot",
            "recommended_max_plot",
            "min_plot_area_sqm",
            "max_plot_area_sqm",
            "recommended_width_m",
            "recommended_depth_m",
            "building_width_m",
            "building_depth_m",
            "building_height_m",
            "building_footprint_sqm",
            "bedrooms",
            "bathrooms",
            "floors",
            "living_rooms",
            "family_rooms",
            "dining_rooms",
            "kitchens",
            "parking_spaces",
            "balconies",
            "terraces",
            "garage",
            "pool",
            "garden",
            "parking",
            "estimated_cost_pkr",
            "estimated_cost_min",
            "estimated_cost_max",
            "currency",
            "model_type",
            "model_config",
            "model_width_m",
            "model_depth_m",
            "model_height_m",
            "source_provider",
            "source_model_id",
            "source_license",
            "source_attribution",
            "commercial_use_allowed",
            "attribution_required",
            "active",
            "room_program",
            "plot_range",
        )

    def get_room_program(self, obj):
        return design_room_program(obj)

    def get_plot_range(self, obj):
        return {
            "min_sqm": obj.effective_min_plot,
            "max_sqm": obj.effective_max_plot,
        }


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = (
            "id",
            "project",
            "narration_text",
            "generated_at",
            "updated_at",
            "source",
            "model_name",
        )
        read_only_fields = fields


class ProjectSerializer(serializers.ModelSerializer):
    selected_house = HouseDesignSerializer(read_only=True)
    selected_house_id = serializers.PrimaryKeyRelatedField(
        queryset=HouseDesign.objects.filter(active=True),
        source="selected_house",
        write_only=True,
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": (
                "That house design is no longer available (it may have been replaced "
                "by the new catalog). Go back, pick a design again, then save."
            ),
            "incorrect_type": "selected_house_id must be an integer id.",
        },
    )
    plot_points = serializers.JSONField(required=False)
    land_units = serializers.SerializerMethodField()
    latest_report = serializers.SerializerMethodField()
    screenshot_url = serializers.SerializerMethodField()
    feasibility = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "land_size_sqm",
            "plot_length_m",
            "plot_width_m",
            "measurement_type",
            "land_size_display_unit",
            "marla",
            "kanal",
            "acre",
            "preferred_style",
            "selected_house",
            "selected_house_id",
            "screenshot",
            "screenshot_url",
            "plot_points",
            "recommendation_reason",
            "feasibility_snapshot",
            "feasibility",
            "created_at",
            "updated_at",
            "land_units",
            "latest_report",
        )
        read_only_fields = (
            "marla",
            "kanal",
            "acre",
            "feasibility_snapshot",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {"screenshot": {"write_only": True, "required": False}}

    def validate_land_size_sqm(self, value):
        if value is None or float(value) <= 0:
            raise serializers.ValidationError("land_size_sqm must be > 0")
        return value

    def validate_plot_points(self, value):
        if isinstance(value, str):
            import json

            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("plot_points must be JSON")
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("plot_points must be a list")
        for point in value:
            if not isinstance(point, dict) or not all(k in point for k in ("x", "y", "z")):
                raise serializers.ValidationError(
                    "Each plot point must include x, y, z"
                )
        return value

    def validate(self, attrs):
        measurement = attrs.get(
            "measurement_type",
            getattr(self.instance, "measurement_type", Project.MEASUREMENT_MANUAL),
        )
        points = attrs.get("plot_points", None)
        if points is None and self.instance is not None:
            points = self.instance.plot_points
        if measurement == Project.MEASUREMENT_AR and points is not None and len(points) > 0 and len(points) < 3:
            raise serializers.ValidationError(
                {"plot_points": "AR polygons need at least 3 boundary points."}
            )
        length = attrs.get("plot_length_m")
        width = attrs.get("plot_width_m")
        if length is not None and float(length) <= 0:
            raise serializers.ValidationError({"plot_length_m": "Must be > 0"})
        if width is not None and float(width) <= 0:
            raise serializers.ValidationError({"plot_width_m": "Must be > 0"})
        return attrs

    def get_land_units(self, obj):
        return sqm_to_units(obj.land_size_sqm)

    def get_latest_report(self, obj):
        report = obj.reports.first()
        return ReportSerializer(report).data if report else None

    def get_screenshot_url(self, obj):
        if not obj.screenshot:
            return None
        return obj.screenshot.url

    def get_feasibility(self, obj):
        if obj.feasibility_snapshot:
            return obj.feasibility_snapshot
        if not obj.selected_house:
            return None
        return compute_feasibility(
            obj.land_size_sqm,
            obj.selected_house,
            obj.plot_length_m,
            obj.plot_width_m,
        )

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        units = sqm_to_units(validated_data["land_size_sqm"])
        validated_data.setdefault("land_size_display_unit", units["display_unit"])
        validated_data["marla"] = units["marla"]
        validated_data["kanal"] = units["kanal"]
        validated_data["acre"] = units["acre"]
        house = validated_data.get("selected_house")
        if house:
            validated_data["feasibility_snapshot"] = compute_feasibility(
                validated_data["land_size_sqm"],
                house,
                validated_data.get("plot_length_m"),
                validated_data.get("plot_width_m"),
            )
            if not validated_data.get("preferred_style"):
                validated_data["preferred_style"] = house.style
        if not validated_data.get("name"):
            validated_data["name"] = "Plot {}".format(units["display_label"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "land_size_sqm" in validated_data:
            units = sqm_to_units(validated_data["land_size_sqm"])
            validated_data["marla"] = units["marla"]
            validated_data["kanal"] = units["kanal"]
            validated_data["acre"] = units["acre"]
            validated_data.setdefault("land_size_display_unit", units["display_unit"])
        house = validated_data.get("selected_house", instance.selected_house)
        sqm = validated_data.get("land_size_sqm", instance.land_size_sqm)
        length = validated_data.get("plot_length_m", instance.plot_length_m)
        width = validated_data.get("plot_width_m", instance.plot_width_m)
        if house:
            validated_data["feasibility_snapshot"] = compute_feasibility(
                sqm, house, length, width
            )
        return super().update(instance, validated_data)
