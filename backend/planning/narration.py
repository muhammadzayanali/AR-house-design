"""Project fact flattening + consultant answers (local RAG primary, HF optional)."""
from __future__ import annotations

from typing import Any, Dict

from .feasibility import compute_feasibility, design_room_program, preliminary_space_estimate
from .grounded_context import build_grounded_context
from .services import huggingface_service as hf
from .services import local_rag
from .services.ai_validator import validate_ai_text
from .units import sqm_to_units


def project_facts(project) -> Dict[str, Any]:
    from .planning_engine import design_planning_overlay
    from .units import sqm_to_sqft

    house = project.selected_house
    units = sqm_to_units(project.land_size_sqm)
    facts: Dict[str, Any] = {
        "project_id": project.id,
        "project_name": project.name or "",
        "land_size_sqm": round(float(project.land_size_sqm), 2),
        "land_size_sqft": units.get("sqft") or sqm_to_sqft(project.land_size_sqm),
        "plot_length_m": project.plot_length_m,
        "plot_width_m": project.plot_width_m,
        "measurement_type": project.measurement_type,
        "measurement_quality": getattr(project, "measurement_quality", "") or "",
        "calibration_method": getattr(project, "calibration_method", "") or "",
        "land_size_marla": project.marla if project.marla is not None else units["marla"],
        "land_size_kanal": project.kanal if project.kanal is not None else units["kanal"],
        "land_size_acre": project.acre if project.acre is not None else units["acre"],
        "land_size_display_unit": project.land_size_display_unit,
        "preferred_style": project.preferred_style or (house.style if house else None),
        "recommendation_reason": project.recommendation_reason,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "preliminary_space": preliminary_space_estimate(project.land_size_sqm),
    }
    if house:
        feas = project.feasibility_snapshot or compute_feasibility(
            project.land_size_sqm,
            house,
            project.plot_length_m,
            project.plot_width_m,
        )
        overlay = design_planning_overlay(house, project.land_size_sqm, feas)
        facts.update(
            {
                "house_name": house.name,
                "house_style": house.style,
                "bedrooms": house.bedrooms,
                "bathrooms": house.bathrooms,
                "floors": house.floors,
                "parking": house.parking,
                "estimated_cost_pkr": house.estimated_cost_pkr,
                "estimated_cost_min": house.estimated_cost_min,
                "estimated_cost_max": house.estimated_cost_max,
                "currency": house.currency,
                "building_footprint_sqm": house.building_footprint_sqm,
                "building_width_m": house.building_width_m,
                "building_depth_m": house.building_depth_m,
                "room_program": design_room_program(house),
                "room_sizes": overlay.get("room_sizes"),
                "planning": overlay.get("planning"),
                "cost_estimate": overlay.get("cost_estimate"),
                "plot_range_min": house.effective_min_plot,
                "plot_range_max": house.effective_max_plot,
                "model_type": house.model_type,
                "feasibility": feas,
            }
        )
    else:
        prelim = facts["preliminary_space"]
        facts.update(
            {
                "house_name": None,
                "house_style": None,
                "bedrooms": (prelim.get("room_program") or {}).get("bedrooms"),
                "bathrooms": (prelim.get("room_program") or {}).get("bathrooms"),
                "floors": (prelim.get("planning") or {}).get("recommended_floors"),
                "parking": None,
                "estimated_cost_pkr": None,
                "room_program": prelim.get("room_program"),
                "room_sizes": prelim.get("room_sizes"),
                "planning": prelim.get("planning"),
                "cost_estimate": prelim.get("cost_estimate"),
            }
        )
    facts["grounded"] = build_grounded_context(facts)
    return facts


def generate_report_text(facts: Dict[str, Any]) -> Dict[str, Any]:
    grounded = facts.get("grounded") or build_grounded_context(facts)
    local_text = local_rag.synthesize_report(facts)
    result = hf.generate_report(facts, grounded=grounded)
    text = result.get("text") or ""
    source = result.get("source") or "unavailable"
    warning = result.get("warning")

    if text and source == "huggingface":
        ok, reason = validate_ai_text(text, grounded)
        if ok:
            return {
                "text": text,
                "source": "huggingface",
                "model": result.get("model"),
                "warning": warning,
                "passages": [],
                "grounded": grounded,
                "validation": {"ok": True, "reason": None},
            }
        warning = (
            "Hugging Face polish rejected by grounding validator ({0}). "
            "Showing local grounded report."
        ).format(reason)

    return {
        "text": local_text,
        "source": "local_rag",
        "model": "plotline-local-rag-v1",
        "warning": warning,
        "passages": [],
        "grounded": grounded,
        "validation": {"ok": True, "reason": "local_synthesis"},
    }


def answer_question(facts: Dict[str, Any], question: str) -> Dict[str, Any]:
    grounded = facts.get("grounded") or build_grounded_context(facts)
    rag = local_rag.answer(facts, question)
    passages = rag.get("passages") or []
    debug = rag.get("debug") or {}

    hf_result = hf.answer_question(
        facts,
        question,
        grounded=grounded,
        rag_context=local_rag.rag_context_for_llm(facts, question),
    )
    if hf_result.get("text") and hf_result.get("source") == "huggingface":
        ok, reason = validate_ai_text(hf_result["text"], grounded)
        if ok:
            debug = {
                **debug,
                "synthesis_source": "huggingface",
                "hf_used": True,
                "validation_ok": True,
            }
            return {
                "text": hf_result["text"],
                "source": "huggingface",
                "model": hf_result.get("model"),
                "warning": hf_result.get("warning"),
                "passages": passages,
                "intent": rag.get("intent"),
                "grounded": grounded,
                "debug": debug,
                "validation": {"ok": True, "reason": None},
            }
        debug = {
            **debug,
            "synthesis_source": "local_rag",
            "hf_used": False,
            "validation_ok": False,
            "validation_reason": reason,
        }
        return {
            "text": rag["text"],
            "source": "local_rag",
            "model": rag.get("model"),
            "warning": (
                "Hugging Face polish discarded ({0}). Showing grounded local answer."
            ).format(reason),
            "passages": passages,
            "intent": rag.get("intent"),
            "grounded": grounded,
            "debug": debug,
            "validation": {"ok": False, "reason": reason},
        }

    debug = {**debug, "hf_used": False, "synthesis_source": "local_rag"}
    return {
        "text": rag["text"],
        "source": "local_rag",
        "model": rag.get("model"),
        "warning": None,
        "passages": passages,
        "intent": rag.get("intent"),
        "grounded": grounded,
        "debug": debug,
        "validation": {"ok": True, "reason": "local_synthesis"},
    }
