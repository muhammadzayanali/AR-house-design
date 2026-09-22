# AI Architecture

```text
Measure / style / catalog / feasibility (backend)
        ↓
Structured JSON (plot + design + room_program + feasibility)
        ↓
Local RAG (retrieve knowledge + project facts → grounded answer)
        ↓
Optional Hugging Face InferenceClient (polish only)
        ↓
Natural-language report / consultant Q&A
```

## Roles

| Layer | Does | Does not |
|---|---|---|
| Feasibility / catalog | Calculate area, coverage, style filter | Chat |
| Local RAG | Answer questions from corpus + project JSON | Invent numbers |
| Hugging Face (optional) | Rephrase using facts + RAG passages | Replace local RAG |

LLM / RAG never calculate area, units, filtering, rooms, or coverage.

| Config | Purpose |
|---|---|
| (none) | Local RAG always on |
| `HF_TOKEN`, `HF_MODEL`, `HF_PROVIDER`, `HF_TIMEOUT` | Optional polish |

Primary docs: [LOCAL_RAG.md](./LOCAL_RAG.md) · [AI_SETUP.md](./AI_SETUP.md).
