"""Deterministic grounding validator for optional Hugging Face polish.

If HF invents unsupported regulations, rooms, costs, or dimensions,
discard the polished text and keep the local grounded answer.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# Phrases that strongly suggest invented regulatory / legal claims
_REG_PATTERNS = [
    r"\bsetback[s]?\b",
    r"\bFAR\b",
    r"\bFSI\b",
    r"\bfloor[- ]area ratio\b",
    r"\bbuilding code\b",
    r"\bby[- ]?law\b",
    r"\bmunicipal approval\b",
    r"\blda\b",
    r"\bcda\b",
    r"\blegally (approved|compliant|required)\b",
    r"\bcode compliant\b",
    r"\bpermit (is|was) (required|granted|approved)\b",
    r"\bzoning (allows|requires|mandates)\b",
    r"\bmust (obtain|secure) (a )?(building )?permit\b",
    r"\bminimum setback of\b",
    r"\d+\s*m(etre)?s?\s+setback",
]

# Extract numbers that look like invented precise claims when not in facts
_NUMBER_RE = re.compile(
    r"(?<![A-Za-z/])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.\d+)(?![A-Za-z])"
)


def _flat_numbers(facts: Dict[str, Any], estimates: Dict[str, Any]) -> List[float]:
    allowed: List[float] = []
    for blob in (facts, estimates):
        for v in blob.values():
            if isinstance(v, bool) or v is None:
                continue
            if isinstance(v, (int, float)):
                allowed.append(float(v))
            elif isinstance(v, str):
                for m in _NUMBER_RE.findall(v.replace(",", "")):
                    try:
                        allowed.append(float(m))
                    except ValueError:
                        pass
    # Common benign constants that may appear in explanations
    allowed.extend([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 20, 50, 70, 100])
    return allowed


def _close(a: float, b: float, tol: float = 0.08) -> bool:
    if b == 0:
        return abs(a) < 0.5
    return abs(a - b) <= max(tol * abs(b), 0.6)


def validate_ai_text(
    text: str,
    grounded: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    """Return (ok, reason). ok=False means fall back to local synthesis."""
    if not text or not text.strip():
        return False, "empty_response"

    lower = text.lower()
    for pat in _REG_PATTERNS:
        if re.search(pat, text, flags=re.IGNORECASE):
            # Allow mentioning that we do NOT do bylaws / setbacks
            window = lower
            if "not" in window and (
                "setback" in window
                or "bylaw" in window
                or "by-law" in window
                or "far" in window
                or "approval" in window
                or "municipal" in window
            ):
                # Negated disclaimer — ok if clearly denying
                if any(
                    n in window
                    for n in (
                        "does not",
                        "do not",
                        "don't",
                        "not a",
                        "not perform",
                        "not verify",
                        "not check",
                        "without",
                        "no setback",
                        "not bylaw",
                    )
                ):
                    continue
            return False, "unsupported_regulation_claim:{0}".format(pat)

    facts = grounded.get("facts") or {}
    estimates = grounded.get("estimates") or {}
    allowed = _flat_numbers(facts, estimates)

    # Flag large precise money-looking numbers not near catalog costs
    cost_candidates = [
        estimates.get("cost_min"),
        estimates.get("cost_max"),
        estimates.get("cost_list_pkr"),
    ]
    cost_vals = [float(c) for c in cost_candidates if isinstance(c, (int, float))]

    for raw in _NUMBER_RE.findall(text.replace(",", "")):
        try:
            num = float(raw)
        except ValueError:
            continue
        if num < 1000:
            # small counts / metres — check against known facts loosely
            if any(_close(num, a) for a in allowed):
                continue
            # allow percentages already in facts, floors, etc.
            continue
        # Large numbers: must be near a known cost or plot-scale value
        if any(_close(num, a, tol=0.05) for a in allowed):
            continue
        if cost_vals and any(_close(num, c, tol=0.05) for c in cost_vals):
            continue
        # Ignore years-ish
        if 1900 <= num <= 2100:
            continue
        # PKR millions often written without matching exactly — only reject
        # if clearly a money claim and far from catalog
        if num >= 100_000 and cost_vals:
            if not any(_close(num, c, tol=0.15) for c in cost_vals):
                return False, "unsupported_cost_number:{0}".format(num)

    # Room count contradictions: "5 bedrooms" when fact is 3
    beds = facts.get("bedrooms")
    if isinstance(beds, int):
        m = re.search(r"(\d+)\s*bedrooms?", text, re.I)
        if m and int(m.group(1)) != beds and int(m.group(1)) not in (0, 1):
            # allow ranges like "3–4" only if includes fact
            if not re.search(
                r"{0}\s*[–\-]\s*\d+\s*bedrooms?|\d+\s*[–\-]\s*{0}\s*bedrooms?".format(beds),
                text,
                re.I,
            ):
                if abs(int(m.group(1)) - beds) >= 1:
                    return False, "bedroom_mismatch:{0}_vs_{1}".format(m.group(1), beds)

    # Footprint contradictions (e.g. invent 145 m² when fact is 90)
    foot = facts.get("building_footprint_sqm")
    if isinstance(foot, (int, float)) and float(foot) > 0:
        for m in re.finditer(
            r"footprint[^\d]{0,48}(\d+(?:\.\d+)?)",
            text,
            flags=re.IGNORECASE,
        ):
            claimed = float(m.group(1))
            if not _close(claimed, float(foot), tol=0.05):
                return False, "footprint_mismatch:{0}_vs_{1}".format(claimed, foot)

    return True, None
