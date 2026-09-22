# AI & Local RAG Setup

Consultant Q&A and reports are powered by **local RAG** (always on).  
Hugging Face is **optional** polish. Tokens stay on the Django backend only.

## Local RAG (default — no token required)

Works offline. Retrieves from:

1. Built-in knowledge corpus (`planning/knowledge/corpus.py`)
2. This project’s stored fields (plot, style, design, rooms, feasibility, cost)

Full design: [LOCAL_RAG.md](./LOCAL_RAG.md).

Check after restart: ask any project question → UI source should show
**Local RAG (project fields + knowledge base)** unless HF polish succeeds.

## Optional Hugging Face polish

1. https://huggingface.co/settings/tokens — enable Inference Providers  
2. Edit `backend/.env`:

```bash
HF_TOKEN=hf_your_real_token
HF_MODEL=Qwen/Qwen2.5-72B-Instruct
HF_PROVIDER=auto
HF_TIMEOUT=25
```

3. Restart Django:

```bash
cd backend
../.venv/bin/python manage.py runserver 0.0.0.0:8000
```

`GET /api/health/` → `"llm_configured": true` means polish is available.
If HF errors, answers still return from local RAG.

## Behaviour

| State | Report / Ask `source` |
|---|---|
| Always | `local_rag` available |
| Token set + provider OK | may return `huggingface` |
| Token missing / HF error | `local_rag` (full answer, not a dead-end dump) |

## Implementation

- `planning/services/local_rag.py` — retrieve + synthesize  
- `planning/knowledge/corpus.py` — knowledge chunks  
- `planning/services/huggingface_service.py` — optional InferenceClient  
- `planning/narration.py` — orchestration  
