# FYP Hardening — Final Implementation Report

Date: 2026-09-22

## 1. Files changed / created

### Created
- `backend/planning/grounded_context.py` — FACT / ESTIMATE / LIMITATION + match reasons
- `backend/planning/services/ai_validator.py` — HF polish grounding validator
- `backend/planning/test_dataset.py` — master expected values (15×12, etc.)
- `backend/planning/tests/test_hardening.py` — grounding, validator, dataset, ask API
- `docs/AR_TESTING.md` — physical WebXR manual procedure
- `docs/FYP_HARDENING_GAP_REPORT.md`
- `docs/FYP_HARDENING_REPORT.md` (this file)
- `frontend/playwright.config.ts`
- `frontend/e2e/planning-flow.spec.ts`

### Updated
- `backend/planning/knowledge/corpus.py` — `source_type` / `category`
- `backend/planning/services/local_rag.py` — grounded project chunk + debug trace
- `backend/planning/services/huggingface_service.py` — stronger system prompt + grounded JSON
- `backend/planning/narration.py` — grounded context + validator fallback
- `backend/planning/feasibility.py` — Villa style aggregation filter
- `backend/planning/views.py` — Villa style, match_reason, ask grounded/debug
- `frontend/components/architecture/StylePicker.tsx` — Compatible/Nearby + match reason
- `frontend/components/architecture/ArchitecturalHouse.tsx` — foundation / fence site cues
- `frontend/components/ar/ARExperience.tsx` — AR steps + unsupported fallback + live area
- `frontend/app/projects/[id]/page.tsx` — Facts/Estimates/Limitations UI hints
- `frontend/package.json` — Playwright scripts
- `docs/SYSTEM_WORKING_GUIDE.md` — viva section, grounding, test layers
- `docs/README.md`

## 2. Architecture changes

Preserved:

```text
Next.js → Django/SQLite → Feasibility/Recommend → Local TF-IDF RAG → Optional HF
```

Added an explicit **grounded context** layer so AI cannot silently become the calculator.

No Postgres, Redis, vector DB, or microservices.

## 3. AI / RAG changes

| Piece | Behaviour |
|-------|-----------|
| Retrieval | Unchanged TF–IDF + cosine + intent boosts |
| Project facts | Dynamic `source_type=project_facts` chunk every ask |
| Fact/estimate | `build_grounded_context()` |
| Grounding | HF system prompt forbids inventing regs/rooms/costs |
| Validation | `validate_ai_text` → fallback to local RAG |
| Trace | `debug` on ask when `DEBUG` or `?debug=1` |

## 4. 3D changes

- Kept procedural `ArchitecturalHouse` + shared `HouseRenderer`
- Added foundation pad + site fence cues
- Lighting/day-evening already present in `ArchViewer`
- Still **not** claimed as photoreal CGI

## 5. AR changes

- Same `HouseRenderer` for viewer + AR (1 unit = 1 m)
- Clearer setup steps + unsupported-device fallback copy
- Reset placement already existed; documented in `AR_TESTING.md`
- Physical AR remains **manual**

## 6. Testing report

```text
Django tests:     40 passed
Frontend tsc:     (run with npm run typecheck)
Playwright API:   (run with API_BASE=http://127.0.0.1:8000 npm run test:e2e)
Physical AR:      Manual verification required — docs/AR_TESTING.md
```

Do **not** merge these into one “X tests OK = full system verified” claim.

## 7. Remaining limitations

- AR accuracy / drift on large plots
- No municipal bylaw / setback / FAR engine
- Costs are catalog estimates
- HF can still fail or be rejected by validator
- Playwright does not run real WebXR
- Procedural models are architectural visualization quality, not marketing CGI

## 8. Viva readiness

| Demo | Ready? |
|------|--------|
| Manual 15×12 → 180 m² → Marla | Yes |
| Style → Italian → Compact Villa → feasibility 50% | Yes |
| 3D Orbit + Evening | Yes |
| Ask consultant (local RAG / grounded) | Yes |
| Django 40 tests | Yes |
| Physical AR walk-around | Manual on Android HTTPS |

See `docs/SYSTEM_WORKING_GUIDE.md` §17 for viva Q&A.
