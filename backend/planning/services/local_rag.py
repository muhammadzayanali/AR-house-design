"""Local RAG: retrieve knowledge chunks + project facts, synthesize grounded answers.

Runs fully offline. Optional Hugging Face polish is handled by narration.py.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple

from planning.knowledge.corpus import all_chunks


_TOKEN_RE = re.compile(r"[a-z0-9]+", re.I)

# Intent → boost tags / keywords
_INTENT_PATTERNS: List[Tuple[str, Sequence[str]]] = [
    (
        "beautify",
        (
            "beaut",
            "beautif",
            "look",
            "aesthetic",
            "pretty",
            "nicer",
            "realistic",
            "improve",
            "upgrade",
            "style tip",
            "make.*house",
            "visual",
            "appearance",
            "facade",
            "façade",
        ),
    ),
    ("cost", ("cost", "budget", "price", "pkr", "expensive", "cheap", "estimate", "construction", "lahore")),
    ("why", ("why", "recommend", "chosen", "selected", "match", "picked")),
    ("feasibility", ("coverage", "footprint", "remaining", "feasib", "fit", "open space", "covered")),
    (
        "rooms",
        (
            "bedroom",
            "bathroom",
            "kitchen",
            "living",
            "dining",
            "drawing",
            "powder",
            "master",
            "parking",
            "room",
            "programme",
            "program",
            "size",
            "ft",
            "dimension",
        ),
    ),
    ("style", ("style", "italian", "modern", "cottage", "american", "luxury", "traditional", "mediterranean")),
    ("3d", ("3d", "model", "glb", "procedural", "viewer", "ar", "mesh")),
    ("units", ("marla", "kanal", "acre", "sqm", "square", "plot size", "land size")),
    ("how", ("how", "explain", "what is", "tell me")),
]


def _tokenize(text: str) -> List[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if len(t) > 1]


def detect_intent(question: str) -> str:
    q = (question or "").lower()
    for intent, patterns in _INTENT_PATTERNS:
        for p in patterns:
            if re.search(p, q):
                return intent
    return "general"


def _project_chunk(facts: Dict[str, Any]) -> Dict[str, str]:
    from planning.grounded_context import build_grounded_context

    grounded = build_grounded_context(facts)
    f = grounded["facts"]
    e = grounded["estimates"]
    style = f.get("selected_style") or "unspecified"
    lines = [
        "VERIFIED PROJECT FACTS (authoritative — do not invent replacements):",
        "Plot {sqm} m² ({marla} Marla / {kanal} Kanal / {acre} Acre).".format(
            sqm=f.get("plot_area_sqm"),
            marla=f.get("plot_marla"),
            kanal=f.get("plot_kanal"),
            acre=f.get("plot_acre"),
        ),
        "Selected style: {0}. Selected design: {1}.".format(
            f.get("selected_style"), f.get("selected_design")
        ),
        "Building {w}×{d} m, footprint {foot} m², remaining {rem} m², coverage {cov}%.".format(
            w=f.get("building_width_m"),
            d=f.get("building_depth_m"),
            foot=f.get("building_footprint_sqm"),
            rem=f.get("remaining_area_sqm"),
            cov=f.get("coverage_percent"),
        ),
        "Rooms (HouseDesign FACTS): bedrooms={beds}, bathrooms={baths}, floors={floors}, "
        "living={living}, dining={dining}, kitchen={kitchen}, parking={park}.".format(
            beds=f.get("bedrooms"),
            baths=f.get("bathrooms"),
            floors=f.get("floors"),
            living=f.get("living_rooms"),
            dining=f.get("dining_rooms"),
            kitchen=f.get("kitchens"),
            park=f.get("parking_spaces"),
        ),
        "Recommendation reason: {0}".format(f.get("recommendation_reason") or "n/a"),
        "PRELIMINARY ESTIMATES (not quotations): cost_min={cmin}, cost_max={cmax}, "
        "list={clist} {cur}.".format(
            cmin=e.get("cost_min"),
            cmax=e.get("cost_max"),
            clist=e.get("cost_list_pkr"),
            cur=e.get("currency"),
        ),
        "LIMITATIONS: " + " ".join(grounded["limitations"][:3]),
    ]
    return {
        "id": "project-facts",
        "title": "This project's verified fields",
        "tags": "project plot design rooms cost feasibility facts estimates "
        + str(style).lower(),
        "category": "project",
        "source_type": "project_facts",
        "text": " ".join(str(x) for x in lines if x),
    }


def _build_index(chunks: List[Dict[str, str]]) -> Tuple[List[Counter], Dict[str, float], List[float]]:
    docs = [_tokenize(c.get("title", "") + " " + c.get("tags", "") + " " + c.get("text", "")) for c in chunks]
    df: Counter = Counter()
    for toks in docs:
        df.update(set(toks))
    n = max(len(docs), 1)
    idf = {t: math.log((n + 1) / (1 + df[t])) + 1.0 for t in df}
    tfs: List[Counter] = [Counter(toks) for toks in docs]
    norms: List[float] = []
    for tf in tfs:
        s = 0.0
        for term, cnt in tf.items():
            w = (cnt / max(sum(tf.values()), 1)) * idf.get(term, 1.0)
            s += w * w
        norms.append(math.sqrt(s) or 1.0)
    return tfs, idf, norms


def _score_query(
    query_tokens: List[str],
    tfs: List[Counter],
    idf: Dict[str, float],
    norms: List[float],
) -> List[float]:
    qtf = Counter(query_tokens)
    qsum = max(sum(qtf.values()), 1)
    qw = {t: (c / qsum) * idf.get(t, 1.0) for t, c in qtf.items()}
    qnorm = math.sqrt(sum(v * v for v in qw.values())) or 1.0
    scores: List[float] = []
    for i, tf in enumerate(tfs):
        dsum = max(sum(tf.values()), 1)
        dot = 0.0
        for t, w in qw.items():
            if t in tf:
                dw = (tf[t] / dsum) * idf.get(t, 1.0)
                dot += w * dw
        scores.append(dot / (qnorm * norms[i]))
    return scores


def retrieve(
    question: str,
    facts: Dict[str, Any],
    *,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    intent = detect_intent(question)
    chunks = all_chunks() + [_project_chunk(facts)]
    # Intent boosts: duplicate high-value chunks into scoring via tag injection
    style = str(facts.get("preferred_style") or facts.get("house_style") or "").lower()
    boosted_q = question
    if intent == "beautify":
        boosted_q += " beauty aesthetic facade landscaping lighting"
        if "italian" in style or "mediterranean" in style:
            boosted_q += " italian mediterranean villa terracotta portico shutters"
        elif "modern" in style or "contemporary" in style or "luxury" in style:
            boosted_q += " modern contemporary cantilever glass"
        elif "american" in style:
            boosted_q += " american porch garage"
        elif "cottage" in style:
            boosted_q += " cottage porch shutters"
    elif intent == "why":
        boosted_q += " recommend match catalog plot range"
    elif intent == "feasibility":
        boosted_q += " footprint coverage remaining"
    elif intent == "cost":
        boosted_q += " cost budget pkr estimate"
    elif intent == "3d":
        boosted_q += " procedural three.js realistic glb"

    q_tokens = _tokenize(boosted_q)
    tfs, idf, norms = _build_index(chunks)
    scores = _score_query(q_tokens, tfs, idf, norms)

    ranked = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)
    out: List[Dict[str, Any]] = []
    for i in ranked[:top_k]:
        if scores[i] <= 0 and chunks[i]["id"] != "project-facts":
            continue
        c = chunks[i]
        out.append(
            {
                "id": c["id"],
                "title": c["title"],
                "text": c["text"],
                "score": round(float(scores[i]), 4),
                "source_type": c.get("source_type", "knowledge"),
                "category": c.get("category", ""),
            }
        )
    # Always keep project facts
    if not any(x["id"] == "project-facts" for x in out):
        pf = next(c for c in chunks if c["id"] == "project-facts")
        out.insert(
            0,
            {
                "id": pf["id"],
                "title": pf["title"],
                "text": pf["text"],
                "score": 1.0,
                "source_type": "project_facts",
                "category": "project",
            },
        )
    return out[:top_k]


def _fmt_cost(facts: Dict[str, Any]) -> str:
    cmin, cmax = facts.get("estimated_cost_min"), facts.get("estimated_cost_max")
    if cmin and cmax:
        return "PKR {:,.0f} – {:,.0f}".format(float(cmin), float(cmax))
    if facts.get("estimated_cost_pkr"):
        return "about PKR {:,.0f}".format(float(facts["estimated_cost_pkr"]))
    return "not stored on this project"


def _style_label(facts: Dict[str, Any]) -> str:
    return str(facts.get("preferred_style") or facts.get("house_style") or "your selected style")


def synthesize_answer(
    question: str,
    facts: Dict[str, Any],
    passages: List[Dict[str, Any]],
) -> str:
    intent = detect_intent(question)
    style = _style_label(facts)
    name = facts.get("house_name") or "the selected design"
    feas = facts.get("feasibility") or {}
    rooms = facts.get("room_program") or {}
    passage_bits = [p["text"] for p in passages if p.get("id") != "project-facts"]
    knowledge = " ".join(passage_bits[:3])

    opener_parts = []

    if intent == "beautify":
        opener_parts.append(
            "For {name} ({style}) on your {sqm} m² / {marla:.2f} Marla plot, "
            "here is how to make the house read more beautiful while staying true to the style."
            .format(
                name=name,
                style=style,
                sqm=facts.get("land_size_sqm") or 0,
                marla=float(facts.get("land_size_marla") or 0),
            )
        )
        # Style-specific bullets pulled from knowledge + hard cues
        style_l = style.lower()
        tips: List[str] = []
        if "italian" in style_l or "mediterranean" in style_l:
            tips = [
                "Keep the terracotta pitched roof as a solid gable volume (depth + overhang), not floating thin plates.",
                "Feature the front portico: columns, light stone bases/capitals, and a small pediment/gable over the entrance.",
                "Use recessed windows with white trim, mullions, and deep green shutters; add a balcony rail above the door.",
                "Warm stucco walls, corner quoins, and a cornice band between floors improve depth.",
                "Soften the site with front trees, rear hedge, and paving to the entrance; try Evening light in the viewer.",
            ]
        elif "modern" in style_l or "contemporary" in style_l or "luxury" in style_l:
            tips = [
                "Strengthen the cantilever / accent volume and keep the flat roof parapet crisp.",
                "Use tall glass bands and darker cladding contrast against light walls.",
                "Rely on sun shadows and clean landscaping; avoid classical columns that fight modern language.",
                "If a pool is in the programme, keep the water plane aligned with the rear terrace.",
            ]
        elif "american" in style_l:
            tips = [
                "Emphasise the front porch, pitched roof, and garage/driveway alignment.",
                "Keep window rhythm simple and family-scaled; avoid Italian portico ornament.",
            ]
        elif "cottage" in style_l:
            tips = [
                "Use a steeper pitched roof, warmer wall tones, shutters, and a compact porch.",
                "Keep massing intimate — cottage beauty comes from charm, not monumentality.",
            ]
        else:
            tips = [
                "Match roof type and entrance treatment to the chosen style.",
                "Add depth at windows and a clear entrance focus; improve site landscaping and lighting.",
            ]

        cov = feas.get("ground_coverage_percent")
        if cov is not None and float(cov) >= 55:
            tips.append(
                "Your coverage is about {cov}% with ~{rem} m² remaining — keep terrace/garden visible "
                "so the villa does not feel cramped on the plot.".format(
                    cov=cov,
                    rem=feas.get("remaining_area_sqm") or "—",
                )
            )

        body = " ".join(opener_parts) + "\n\n"
        body += "\n".join("{0}. {1}".format(i + 1, t) for i, t in enumerate(tips))
        body += (
            "\n\nIn this app: open the 3D viewer, orbit the model, and toggle Evening. "
            "These are planning visualization tips for the procedural model — not a licensed "
            "architect's finish schedule or photoreal CGI brief."
        )
        if knowledge:
            body += "\n\n(Grounded from local knowledge: style guidance + your project fields.)"
        return body

    if intent == "why":
        return (
            "{name} was matched because your plot and preferred style fit the catalog rules — "
            "not because an ML model invented a house.\n\n"
            "Stored reason: {reason}\n\n"
            "Plot {sqm} m² ({marla:.2f} Marla). Style: {style}. "
            "Footprint {foot} m² · remaining {rem} m² · coverage {cov}%. "
            "Programme includes {beds} bedrooms and {floors} floor(s). "
            "This is a database range/style filter plus feasibility check."
            .format(
                name=name,
                reason=facts.get("recommendation_reason") or "No reason stored.",
                sqm=facts.get("land_size_sqm") or 0,
                marla=float(facts.get("land_size_marla") or 0),
                style=style,
                foot=feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm") or 0,
                rem=feas.get("remaining_area_sqm") or 0,
                cov=feas.get("ground_coverage_percent") or 0,
                beds=rooms.get("bedrooms", facts.get("bedrooms") or "—"),
                floors=rooms.get("floors", facts.get("floors") or "—"),
            )
        )

    if intent == "cost":
        cost = facts.get("cost_estimate") or {}
        if cost.get("min") and cost.get("max"):
            return (
                "Preliminary Lahore reference construction estimate for ~{cov} m² "
                "covered area (~{sqft} sq ft) at about PKR {rate}/sq ft: "
                "PKR {lo:,.0f}–{hi:,.0f} ({quality}). "
                "Catalog list price for {name} is separately {catalog}. "
                "Both are preliminary estimates — not quotations. "
                "{disclaimer}"
                .format(
                    cov=cost.get("covered_area_m2") or "—",
                    sqft=cost.get("covered_area_sqft") or "—",
                    rate=cost.get("reference_rate_pkr_per_sqft") or "—",
                    lo=float(cost["min"]),
                    hi=float(cost["max"]),
                    quality=cost.get("quality") or "standard",
                    name=name,
                    catalog=_fmt_cost(facts),
                    disclaimer=cost.get("disclaimer")
                    or "Costs vary with city, materials, labour and design complexity.",
                )
            )
        return (
            "For {name}, the catalog cost range is {cost}. "
            "That figure is a preliminary planning estimate only — not a quotation, BOQ, or bid."
            .format(name=name, cost=_fmt_cost(facts))
        )

    if intent == "feasibility":
        return (
            "On your {sqm} m² plot, {name} uses about {foot} m² footprint "
            "({cov}% coverage), leaving ~{rem} m² open for circulation, driveway, and garden. "
            "Feasibility here checks footprint fit and coverage only — not full bylaws or setbacks. "
            "Preliminary planning only."
            .format(
                sqm=facts.get("land_size_sqm") or 0,
                name=name,
                foot=feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm") or 0,
                cov=feas.get("ground_coverage_percent") or 0,
                rem=feas.get("remaining_area_sqm") or 0,
            )
        )

    if intent == "rooms":
        sizes = facts.get("room_sizes") or {}
        master = sizes.get("master_bedroom") or {}
        size_line = ""
        if master.get("length_ft") and master.get("width_ft"):
            size_line = (
                " Approximate master bedroom {l}×{w} ft."
                .format(l=master["length_ft"], w=master["width_ft"])
            )
        park_min = rooms.get("parking_spaces_min", rooms.get("parking_spaces", "—"))
        park_max = rooms.get("parking_spaces_max", park_min)
        return (
            "{name} programme: {beds} bedrooms, {baths} bathrooms, "
            "{powder} powder, {kitchen} kitchen, {dining} dining, "
            "{drawing} drawing, {family} family/living, "
            "parking {pmin}–{pmax} (geometry-dependent), {floors} floor(s)."
            "{size_line} "
            "Counts come from the HouseDesign catalog / planning engine — not from camera analysis. "
            "If a detail is missing from project data, it is not available."
            .format(
                name=name,
                beds=rooms.get("bedrooms", facts.get("bedrooms") or "—"),
                baths=rooms.get("bathrooms", facts.get("bathrooms") or "—"),
                powder=rooms.get("powder_rooms", 0),
                kitchen=rooms.get("kitchens", "—"),
                dining=rooms.get("dining_rooms", "—"),
                drawing=rooms.get("drawing_rooms", 0),
                family=rooms.get("family_rooms") or rooms.get("family_lounges") or rooms.get("living_rooms") or "—",
                pmin=park_min,
                pmax=park_max,
                floors=rooms.get("floors", facts.get("floors") or "—"),
                size_line=size_line,
            )
        )

    if intent == "3d":
        return (
            "{name} uses model_type={mt}. Procedural models are real-time architectural massing "
            "in Three.js (style features, shadows, materials) — useful for AR and planning, "
            "not photoreal marketing CGI. Optional GLB assets can replace a design when configured. "
            "To improve perceived beauty: solid roofs, recessed windows, portico/porch, landscaping, "
            "and Evening lighting in the viewer."
            .format(name=name, mt=facts.get("model_type") or "procedural")
        )

    if intent == "units":
        return (
            "Your plot is stored as {sqm} m², shown as {marla:.2f} Marla / {kanal:.3f} Kanal "
            "(and {acre:.4f} Acre) using this app's configured constants. "
            "Treat conversions as planning aids, not a professional survey."
            .format(
                sqm=facts.get("land_size_sqm") or 0,
                marla=float(facts.get("land_size_marla") or 0),
                kanal=float(facts.get("land_size_kanal") or 0),
                acre=float(facts.get("land_size_acre") or 0),
            )
        )

    # General / how: short project brief + top knowledge
    summary = (
        "You asked about this project: {name} ({style}) on {sqm} m² "
        "({marla:.2f} Marla). Footprint {foot} m² · coverage {cov}% · cost {cost}."
        .format(
            name=name,
            style=style,
            sqm=facts.get("land_size_sqm") or 0,
            marla=float(facts.get("land_size_marla") or 0),
            foot=feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm") or 0,
            cov=feas.get("ground_coverage_percent") or 0,
            cost=_fmt_cost(facts),
        )
    )
    if knowledge:
        # Trim knowledge to keep answer readable
        clip = knowledge[:700].rsplit(" ", 1)[0] + "…" if len(knowledge) > 700 else knowledge
        summary += "\n\nRelevant guidance:\n" + clip
    summary += (
        "\n\nAsk specifically about beauty tips, cost, rooms, coverage, or why this design "
        "matched — answers stay grounded in local RAG + your saved fields. "
        "Not a licensed architect."
    )
    return summary


def answer(facts: Dict[str, Any], question: str) -> Dict[str, Any]:
    from planning.grounded_context import build_grounded_context

    q = (question or "").strip()
    intent = detect_intent(q)
    passages = retrieve(q, facts, top_k=5)
    text = synthesize_answer(q, facts, passages)
    grounded = build_grounded_context(facts)
    return {
        "text": text,
        "source": "local_rag",
        "model": "plotline-local-rag-v1",
        "warning": None,
        "passages": [
            {
                "id": p["id"],
                "title": p["title"],
                "score": p["score"],
                "source_type": p.get("source_type"),
                "category": p.get("category"),
            }
            for p in passages
        ],
        "intent": intent,
        "grounded": grounded,
        "debug": {
            "query": q,
            "intent": intent,
            "retrieved_ids": [p["id"] for p in passages],
            "scores": {p["id"]: p["score"] for p in passages},
            "project_facts_included": any(p["id"] == "project-facts" for p in passages),
            "synthesis_source": "local_rag",
            "hf_used": False,
        },
    }


def rag_context_for_llm(facts: Dict[str, Any], question: str, passages: Optional[List[Dict[str, Any]]] = None) -> str:
    """Serialize retrieved passages for optional HF polish."""
    passages = passages or retrieve(question, facts, top_k=4)
    blocks = []
    for p in passages:
        blocks.append("### {0} ({1})\n{2}".format(p["title"], p["id"], p["text"]))
    return "\n\n".join(blocks)


def synthesize_report(facts: Dict[str, Any]) -> str:
    """Local narrative report when HF is unavailable."""
    style = _style_label(facts)
    name = facts.get("house_name") or "No design selected"
    feas = facts.get("feasibility") or {}
    rooms = facts.get("room_program") or {}
    return (
        "Preliminary planning report (local RAG — facts from Django engines).\n\n"
        "=== Plot Summary (FACTS) ===\n"
        "Plot: {sqm} m² ({marla:.2f} Marla / {kanal:.3f} Kanal / {acre:.4f} Acre), "
        "measurement_type={mt}.\n\n"
        "=== Design Summary (FACTS) ===\n"
        "Style: {style}. Design: {name}.\n\n"
        "=== Space Programme (FACTS from HouseDesign) ===\n"
        "{beds} bedrooms, {baths} bathrooms, {floors} floors, living={living}, "
        "dining={dining}, kitchen={kitchen}, parking={park}.\n\n"
        "=== Preliminary Feasibility (FACTS) ===\n"
        "Footprint {foot} m² · remaining {rem} m² · coverage {cov}%.\n\n"
        "=== Estimates ===\n"
        "Catalog cost range: {cost} (preliminary — not a quotation).\n\n"
        "=== Planning Notes ===\n"
        "Match reason: {reason}\n\n"
        "=== Limitations ===\n"
        "Matching is rule-based catalog filtering. Feasibility is footprint/coverage "
        "only. Not a survey, bylaw check, FAR/FSI check, or licensed design."
        .format(
            sqm=facts.get("land_size_sqm") or 0,
            marla=float(facts.get("land_size_marla") or 0),
            kanal=float(facts.get("land_size_kanal") or 0),
            acre=float(facts.get("land_size_acre") or 0),
            mt=facts.get("measurement_type") or "—",
            style=style,
            name=name,
            beds=rooms.get("bedrooms", facts.get("bedrooms") or "—"),
            baths=rooms.get("bathrooms", facts.get("bathrooms") or "—"),
            floors=rooms.get("floors", facts.get("floors") or "—"),
            living=rooms.get("living_rooms", "—"),
            dining=rooms.get("dining_rooms", "—"),
            kitchen=rooms.get("kitchens", "—"),
            park=rooms.get("parking_spaces", "—"),
            foot=feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm") or 0,
            rem=feas.get("remaining_area_sqm") or 0,
            cov=feas.get("ground_coverage_percent") or 0,
            cost=_fmt_cost(facts),
            reason=facts.get("recommendation_reason") or "No reason stored.",
        )
    )
