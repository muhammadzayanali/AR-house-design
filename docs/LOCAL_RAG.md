# Local RAG (Ask the consultant)

Plotline’s consultant uses a **local Retrieval-Augmented Generation** path so answers
work without Hugging Face. HF is optional polish only.

## Why this exists

Without RAG, Q&A fell back to dumping structured project fields and telling the user
to configure `HF_TOKEN`. That does not answer questions like:

> how do I make this house more beautiful?

Local RAG retrieves style/planning knowledge **and** the project’s saved fields, then
synthesizes a direct answer.

## Pipeline

```text
User question
    ↓
Intent detect (beautify / cost / why / rooms / feasibility / 3d / …)
    ↓
Retrieve top-k chunks (TF–IDF cosine)
    • static knowledge corpus (styles, beauty tips, feasibility, disclaimers)
    • dynamic project-facts chunk (plot, design, rooms, coverage, cost)
    ↓
Synthesize grounded answer (rule composition from facts + passages)
    ↓
Optional: Hugging Face rewrite using same facts + retrieved passages
    ↓
Response { answer, source, model, intent, passages }
```

| `source` | Meaning |
|---|---|
| `local_rag` | Default offline answer (always available) |
| `huggingface` | HF succeeded; still grounded on facts + RAG passages |
| `error` | Unexpected failure |

## Files

| Path | Role |
|---|---|
| `backend/planning/knowledge/corpus.py` | Static knowledge chunks |
| `backend/planning/services/local_rag.py` | Retrieve + synthesize |
| `backend/planning/services/huggingface_service.py` | Optional LLM polish |
| `backend/planning/narration.py` | Orchestrates RAG → optional HF |
| `POST /api/projects/<id>/ask/` | Consultant API |

## Grounding rules

1. **Numbers** (plot m², Marla, footprint, coverage, rooms, cost) come only from
   project / HouseDesign fields — never invented.
2. **Style advice** (Italian portico, terracotta roof, shutters, evening light, etc.)
   comes from retrieved corpus chunks matched to the selected style.
3. **Disclaimer**: not a licensed architect; not a survey or bylaw approval.
4. Camera / AR frames are **never** sent to RAG or HF.

## Example

Question: *bro can you please explain me that how i made this house more beautify*

For **Italian Compact Villa** the local answer covers terracotta gable roof, portico
columns, recessed shutters, quoins/cornice, landscaping, Evening viewer mode, and
coverage/garden notes — labeled `source: local_rag`.

## Grounding (hardening)

Answers include structured `grounded = { facts, estimates, limitations }`.

Optional HF polish is checked by `ai_validator.py`. Failed validation → local RAG text.

Debug (development): `POST /api/projects/<id>/ask/?debug=1` returns retrieval intent, chunk ids, scores, and whether HF was used.

## Extending the knowledge base

Add a dict to `CORPUS` in `corpus.py`:

```python
{
    "id": "my-topic",
    "title": "Short title",
    "tags": "keywords for retrieval",
    "text": "Guidance paragraph…",
}
```

Restart Django. No vector DB or external embed API required (FYP-friendly).

## Optional Hugging Face

If `HF_TOKEN` works, the same retrieved passages are passed into the LLM so it can
phrase the answer more naturally **without** inventing numbers. If HF fails, local RAG
still returns a full answer (no “configure HF_TOKEN” dead-end).

See also: [AI_SETUP.md](./AI_SETUP.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).
