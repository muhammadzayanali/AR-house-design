from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HouseDesign, Project, Report
from .narration import answer_question, generate_report_text, project_facts
from .recommendation import recommend_house
from .serializers import (
    HouseDesignSerializer,
    ProjectSerializer,
    RegisterSerializer,
    ReportSerializer,
    UserSerializer,
)
from .services.huggingface_service import is_hf_configured
from .units import sqm_to_units

MAX_QUESTION_LENGTH = 800


def resolve_login_user(identifier: str, password: str):
    """Accept username OR email as the login identifier."""
    raw = (identifier or "").strip()
    if not raw or not password:
        return None
    user = authenticate(username=raw, password=password)
    if user is not None:
        return user
    matched = User.objects.filter(email__iexact=raw).first()
    if matched is not None:
        return authenticate(username=matched.username, password=password)
    return None



class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.conf import settings

        return Response(
            {
                "ok": True,
                "llm_configured": is_hf_configured(),
                "llm_model": settings.HF_MODEL,
                "accuracy_disclaimer": (
                    "Plot measurements are approximate planning estimates, "
                    "not a professional land survey."
                ),
            }
        )


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(ObtainAuthToken):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        identifier = request.data.get("username") or request.data.get("email") or ""
        password = request.data.get("password") or ""
        user = resolve_login_user(identifier, password)
        if user is None:
            return Response(
                {"non_field_errors": ["Unable to log in with provided credentials."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class HouseDesignListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = HouseDesignSerializer

    def get_queryset(self):
        qs = HouseDesign.objects.filter(active=True)
        style = self.request.query_params.get("style")
        if style:
            qs = qs.filter(style__iexact=style.strip())
        plot = self.request.query_params.get("plot_area")
        if plot is not None and plot != "":
            try:
                size = float(plot)
            except (TypeError, ValueError):
                return qs.none()
            filtered = []
            for house in qs:
                if house.effective_min_plot <= size <= house.effective_max_plot:
                    filtered.append(house.pk)
            qs = qs.filter(pk__in=filtered)
        return qs


class HouseDesignDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = HouseDesignSerializer
    queryset = HouseDesign.objects.filter(active=True)


class StyleCatalogView(APIView):
    """Architectural style cards for post-measurement selection."""

    permission_classes = [AllowAny]

    STYLES = [
        {
            "id": "Modern",
            "name": "Modern",
            "description": "Clean geometric volumes, flat roofs, large glazing, minimal exterior.",
            "traits": ["Flat roof", "Large glass", "Cantilevered volumes", "Neutral materials"],
            "preview_style": "modern",
        },
        {
            "id": "Italian Villa",
            "name": "Italian Villa",
            "description": "Warm stucco, columns, arched openings, terracotta roof, villa proportions.",
            "traits": ["Stucco facade", "Columns", "Arched openings", "Tile roof"],
            "preview_style": "italian",
        },
        {
            "id": "American",
            "name": "American",
            "description": "Wider frontage, garage emphasis, pitched roof, family porch.",
            "traits": ["Garage", "Porch", "Pitched roof", "Family proportions"],
            "preview_style": "american",
        },
        {
            "id": "Cottage / Hut",
            "name": "Cottage / Hut",
            "description": "Compact footprint, pitched roof, warm materials, garden cottage feel.",
            "traits": ["Compact", "Pitched roof", "Porch", "Garden"],
            "preview_style": "cottage",
        },
        {
            "id": "Contemporary",
            "name": "Contemporary",
            "description": "Asymmetrical volumes, mixed materials, large glass, modern landscaping.",
            "traits": ["Asymmetry", "Stone accents", "Large glass", "Terrace"],
            "preview_style": "contemporary",
        },
        {
            "id": "Traditional",
            "name": "Traditional",
            "description": "Balanced facade, conventional windows, porch entry, pitched roof.",
            "traits": ["Balanced facade", "Porch columns", "Pitched roof", "Family home"],
            "preview_style": "traditional",
        },
        {
            "id": "Villa",
            "name": "Villa",
            "description": "Villa-scale homes with stronger entrances, terraces, and landscaping.",
            "traits": ["Grand entrance", "Terraces", "Landscaping", "Villa proportions"],
            "preview_style": "italian",
        },
        {
            "id": "Luxury Villa",
            "name": "Luxury Villa",
            "description": "Premium multi-volume facade, terraces, pool when plot allows.",
            "traits": ["Premium facade", "Pool", "Terraces", "Architectural lighting"],
            "preview_style": "luxury",
        },
    ]

    def get(self, request):
        return Response({"styles": self.STYLES})


class DesignMatchView(APIView):
    """Filter catalog by style + plot; return exact or nearby designs."""

    permission_classes = [AllowAny]

    def get(self, request):
        from .feasibility import filter_designs, preliminary_space_estimate
        from .planning_engine import build_preliminary_plan

        style = request.query_params.get("style")
        plot_raw = request.query_params.get("plot_area")
        if plot_raw is None or plot_raw == "":
            return Response(
                {"detail": "plot_area is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            plot = float(plot_raw)
        except (TypeError, ValueError):
            return Response(
                {"detail": "plot_area must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if plot <= 0:
            return Response(
                {"detail": "plot_area must be > 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = filter_designs(
            HouseDesign.objects.all(),
            style=style,
            plot_area=plot,
        )
        from .feasibility import compute_feasibility
        from .grounded_context import match_reason_block

        units = sqm_to_units(plot)
        ctx = {"request": request}

        def enrich(houses, exact: bool):
            rows = []
            for house in houses:
                feas = compute_feasibility(plot, house)
                data = HouseDesignSerializer(house, context=ctx).data
                data["compatibility"] = "exact" if exact else "nearby"
                data["match_reason"] = match_reason_block(
                    plot_area=plot,
                    land_label=units["display_label"],
                    house=house,
                    feasibility=feas,
                    exact=exact,
                )
                data["feasibility_preview"] = {
                    "building_footprint_sqm": feas["building_footprint_sqm"],
                    "remaining_area_sqm": feas["remaining_area_sqm"],
                    "ground_coverage_percent": feas["ground_coverage_percent"],
                    "status": feas["status"],
                }
                rows.append(data)
            return rows

        plan = build_preliminary_plan(plot)
        payload = {
            "plot_area_sqm": plot,
            "land_units": units,
            "style": style,
            "match_kind": result["match_kind"],
            "exact": enrich(result["exact"], True),
            "nearby": enrich(result["nearby"], False),
            "preliminary_space": preliminary_space_estimate(plot),
            "planning_summary": plan,
            "message": None,
        }
        if result["match_kind"] == "nearby" and style:
            payload["message"] = (
                "No exact design was found for your plot size and selected style. "
                "Nearby designs are shown for preliminary visualization only — "
                "they are not marked as compatible."
            )
        elif result["match_kind"] == "exact" and not result["exact"]:
            payload["message"] = "No designs found for this style."
        return Response(payload)


class FeasibilityView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .feasibility import compute_feasibility, design_room_program

        try:
            plot = float(request.data.get("land_size_sqm"))
            house_id = int(request.data.get("house_id"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "land_size_sqm and house_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            house = HouseDesign.objects.get(pk=house_id, active=True)
        except HouseDesign.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        length = request.data.get("plot_length_m")
        width = request.data.get("plot_width_m")
        try:
            length_f = float(length) if length not in (None, "") else None
            width_f = float(width) if width not in (None, "") else None
        except (TypeError, ValueError):
            return Response(
                {"detail": "plot_length_m / plot_width_m must be numbers"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "house": HouseDesignSerializer(house, context={"request": request}).data,
                "room_program": design_room_program(house),
                "feasibility": compute_feasibility(plot, house, length_f, width_f),
                "land_units": sqm_to_units(plot),
            }
        )


class SpaceEstimateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .feasibility import preliminary_space_estimate
        from .planning_engine import build_preliminary_plan

        try:
            plot = float(request.data.get("land_size_sqm"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "land_size_sqm must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if plot <= 0:
            return Response(
                {"detail": "land_size_sqm must be > 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan = build_preliminary_plan(plot)
        return Response(
            {
                "land_units": sqm_to_units(plot),
                "preliminary_space": preliminary_space_estimate(plot),
                "planning_summary": plan,
            }
        )


class PlanningSummaryView(APIView):
    """Structured preliminary or design-authoritative planning summary."""

    permission_classes = [AllowAny]

    def post(self, request):
        from .models import HouseDesign
        from .planning_engine import build_preliminary_plan, design_planning_overlay

        try:
            plot = float(request.data.get("land_size_sqm"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "land_size_sqm must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if plot <= 0:
            return Response(
                {"detail": "land_size_sqm must be > 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        house_id = request.data.get("house_id")
        length = request.data.get("plot_length_m")
        width = request.data.get("plot_width_m")
        length_f = float(length) if length not in (None, "") else None
        width_f = float(width) if width not in (None, "") else None

        if house_id:
            try:
                house = HouseDesign.objects.get(pk=house_id, active=True)
            except HouseDesign.DoesNotExist:
                return Response(
                    {"detail": "House design not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            from .feasibility import compute_feasibility

            feas = compute_feasibility(plot, house, length_f, width_f)
            return Response(design_planning_overlay(house, plot, feas))

        return Response(build_preliminary_plan(plot))


class RecommendView(APIView):
    """Legacy single-house recommend + optional style filter for compatibility."""

    permission_classes = [AllowAny]

    def post(self, request):
        from .feasibility import filter_designs

        try:
            size = float(request.data.get("land_size_sqm"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "land_size_sqm must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if size <= 0:
            return Response(
                {"detail": "land_size_sqm must be > 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        style = (request.data.get("style") or "").strip() or None
        if style:
            matched = filter_designs(
                HouseDesign.objects.all(), style=style, plot_area=size
            )
            houses = matched["exact"] or matched["nearby"][:1]
            if not houses:
                return Response(
                    {"detail": "No designs available for that style."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            house = houses[0]
            reason = (
                "Selected style '{style}' with plot {label}. "
                "Matched catalog design '{name}' ({lo:.0f}–{hi:.0f} m²). "
                "This is a deterministic catalog filter, not machine learning."
            ).format(
                style=style,
                label=sqm_to_units(size)["display_label"],
                name=house.name,
                lo=house.effective_min_plot,
                hi=house.effective_max_plot,
            )
        else:
            house, reason = recommend_house(size)
            if house is None:
                return Response({"detail": reason}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(
            {
                "house": HouseDesignSerializer(house, context={"request": request}).data,
                "reason": reason,
                "land_units": sqm_to_units(size),
                "accuracy_disclaimer": (
                    "This recommendation uses an approximate plot area for preliminary "
                    "planning only. It is not a professional survey or building approval."
                ),
            }
        )


class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user).select_related(
            "selected_house"
        )


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user).select_related(
            "selected_house"
        )


class ProjectReportView(APIView):
    """Create (or return latest) LLM-narrated report for a project."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        project = self._project(request, pk)
        if project is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        report = project.reports.first()
        if report is None:
            return Response({"detail": "No report yet"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReportSerializer(report).data)

    def post(self, request, pk):
        project = self._project(request, pk)
        if project is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            result = generate_report_text(project_facts(project))
        except Exception as exc:
            # Never 500 the UI — local RAG report is the safe fallback.
            from .services import local_rag as _rag

            try:
                facts = project_facts(project)
                result = {
                    "text": _rag.synthesize_report(facts),
                    "source": "local_rag",
                    "model": "plotline-local-rag-v1",
                    "warning": str(exc),
                }
            except Exception:
                result = {
                    "text": (
                        "Report generation hit an unexpected error ({0}). "
                        "Your project data is still saved."
                    ).format(exc),
                    "source": "error",
                    "model": None,
                    "warning": str(exc),
                }
        report = Report.objects.create(
            project=project,
            narration_text=result["text"] or "Report unavailable.",
            source=result["source"],
            model_name=result.get("model") or "",
        )
        payload = ReportSerializer(report).data
        payload["warning"] = result.get("warning")
        payload["ai_available"] = result["source"] == "huggingface"
        return Response(payload, status=status.HTTP_201_CREATED)

    def _project(self, request, pk):
        try:
            return Project.objects.select_related("selected_house").get(
                pk=pk, user=request.user
            )
        except Project.DoesNotExist:
            return None


class ProjectFeasibilityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from .feasibility import compute_feasibility, design_room_program

        try:
            project = Project.objects.select_related("selected_house").get(
                pk=pk, user=request.user
            )
        except Project.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not project.selected_house:
            return Response(
                {"detail": "No selected design on this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        feas = project.feasibility_snapshot or compute_feasibility(
            project.land_size_sqm,
            project.selected_house,
            project.plot_length_m,
            project.plot_width_m,
        )
        return Response(
            {
                "project_id": project.id,
                "feasibility": feas,
                "room_program": design_room_program(project.selected_house),
                "house": HouseDesignSerializer(
                    project.selected_house, context={"request": request}
                ).data,
            }
        )


class ReportDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportSerializer

    def get_queryset(self):
        return Report.objects.filter(project__user=self.request.user)


class ProjectAskView(APIView):
    """Grounded Q&A: LLM sees structured project facts only, never images."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response(
                {"detail": "question is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(question) > MAX_QUESTION_LENGTH:
            return Response(
                {"detail": "question must be at most {} characters".format(MAX_QUESTION_LENGTH)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            project = Project.objects.select_related("selected_house").get(
                pk=pk, user=request.user
            )
        except Project.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            result = answer_question(project_facts(project), question)
        except Exception as exc:
            result = {
                "text": (
                    "Consultant error ({0}). Re-open the project and try again. "
                    "Local RAG normally answers from saved fields + knowledge base."
                ).format(exc),
                "source": "error",
                "model": None,
                "warning": str(exc),
                "passages": [],
            }
        return Response(
            {
                "answer": result["text"],
                "source": result["source"],
                "model": result.get("model"),
                "warning": result.get("warning"),
                "intent": result.get("intent"),
                "passages": result.get("passages") or [],
                "grounded": result.get("grounded"),
                "validation": result.get("validation"),
                "ai_available": result["source"] == "huggingface",
                "rag_available": True,
                "debug": result.get("debug")
                if (request.query_params.get("debug") == "1" or settings.DEBUG)
                else None,
            }
        )
