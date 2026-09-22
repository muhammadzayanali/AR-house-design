"""Hugging Face InferenceClient — optional polish over grounded facts + local RAG."""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from django.conf import settings


logger = logging.getLogger(__name__)

SYSTEM_BASE = """You are an architectural planning assistant for preliminary planning in Pakistan.

You are NOT a certified architect, surveyor, engineer, quantity surveyor,
municipal authority, or legal advisor.

Use the supplied STRUCTURED GROUNDED CONTEXT as authoritative.
Never alter numerical project FACTS.
Never invent dimensions, rooms, costs, regulations, setbacks,
FAR/FSI, approvals, or legal requirements.
If information is unavailable, say that it is unavailable.

Clearly distinguish:
- verified project FACTS
- preliminary ESTIMATES
- general architectural guidance from LOCAL RAG PASSAGES
- LIMITATIONS

Do not claim that a design is legally approved or code compliant.
The system's feasibility result is preliminary planning guidance only.
Your job is to explain the supplied information clearly in plain language.
Do not dump raw JSON. Do not invent room counts beyond the FACTS section."""

SYSTEM_REPORT = SYSTEM_BASE + "\nWrite a short planning report covering plot, design, programme, feasibility, notes, and limitations."

SYSTEM_QA = SYSTEM_BASE + "\nAnswer the client's question directly. Prefer FACTS for numbers; use RAG passages for style advice."


def is_hf_configured() -> bool:
    token = (settings.HF_TOKEN or "").strip()
    return bool(token) and not token.startswith("hf_your_token")


def build_project_context(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy nested context — prefer grounded_context.build_grounded_context."""
    from planning.grounded_context import build_grounded_context

    return build_grounded_context(facts)


def generate_report(
    facts: Dict[str, Any],
    *,
    grounded: Optional[Dict[str, Any]] = None,
    rag_passages: Optional[str] = None,
) -> Dict[str, Any]:
    ctx = grounded or build_project_context(facts)
    user = (
        "Write a short architectural planning report.\n\n"
        "STRUCTURED GROUNDED CONTEXT (authoritative):\n"
        + json.dumps(ctx, indent=2, default=str)
    )
    if rag_passages:
        user += "\n\nLOCAL RAG PASSAGES (guidance only):\n" + rag_passages
    return _complete(SYSTEM_REPORT, user)


def answer_question(
    facts: Dict[str, Any],
    question: str,
    *,
    grounded: Optional[Dict[str, Any]] = None,
    rag_context: Optional[str] = None,
) -> Dict[str, Any]:
    ctx = grounded or build_project_context(facts)
    user = (
        "Client question:\n{q}\n\n"
        "STRUCTURED GROUNDED CONTEXT (authoritative):\n{ctx}\n"
    ).format(q=question.strip(), ctx=json.dumps(ctx, indent=2, default=str))
    if rag_context:
        user += "\nLOCAL RAG PASSAGES (style/process guidance only):\n" + rag_context
    return _complete(SYSTEM_QA, user)


def _complete(system: str, user: str) -> Dict[str, Any]:
    model = settings.HF_MODEL
    if not is_hf_configured():
        return {
            "text": "",
            "source": "unavailable",
            "model": None,
            "warning": (
                "Hugging Face polish is off (HF_TOKEN missing). "
                "Local RAG still answers from project fields + knowledge base."
            ),
            "fallback_text": None,
        }

    try:
        from huggingface_hub import InferenceClient

        timeout = float(getattr(settings, "HF_TIMEOUT", 25) or 25)
        client = InferenceClient(
            model=model,
            token=settings.HF_TOKEN.strip(),
            provider=getattr(settings, "HF_PROVIDER", None) or "auto",
            timeout=timeout,
        )
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=900,
            temperature=0.25,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            raise RuntimeError("Empty LLM response")
        return {
            "text": text,
            "source": "huggingface",
            "model": model,
            "warning": None,
            "fallback_text": None,
        }
    except Exception as exc:
        logger.warning("Hugging Face call failed: %s", exc)
        return {
            "text": "",
            "source": "unavailable",
            "model": model,
            "warning": (
                "Hugging Face polish unavailable ({0}). "
                "Showing local RAG answer instead."
            ).format(exc),
            "fallback_text": None,
        }
