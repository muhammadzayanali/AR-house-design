"""Static knowledge chunks for Plotline local RAG (architecture consultant)."""

from __future__ import annotations

from typing import Dict, List

# Each chunk: id, title, tags, category, source_type, text
# source_type: process | style_guidance | planning_guidance | limitation | faq
CORPUS: List[Dict[str, str]] = [
    {
        "id": "scope-disclaimer",
        "title": "Scope and limitations",
        "tags": "disclaimer architect survey bylaw approval legal setback far",
        "category": "limitations",
        "source_type": "limitation",
        "text": (
            "Plotline is a preliminary architectural planning assistant. "
            "It is not a licensed architect, surveyor, or municipal approval system. "
            "Plot sizes are approximate planning measurements. Marla/Kanal/Acre use "
            "configured Punjab-style constants. Feasibility checks footprint fit and "
            "coverage only — not setbacks, FAR, or full bylaws. Always verify with a "
            "qualified professional and local authority before construction."
        ),
    },
    {
        "id": "how-ai-works",
        "title": "How consultant answers work",
        "tags": "ai rag consultant huggingface local knowledge facts estimates",
        "category": "process",
        "source_type": "process",
        "text": (
            "The consultant answers from two layers: (1) this project's verified FACTS "
            "(plot, style, selected design, rooms, feasibility) and ESTIMATES (cost bands), "
            "and (2) a local knowledge base of style and planning guidance. "
            "Optional Hugging Face LLM can polish phrasing when HF_TOKEN works; "
            "local RAG always answers even offline. The model never sees camera images "
            "and must never recalculate measurements or invent regulations."
        ),
    },
    {
        "id": "recommendation-rules",
        "title": "Why a house is recommended",
        "tags": "recommend match catalog style plot range filter deterministic",
        "category": "process",
        "source_type": "process",
        "text": (
            "House matching is rule-based, not machine learning and not an LLM decision. "
            "After the user picks a style, the catalog filters active HouseDesign rows by "
            "style and plot area range (min/max m²). Feasibility then checks building "
            "footprint vs plot and reports coverage and remaining open area. "
            "The recommendation reason stores those deterministic values."
        ),
    },
    {
        "id": "feasibility-basics",
        "title": "Feasibility and coverage",
        "tags": "feasibility footprint coverage remaining open space garden",
        "category": "planning",
        "source_type": "planning_guidance",
        "text": (
            "Feasibility compares building_footprint_sqm to plot area. "
            "Remaining area = plot − footprint. Ground coverage percent = "
            "footprint / plot × 100. High coverage (often above ~70%) leaves little "
            "room for driveways, setbacks, and gardens — useful as a planning warning, "
            "not a legal verdict. Prefer designs whose footprint fits comfortably "
            "with leftover landscape and circulation."
        ),
    },
    {
        "id": "beautify-general",
        "title": "Making a house look more beautiful (general)",
        "tags": "beauty beautify beautiful look aesthetic improve realistic nicer design tips",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "To make a preliminary house visualization feel more beautiful: "
            "(1) reinforce the chosen architectural style with honest massing; "
            "(2) add depth at openings (recessed windows, frames, sills, shutters); "
            "(3) articulate the entrance (portico, porch, canopy); "
            "(4) use a coherent material palette; "
            "(5) soften the site with trees, hedges, paving, and evening lighting; "
            "(6) keep proportions calm. "
            "In Plotline, switch Day/Evening in the 3D viewer to preview warm interior glow."
        ),
    },
    {
        "id": "beautify-italian",
        "title": "Italian / Mediterranean villa beautification",
        "tags": "italian mediterranean villa terracotta portico columns arches shutters quoins cornice",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "For Italian Compact Villa and Mediterranean designs: "
            "warm stucco walls; terracotta pitched roof with a solid gable; "
            "front portico with classical columns; corner quoins and cornice; "
            "recessed windows with white trim and deep green shutters; "
            "balcony rail above the entrance; stone paving; trees and rear hedge; "
            "evening porch lights. Avoid glass-box modern cantilevers on Italian massing."
        ),
    },
    {
        "id": "beautify-modern",
        "title": "Modern / contemporary beautification",
        "tags": "modern contemporary luxury cantilever glass flat roof accent",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "Modern and contemporary beauty cues: clean rectangular volumes, flat roof "
            "parapets, dark accent cladding on a cantilever wing, tall glass bands, "
            "minimal trim, strong sun shadows, restrained landscaping. "
            "Luxury variants may include pool water planes and evening spot lighting."
        ),
    },
    {
        "id": "beautify-american-cottage",
        "title": "American and cottage beautification",
        "tags": "american cottage porch pitched dormer garage family hut",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "American family homes: front porch, pitched roof, garage/driveway, "
            "simple window rhythm. Cottage/Hut: steeper roofs, warmer wood-toned walls, "
            "shutters, compact porch — intimate massing rather than monumental."
        ),
    },
    {
        "id": "3d-procedural",
        "title": "Procedural 3D vs photoreal CGI",
        "tags": "3d model glb procedural three.js realistic viewer ar",
        "category": "faq",
        "source_type": "faq",
        "text": (
            "Default Plotline houses are procedural Three.js models (real-time massing "
            "with style features). They communicate architectural form in AR and the web "
            "viewer — not Unreal Engine photoreal marketing CGI. Optional GLB assets can "
            "replace a design when model_type=glb. The same HouseRenderer is used in "
            "viewer and AR at 1 unit = 1 metre."
        ),
    },
    {
        "id": "cost-guidance",
        "title": "Cost ranges",
        "tags": "cost budget pkr estimate price money",
        "category": "planning",
        "source_type": "planning_guidance",
        "text": (
            "Estimated cost fields on HouseDesign are preliminary planning ESTIMATES in PKR "
            "(min/max when available). They are catalog estimates, not quotations, BOQs, "
            "or contractor bids. Use them only to compare order-of-magnitude between designs."
        ),
    },
    {
        "id": "space-programme",
        "title": "Space programme",
        "tags": "rooms bedrooms bathrooms kitchen living dining floors parking garage pool",
        "category": "planning",
        "source_type": "planning_guidance",
        "text": (
            "Each catalog design stores a room programme as FACTS from HouseDesign: "
            "bedrooms, bathrooms, floors, living/dining/kitchen, parking, balconies, "
            "terraces, garage, pool, garden. Preliminary space estimates from plot area "
            "alone are ESTIMATES until a design is selected."
        ),
    },
    {
        "id": "style-italian",
        "title": "Italian Villa style traits",
        "tags": "italian style traits mediterranean villa",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "Italian Villa style emphasises Mediterranean warmth: terracotta roofs, "
            "stucco walls, classical columns, arches, shutters, and garden terraces."
        ),
    },
    {
        "id": "style-modern",
        "title": "Modern style traits",
        "tags": "modern style traits",
        "category": "style",
        "source_type": "style_guidance",
        "text": (
            "Modern style emphasises clean geometry, flat roofs, large glazing, and "
            "cantilevered volumes."
        ),
    },
    {
        "id": "plot-units",
        "title": "Plot units",
        "tags": "marla kanal acre sqm square metre plot size land",
        "category": "faq",
        "source_type": "faq",
        "text": (
            "Plot area is stored in square metres (FACT). Display conversions use configured "
            "Punjab-style Marla/Kanal/Acre constants. Always quote both m² and local units."
        ),
    },
    {
        "id": "next-steps-beauty",
        "title": "Practical next steps to beautify in this app",
        "tags": "steps how to improve viewer evening landscape catalog",
        "category": "faq",
        "source_type": "faq",
        "text": (
            "Practical steps: open the project 3D viewer and orbit; toggle Evening; "
            "confirm the selected style matches the look you want; if coverage is high, "
            "consider a smaller-footprint catalog design; regenerate the report after "
            "style changes. For photoreal marketing stills, use a licensed GLB — outside "
            "the default procedural path."
        ),
    },
]


def all_chunks() -> List[Dict[str, str]]:
    return list(CORPUS)
