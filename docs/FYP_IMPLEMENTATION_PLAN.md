# FYP Implementation Plan

Priorities for completing the existing repository without rewriting architecture.

---

## P0 — Required for final demo

1. **Database enrichment** — Project name, measurement_type, length/width, stored units, `updated_at`; HouseDesign `active` + bathrooms; migrations + seed update.
2. **AI service clarity** — Move HF client into `services/huggingface_service.py`; strengthen prompts; when HF unavailable return explicit unavailable (do not label template as AI); keep optional labeled fallback for offline demos.
3. **Project delete** — DELETE `/api/projects/<id>/` + dashboard/detail UI.
4. **Measurement UX** — Accuracy disclaimer; land-unit caveat; allow 3–8 boundary points; finish measurement; real-time area/units; clear AR unsupported messaging.
5. **Dashboard / project detail** — Totals, AI health, delete, regenerate with correct `source`, measurement metadata, OrbitControls viewer, link back to AR.
6. **Backend tests** — Units, area math, recommendation, auth ownership, project CRUD.
7. **Frontend scripts** — `typecheck` script; fix lint/type errors.
8. **Documentation** — ARCHITECTURE, API, AR_SETUP, AI_SETUP, TESTING, FINAL_QA_CHECKLIST, FINAL_IMPLEMENTATION_REPORT.

## P1 — Important

1. Register duplicate email validation (optional unique email).
2. Question length validation on ask endpoint.
3. HouseModel error boundary / load failure UI.
4. Seed 4th design (Contemporary Villa) if GLB available or reuse massing.
5. CORS / ALLOWED_HOSTS production notes.
6. Improve AR reticle + reset placement controls.

## P2 — Polish / future

1. Rename project.
2. Thumbnails for houses.
3. Rate limiting AI.
4. Postgres deployment.
5. Vision / obstacle detection (explicitly out of scope — document only).

---

## Execution order

AUDIT (done) → PLAN (this file) → P0 implement → test → fix → P1 → final report.
