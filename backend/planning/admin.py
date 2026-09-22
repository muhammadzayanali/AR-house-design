from django.contrib import admin

from .models import HouseDesign, Project, Report


@admin.register(HouseDesign)
class HouseDesignAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "style",
        "model_type",
        "recommended_min_plot",
        "recommended_max_plot",
        "bedrooms",
        "floors",
        "active",
    )
    list_filter = ("style", "model_type", "active")
    search_fields = ("name", "style", "description")
    fieldsets = (
        (None, {"fields": ("name", "style", "description", "active")}),
        (
            "Plot range",
            {
                "fields": (
                    "recommended_min_plot",
                    "recommended_max_plot",
                    "min_plot_area_sqm",
                    "max_plot_area_sqm",
                    "recommended_width_m",
                    "recommended_depth_m",
                )
            },
        ),
        (
            "Building",
            {
                "fields": (
                    "building_width_m",
                    "building_depth_m",
                    "building_height_m",
                    "building_footprint_sqm",
                    "floors",
                )
            },
        ),
        (
            "Programme",
            {
                "fields": (
                    "bedrooms",
                    "bathrooms",
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
                )
            },
        ),
        (
            "Cost",
            {
                "fields": (
                    "estimated_cost_pkr",
                    "estimated_cost_min",
                    "estimated_cost_max",
                    "currency",
                )
            },
        ),
        (
            "Model",
            {
                "fields": (
                    "model_type",
                    "model_config",
                    "glb_url",
                    "model_url",
                    "thumbnail_url",
                    "gallery_images",
                    "model_width_m",
                    "model_depth_m",
                    "model_height_m",
                )
            },
        ),
        (
            "License",
            {
                "fields": (
                    "source_provider",
                    "source_model_id",
                    "source_license",
                    "source_attribution",
                    "commercial_use_allowed",
                    "attribution_required",
                )
            },
        ),
    )


admin.site.register(Project)
admin.site.register(Report)
