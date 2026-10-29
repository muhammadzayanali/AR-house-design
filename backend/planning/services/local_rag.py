"""Local RAG: retrieve knowledge chunks + project facts, synthesize grounded answers.

Runs fully offline. Optional Hugging Face polish is handled by narration.py.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple

from planning.knowledge.corpus import all_chunks
from planning.units import sqm_to_sqft


_TOKEN_RE = re.compile(r"[a-z0-9]+", re.I)

# Common words that otherwise pull the wrong passage ("add" matched "add depth").
_STOP = {
    "a", "an", "the", "is", "in", "on", "at", "to", "of", "for", "and", "or",
    "it", "we", "you", "your", "our", "my", "me", "that", "this", "these",
    "those", "with", "from", "by", "as", "be", "are", "was", "were", "do",
    "does", "did", "can", "could", "would", "should", "please", "bro", "just",
    "about", "into", "than", "then", "if", "so", "not", "no", "yes", "have",
    "has", "had", "add", "also", "there", "here", "what", "how", "when",
    "where", "who", "which", "will", "its",
}

# Published residential map-fee reference (PKR per sq ft). Not a live challan.
_MAP_FEE_PKR_PER_SQFT = 15

# Intent → boost tags / keywords. First match wins.
_INTENT_PATTERNS: List[Tuple[str, Sequence[str]]] = [
    (
        "authority",
        (
            r"dha.{0,40}lda",
            r"lda.{0,40}dha",
            r"is this (land|plot|site)",
            r"how .*(know|got|tell)",
            r"which (authority|scheme|society|phase)",
            r"under (lda|dha|ruda)",
        ),
    ),
    (
        "fees",
        (
            r"\blda\b",
            r"l\.d\.a",
            "lahore development",
            "tax",
            "challan",
            "stamp duty",
            "property tax",
            "map fee",
            "naksha",
            "naqsha",
            "approval fee",
            "commercialization",
            "betterment",
            "withholding",
            "wapda",
            "sui gas",
            "wasa",
            "lesco",
            "sngpl",
        ),
    ),
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
    (
        "build",
        (
            "foundation",
            "grey structure",
            "gray structure",
            "finishing",
            "brick",
            "steel",
            "cement",
            "labour",
            "labor",
            "contractor",
            "plaster",
            "material",
            "rcc",
            "how long",
            "timeline",
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
    (
        "measurement",
        (
            "how.*measured",
            "measured",
            "measurement quality",
            "ai camera",
            "calibrat",
            "depth",
            "opencv",
            "webxr",
            "manual measurement",
            "survey",
            "accuracy",
        ),
    ),
    ("how", ("how", "explain", "what is", "tell me")),
]


def _tokenize(text: str) -> List[str]:
    return [
        t.lower()
        for t in _TOKEN_RE.findall(text or "")
        if len(t) > 1 and t.lower() not in _STOP
    ]


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
        "Selected style: {0}. Selected design: {1}. {2}".format(
            f.get("selected_style"),
            f.get("selected_design"),
            facts.get("house_description") or "",
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
    elif intent == "authority":
        boosted_q += " dha lda scheme authority allotment not stored"
    elif intent == "fees":
        boosted_q += " lda tax fee challan map approval excluded construction estimate"
    elif intent == "build":
        boosted_q += " construction foundation finishing materials selected design"
    elif intent == "cost":
        boosted_q += " cost budget pkr estimate included excluded"
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


def _map_fee_illustration(facts: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """PKR illustration at the published residential rate. Not a challan."""
    feas = facts.get("feasibility") or {}
    rooms = facts.get("room_program") or {}
    foot = feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm")
    if not foot:
        return None
    try:
        floors = int(rooms.get("floors") or facts.get("floors") or 1)
    except (TypeError, ValueError):
        floors = 1
    floors = max(floors, 1)
    ground_sqft = sqm_to_sqft(float(foot))
    total_sqft = sqm_to_sqft(float(foot) * floors)
    rate = _MAP_FEE_PKR_PER_SQFT
    return {
        "floors": floors,
        "ground_sqft": round(ground_sqft, 0),
        "total_sqft": round(total_sqft, 0),
        "ground_pkr": int(round(ground_sqft * rate)),
        "total_pkr": int(round(total_sqft * rate)),
        "rate": rate,
    }


def _catalog_bounds(facts: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    cmin, cmax = facts.get("estimated_cost_min"), facts.get("estimated_cost_max")
    if cmin and cmax:
        return float(cmin), float(cmax)
    cost = facts.get("cost_estimate") or {}
    if cost.get("min") and cost.get("max"):
        return float(cost["min"]), float(cost["max"])
    if facts.get("estimated_cost_pkr"):
        one = float(facts["estimated_cost_pkr"])
        return one, one
    return None


def _pkr(amount: float) -> str:
    return "PKR {:,.0f}".format(float(amount))


def _design_intro(facts: Dict[str, Any]) -> str:
    feas = facts.get("feasibility") or {}
    rooms = facts.get("room_program") or {}
    name = facts.get("house_name") or "the selected design"
    style = _style_label(facts)
    desc = (facts.get("house_description") or "").strip()
    lines = [
        "{name} ({style}) on {sqm} m² ({marla:.2f} Marla).".format(
            name=name,
            style=style,
            sqm=facts.get("land_size_sqm") or 0,
            marla=float(facts.get("land_size_marla") or 0),
        )
    ]
    if desc:
        lines.append(desc)
    lines.append(
        "Building {w}×{d}×{h} m, footprint {foot} m², {floors} floor(s), "
        "coverage {cov}%, about {rem} m² left open.".format(
            w=facts.get("building_width_m") or "—",
            d=facts.get("building_depth_m") or "—",
            h=facts.get("building_height_m") or "—",
            foot=feas.get("building_footprint_sqm") or facts.get("building_footprint_sqm") or 0,
            floors=rooms.get("floors", facts.get("floors") or "—"),
            cov=feas.get("ground_coverage_percent") or 0,
            rem=feas.get("remaining_area_sqm") or 0,
        )
    )
    lines.append(
        "Programme stored on this design: {beds} bedrooms, {baths} bathrooms, "
        "{living} living, {family} family, {dining} dining, {drawing} drawing, "
        "{kitchen} kitchen, parking {park}, garage {garage}, terraces {terr}, garden {garden}.".format(
            beds=rooms.get("bedrooms", facts.get("bedrooms") or "—"),
            baths=rooms.get("bathrooms", facts.get("bathrooms") or "—"),
            living=rooms.get("living_rooms", "—"),
            family=rooms.get("family_rooms", 0),
            dining=rooms.get("dining_rooms", "—"),
            drawing=rooms.get("drawing_rooms", 0),
            kitchen=rooms.get("kitchens", "—"),
            park=rooms.get("parking_spaces", "—"),
            garage="yes" if rooms.get("garage") else "no",
            terr=rooms.get("terraces", 0),
            garden="yes" if rooms.get("garden", True) else "no",
        )
    )
    return " ".join(lines)


def _budget_sheet(facts: Dict[str, Any], *, include_lda: bool) -> str:
    name = facts.get("house_name") or "this design"
    bounds = _catalog_bounds(facts)
    illus = _map_fee_illustration(facts)
    lines = [
        "Preliminary construction budget for {0}.".format(name),
        "",
        _design_intro(facts),
        "",
    ]
    if not bounds:
        lines.append("No cost band is stored on this design.")
        return "\n".join(lines)
    lo, hi = bounds
    lines.append(
        "Construction band stored on this design: {lo} – {hi}. "
        "That is the building (structure and finishes) only. It is not a contractor quote or a BOQ."
        .format(lo=_pkr(lo), hi=_pkr(hi))
    )
    rate_cost = facts.get("cost_estimate") or {}
    if rate_cost.get("min") and rate_cost.get("max"):
        lines.append(
            "A separate Lahore sq-ft reference on this footprint is {lo} – {hi} "
            "at about PKR {rate}/sq ft. The band above is the catalog figure for {name}."
            .format(
                lo=_pkr(rate_cost["min"]),
                hi=_pkr(rate_cost["max"]),
                rate=rate_cost.get("reference_rate_pkr_per_sqft") or "—",
                name=name,
            )
        )
    if include_lda and illus:
        low_total = lo + illus["ground_pkr"]
        high_total = hi + illus["total_pkr"]
        lines.extend(
            [
                "",
                "LDA map-fee illustration added on top, at PKR {rate} per sq ft "
                "(published residential reference, not your challan):".format(rate=illus["rate"]),
                "- Ground floor only, about {sqft:.0f} sq ft: {pkr}".format(
                    sqft=illus["ground_sqft"], pkr=_pkr(illus["ground_pkr"])
                ),
                "- All {floors} floors, about {sqft:.0f} sq ft: {pkr}".format(
                    floors=illus["floors"], sqft=illus["total_sqft"], pkr=_pkr(illus["total_pkr"])
                ),
                "",
                "Combined preliminary total (construction band + that illustration): "
                "{lo} – {hi}.".format(lo=_pkr(low_total), hi=_pkr(high_total)),
                "The low end adds the ground-floor fee to the low construction figure. "
                "The high end adds the all-floors fee to the high construction figure.",
                "This project does not record whether the plot is LDA or DHA. "
                "If the file is DHA, RUDA, a cantonment, or a private society, do not pay the LDA rate — "
                "that authority sets its own fee. Stamp duty, yearly property tax, and utility "
                "connections are still outside this total.",
            ]
        )
    elif not include_lda:
        lines.append(
            "LDA tax is not inside this band. Ask to add it if you want the map-fee "
            "illustration combined with these figures."
        )
    lines.append("Not a licensed quantity surveyor, and not a challan.")
    return "\n".join(lines)


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

    if intent == "measurement":
        mt = facts.get("measurement_type") or "unknown"
        quality = facts.get("measurement_quality") or ""
        cal = facts.get("calibration_method") or ""
        labels = {
            "ai_camera": "AI Camera Measurement (OpenCV + Hugging Face depth + user calibration)",
            "manual": "Manual length × width",
            "ar": "WebXR / AR hit-test corners",
        }
        label = labels.get(str(mt), str(mt))
        body = (
            "FACT: Your plot area is {sqm} m² ({marla:.2f} Marla), obtained via {label}.\n"
            .format(
                sqm=facts.get("land_size_sqm") or 0,
                marla=float(facts.get("land_size_marla") or 0),
                label=label,
            )
        )
        if quality:
            body += (
                "ESTIMATE: Measurement quality = {q}. This is a qualitative "
                "HIGH/MEDIUM/LOW label — not a validated accuracy percentage.\n"
                .format(q=quality)
            )
        if cal:
            body += "FACT: Calibration method = {0}.\n".format(cal)
        body += (
            "LIMITATION: Camera-based and AR measurements are approximate planning "
            "estimates, not professional land surveys. Verify dimensions manually "
            "before construction decisions."
        )
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

    if intent == "authority":
        bounds = _catalog_bounds(facts)
        band = ""
        if bounds:
            band = " The construction band stored on this design stays {lo} – {hi}.".format(
                lo=_pkr(bounds[0]), hi=_pkr(bounds[1])
            )
        return (
            "This project does not record whether the land is DHA or LDA.\n\n"
            "{intro}\n\n"
            "Plot size and the house you picked do not name the authority. "
            "Check the allotment letter, transfer letter, or registry: it names LDA, "
            "a DHA phase, RUDA, a cantonment board, or a private society. "
            "DHA and LDA are different authorities. A DHA file does not use LDA's map fee.\n\n"
            "Plotline cannot guess the scheme from area or from {name}.{band} "
            "Any LDA rupee figure is only an illustration until you know who controls the plot."
            .format(intro=_design_intro(facts), name=name, band=band)
        )

    if intent == "build":
        style_l = _style_label(facts).lower()
        if "italian" in style_l or "mediterranean" in style_l:
            style_note = (
                "This catalog design is Italian: pitched roof, portico, and arched openings "
                "in the stored description. "
            )
        elif "modern" in style_l or "contemporary" in style_l:
            style_note = "This catalog design is modern: flat roof and glazed massing. "
        else:
            style_note = "Follow the stored style ({0}) rather than mixing in another language. ".format(
                _style_label(facts)
            )
        return (
            "Construction outline for the selected design — not a BOQ and not a structural design.\n\n"
            "{intro}\n\n"
            "A usual residential sequence is foundation and plinth, grey structure "
            "(columns, slabs, brickwork), then finishes (plaster, flooring, woodwork, paint, fittings). "
            "{style_note}"
            "The 3D model is generated massing, not a finish schedule.\n\n"
            "Construction band stored on this design: {cost}. "
            "Steel, cement, and labour quantities are not calculated here. "
            "LDA map approval is a separate challan, not part of that band."
            .format(intro=_design_intro(facts), style_note=style_note, cost=_fmt_cost(facts))
        )

    if intent == "cost":
        q = (question or "").lower()
        if re.search(r"budget|construction", q):
            return _budget_sheet(facts, include_lda=False)
        cost = facts.get("cost_estimate") or {}
        if cost.get("min") and cost.get("max"):
            return (
                "Preliminary Lahore reference construction estimate for ~{cov} m² "
                "covered area (~{sqft} sq ft) at about PKR {rate}/sq ft: "
                "PKR {lo:,.0f}–{hi:,.0f} ({quality}). "
                "Catalog list price for {name} is separately {catalog}. "
                "Both are preliminary construction estimates — not quotations. "
                "LDA tax, map-approval fees, stamp duty, property tax, and utility "
                "connections are not inside this band. "
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
            "That figure is a preliminary construction estimate only — not a quotation, BOQ, or bid. "
            "LDA tax and other authority fees are not included."
            .format(name=name, cost=_fmt_cost(facts))
        )

    if intent == "fees":
        q = (question or "").lower()
        wants_total = bool(re.search(r"\b(add|include|including|plus|combine)\b", q)) and bool(
            re.search(r"budget|cost|construction|estimate|total", q)
        )
        if wants_total or (re.search(r"\bbudget\b", q) and re.search(r"lda|tax|fee", q)):
            return _budget_sheet(facts, include_lda=True)
        illus = _map_fee_illustration(facts)
        lines = [
            "No. LDA tax is not included in the cost for {name}.".format(name=name),
            "",
            "The figure on this project is {cost}. That is a preliminary construction "
            "estimate for the building (structure and finishes). It is not a contractor "
            "quote, and it does not include authority charges.".format(cost=_fmt_cost(facts)),
            "",
            "Not in that band:",
            "- LDA or MCL building-plan (map / naqsha) approval fee and challan",
            "- DHA, RUDA, Cantonment, or private-society approval charges",
            "- Stamp duty, transfer charges, and withholding tax on the plot",
            "- Yearly property tax",
            "- WAPDA/LESCO, SNGPL, and WASA connection deposits",
            "",
            "People usually mean the map-approval fee when they say LDA tax. "
            "A published residential reference is PKR {rate} per sq ft of covered area "
            "(Dawn: LDA residential plan fee revised to Rs 15/sq ft; City42, 24 June 2024: "
            "Metropolitan Corporation Lahore residential map fee raised to Rs 15/sq ft "
            "from 1 July 2024). Commercial plans were reported higher (about Rs 40/sq ft). "
            "Those articles are not your challan, and the schedule can change.".format(
                rate=_MAP_FEE_PKR_PER_SQFT
            ),
        ]
        if illus:
            lines.append(
                "Illustration only, using this design's footprint of {foot} m² and "
                "{floors} floor(s). If the fee is charged on the ground floor only "
                "(about {ground:.0f} sq ft), that is about PKR {gp:,.0f}. If it is "
                "charged on all floors (about {total:.0f} sq ft), that is about "
                "PKR {tp:,.0f}. The authority's challan decides which area counts. "
                "Either way it is separate from, and much smaller than, the construction band."
                .format(
                    foot=feas.get("building_footprint_sqm")
                    or facts.get("building_footprint_sqm")
                    or 0,
                    floors=illus["floors"],
                    ground=illus["ground_sqft"],
                    gp=illus["ground_pkr"],
                    total=illus["total_sqft"],
                    tp=illus["total_pkr"],
                )
            )
        else:
            lines.append(
                "This project has no stored footprint, so a rupee illustration is not shown."
            )
        lines.append(
            "If the plot is in DHA, a cantonment, RUDA, or a private society, LDA's rate "
            "does not apply — that authority sets its own fee. Confirm the current "
            "schedule on lda.gop.pk or at the office that actually controls the plot. "
            "Plotline is not LDA, and this answer is not a challan."
        )
        return "\n".join(lines)

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
    q_tokens = set(_tokenize(question))
    matched = []
    for p in passages:
        if p.get("id") == "project-facts":
            continue
        overlap = q_tokens & set(_tokenize((p.get("title") or "") + " " + (p.get("text") or "")))
        if overlap:
            matched.append(p["text"])
    if matched:
        knowledge = " ".join(matched[:2])
        clip = knowledge[:700].rsplit(" ", 1)[0] + "…" if len(knowledge) > 700 else knowledge
        summary += "\n\nRelevant guidance:\n" + clip
    else:
        summary += (
            "\n\nNothing in the saved project fields or the local knowledge base "
            "answers that wording directly. Ask about cost, LDA or other fees, rooms, "
            "coverage, or why this design matched."
        )
    summary += "\n\nNot a licensed architect, surveyor, or tax authority."
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
