"""Expanded HouseDesign catalog + Project + Report models."""
from django.conf import settings
from django.db import models
from django.utils import timezone


class HouseDesign(models.Model):
    """Catalog entry: procedural Three.js config and/or optional GLB asset."""

    MODEL_PROCEDURAL = "procedural"
    MODEL_GLB = "glb"
    MODEL_TYPE_CHOICES = (
        (MODEL_PROCEDURAL, "Procedural Three.js"),
        (MODEL_GLB, "Local / hosted GLB"),
    )

    name = models.CharField(max_length=120, unique=True)
    style = models.CharField(max_length=80, db_index=True)
    description = models.TextField(blank=True)

    # Legacy aliases kept for compatibility (same values as min/max plot area)
    recommended_min_plot = models.FloatField(help_text="Inclusive minimum plot size in m²")
    recommended_max_plot = models.FloatField(help_text="Inclusive maximum plot size in m²")
    min_plot_area_sqm = models.FloatField(null=True, blank=True)
    max_plot_area_sqm = models.FloatField(null=True, blank=True)

    recommended_width_m = models.FloatField(null=True, blank=True)
    recommended_depth_m = models.FloatField(null=True, blank=True)

    building_width_m = models.FloatField(default=10.0)
    building_depth_m = models.FloatField(default=10.0)
    building_height_m = models.FloatField(default=8.0)
    building_footprint_sqm = models.FloatField(default=100.0)

    bedrooms = models.PositiveSmallIntegerField()
    bathrooms = models.PositiveSmallIntegerField(default=1)
    powder_rooms = models.PositiveSmallIntegerField(default=0)
    floors = models.PositiveSmallIntegerField()
    living_rooms = models.PositiveSmallIntegerField(default=1)
    family_rooms = models.PositiveSmallIntegerField(default=0)
    dining_rooms = models.PositiveSmallIntegerField(default=1)
    drawing_rooms = models.PositiveSmallIntegerField(default=0)
    kitchens = models.PositiveSmallIntegerField(default=1)
    dirty_kitchens = models.PositiveSmallIntegerField(default=0)
    study_rooms = models.PositiveSmallIntegerField(default=0)
    parking_spaces = models.PositiveSmallIntegerField(default=0)
    parking_spaces_max = models.PositiveSmallIntegerField(null=True, blank=True)
    balconies = models.PositiveSmallIntegerField(default=0)
    terraces = models.PositiveSmallIntegerField(default=0)
    garage = models.BooleanField(default=False)
    pool = models.BooleanField(default=False)
    garden = models.BooleanField(default=True)

    # Approximate room sizes in feet: { name: {length_ft, width_ft, area_sqft} }
    room_sizes = models.JSONField(default=dict, blank=True)

    # Legacy bool kept in sync with parking_spaces > 0
    parking = models.BooleanField(default=False)

    estimated_cost_pkr = models.PositiveIntegerField(default=0)
    estimated_cost_min = models.PositiveIntegerField(null=True, blank=True)
    estimated_cost_max = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=8, default="PKR")

    model_type = models.CharField(
        max_length=16, choices=MODEL_TYPE_CHOICES, default=MODEL_PROCEDURAL
    )
    model_config = models.JSONField(default=dict, blank=True)
    glb_url = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Used when model_type=glb",
    )
    model_url = models.CharField(max_length=255, blank=True, default="")
    thumbnail_url = models.CharField(max_length=255, blank=True, default="")
    gallery_images = models.JSONField(default=list, blank=True)

    model_width_m = models.FloatField(null=True, blank=True)
    model_depth_m = models.FloatField(null=True, blank=True)
    model_height_m = models.FloatField(null=True, blank=True)

    source_provider = models.CharField(max_length=80, default="plotline-procedural")
    source_model_id = models.CharField(max_length=120, blank=True, default="")
    source_license = models.CharField(max_length=120, default="project-generated")
    source_attribution = models.CharField(max_length=255, blank=True, default="")
    commercial_use_allowed = models.BooleanField(default=True)
    attribution_required = models.BooleanField(default=False)

    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["style", "recommended_min_plot", "name"]

    def __str__(self):
        return "{} ({})".format(self.name, self.style)

    def save(self, *args, **kwargs):
        if self.min_plot_area_sqm is None:
            self.min_plot_area_sqm = self.recommended_min_plot
        if self.max_plot_area_sqm is None:
            self.max_plot_area_sqm = self.recommended_max_plot
        if not self.building_footprint_sqm:
            self.building_footprint_sqm = self.building_width_m * self.building_depth_m
        self.parking = self.parking_spaces > 0 or self.garage
        if self.model_type == self.MODEL_GLB and not self.model_url and self.glb_url:
            self.model_url = self.glb_url
        super().save(*args, **kwargs)

    @property
    def effective_min_plot(self):
        return self.min_plot_area_sqm if self.min_plot_area_sqm is not None else self.recommended_min_plot

    @property
    def effective_max_plot(self):
        return self.max_plot_area_sqm if self.max_plot_area_sqm is not None else self.recommended_max_plot


class Project(models.Model):
    MEASUREMENT_AR = "ar"
    MEASUREMENT_MANUAL = "manual"
    MEASUREMENT_CHOICES = (
        (MEASUREMENT_AR, "AR hit-test"),
        (MEASUREMENT_MANUAL, "Manual rectangle"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=160, blank=True, default="")
    land_size_sqm = models.FloatField()
    plot_length_m = models.FloatField(null=True, blank=True)
    plot_width_m = models.FloatField(null=True, blank=True)
    measurement_type = models.CharField(
        max_length=16,
        choices=MEASUREMENT_CHOICES,
        default=MEASUREMENT_MANUAL,
    )
    land_size_display_unit = models.CharField(max_length=16, default="marla")
    marla = models.FloatField(null=True, blank=True)
    kanal = models.FloatField(null=True, blank=True)
    acre = models.FloatField(null=True, blank=True)
    preferred_style = models.CharField(max_length=80, blank=True, default="")
    selected_house = models.ForeignKey(
        HouseDesign,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    screenshot = models.ImageField(upload_to="screenshots/", null=True, blank=True)
    plot_points = models.JSONField(
        default=list,
        blank=True,
        help_text="Hit-test corners as [{x,y,z}, ...] in metres",
    )
    recommendation_reason = models.TextField(blank=True)
    feasibility_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        label = self.name or "Project {}".format(self.pk)
        return "{} ({:.1f} m²)".format(label, self.land_size_sqm)


class Report(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    narration_text = models.TextField()
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    source = models.CharField(
        max_length=32,
        default="unavailable",
        help_text="huggingface | template | unavailable",
    )
    model_name = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return "Report for project {}".format(self.project_id)
