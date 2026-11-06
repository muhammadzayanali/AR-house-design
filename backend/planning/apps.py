import logging

from django.apps import AppConfig


class PlanningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "planning"

    def ready(self):
        from django.conf import settings

        logging.getLogger("plotline.api").info(
            "Plotline backend ready debug=%s vision_mock=%s depth=%s llm_configured=%s",
            settings.DEBUG,
            getattr(settings, "VISION_MOCK", False),
            getattr(settings, "HF_DEPTH_MODEL", ""),
            bool(getattr(settings, "HF_TOKEN", "")),
        )
