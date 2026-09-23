from django.urls import path

from . import views
from . import views_vision

urlpatterns = [
    path("health/", views.HealthView.as_view()),
    path("vision/depth/", views_vision.VisionDepthView.as_view()),
    path("vision/measure/", views_vision.VisionMeasureView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("styles/", views.StyleCatalogView.as_view()),
    path("houses/", views.HouseDesignListView.as_view()),
    path("houses/<int:pk>/", views.HouseDesignDetailView.as_view()),
    path("designs/match/", views.DesignMatchView.as_view()),
    path("feasibility/", views.FeasibilityView.as_view()),
    path("space-estimate/", views.SpaceEstimateView.as_view()),
    path("planning/summary/", views.PlanningSummaryView.as_view()),
    path("recommend/", views.RecommendView.as_view()),
    path("projects/", views.ProjectListCreateView.as_view()),
    path("projects/<int:pk>/", views.ProjectDetailView.as_view()),
    path("projects/<int:pk>/feasibility/", views.ProjectFeasibilityDetailView.as_view()),
    path("projects/<int:pk>/report/", views.ProjectReportView.as_view()),
    path("projects/<int:pk>/ask/", views.ProjectAskView.as_view()),
    path("reports/<int:pk>/", views.ReportDetailView.as_view()),
    # Compatibility aliases requested as /api/v1/*
    path("v1/house-designs/", views.HouseDesignListView.as_view()),
    path("v1/house-designs/<int:pk>/", views.HouseDesignDetailView.as_view()),
    path("v1/styles/", views.StyleCatalogView.as_view()),
    path("v1/designs/match/", views.DesignMatchView.as_view()),
    path("v1/projects/", views.ProjectListCreateView.as_view()),
    path("v1/projects/<int:pk>/", views.ProjectDetailView.as_view()),
    path("v1/projects/<int:pk>/feasibility/", views.ProjectFeasibilityDetailView.as_view()),
    path("v1/projects/<int:pk>/report/", views.ProjectReportView.as_view()),
    path("v1/projects/<int:pk>/ask/", views.ProjectAskView.as_view()),
]
