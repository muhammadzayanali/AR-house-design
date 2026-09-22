# FYP Implementation Audit

**Project:** AI-Assisted Architectural Planning and AR House Visualization System  
**Date:** 2026-09-21  
**Scope:** Existing repository only (no greenfield rewrite)

---

## A. Already working

| Area | Evidence |
|---|---|
| Next.js App Router + Tailwind shell | `frontend/app/*`, layout, PWA manifest |
| Auth register / login / logout / me | DRF Token auth; `AuthProvider` persists token in `localStorage` |
| Password hashing | `User.objects.create_user` (Django PBKDF2) |
| Project ownership filtering | `Project.objects.filter(user=request.user)` on list/detail/report/ask |
| House catalog + seed command | `seed_houses`; 3 designs with plot ranges |
| Rule-based recommendation | `planning/recommendation.py` — range match, not ML |
| Land unit conversion (backend + frontend) | `units.py` / `lib/units/land.ts` — Marla/Kanal/Acre constants |
| Manual L×W measurement fallback | AR page rectangle inputs |
| Polygon area (shoelace on XZ) | `lib/geometry/area.ts` |
| WebXR store + Enter AR + hit-test reticle | `@react-three/xr` v6 `createXRStore`, `useXRHitTest` |
| GLB load via `useGLTF` | `HouseModel.tsx` + `ModelViewer` OrbitControls |
| Save project + screenshot card | multipart create + `makeSummaryCard` |
| Report + Q&A endpoints | Wired to `narration.py` / InferenceClient |
| API proxy via Next rewrites | `next.config.ts` → Django `:8000` |
| HTTPS dev script | `npm run dev:https` |

---

## B. Partially working

| Area | Gap |
|---|---|
| Hugging Face AI | Code path real; `HF_TOKEN` still placeholder → template fallback used |
| AR measurement | Works in code; **not verified on physical Android Chrome** |
| GLB houses | Load pipeline works; assets are **procedural placeholder massing**, not finished architecture |
| Project detail | Report/Q&A work; missing delete, rename, measurement metadata, accuracy disclaimer |
| Dashboard | Lists projects; missing totals, AI status, delete |
| Boundary points | Add/undo/reset exist; **hard-capped at 4**; no explicit “finish polygon” |
| AI labeling | Template responses can look like AI if `source` / warning ignored |

---

## C. Broken / risky

| Issue | Detail |
|---|---|
| AI template on HF failure | Spec wants clear “AI unavailable” — current code still returns template text (with warning) |
| Report UI hardcodes `source: "huggingface"` after regenerate | Ignores API `source` field |
| No project DELETE | Spec requires delete |
| No Django tests | Zero automated coverage for units / recommendation / ownership |
| DEBUG `ALLOWED_HOSTS` includes `*` | Acceptable for local demo; must be documented as not production-safe |
| AR phase resets to `setup` on session end | Can clear in-progress UX unexpectedly |

---

## D. Missing (vs final FYP task)

- Project fields: `name`, `plot_length_m`, `plot_width_m`, `measurement_type`, stored marla/kanal/acre, `updated_at`
- HouseDesign: `active`, `bathrooms`, `updated_at`, optional thumbnail
- Dedicated `services/huggingface_service.py` (logic lives in `narration.py`)
- Backend polygon area validation utility (frontend-only today)
- Accuracy / non-survey disclaimer in UI
- Full `/docs/*` set (ARCHITECTURE, API, AR_SETUP, AI_SETUP, TESTING, QA, FINAL)
- Frontend typecheck script in `package.json`
- Irregular plots with **>4** corners
- Inactive house filtering in recommendation

---

## E. Fake / mock functionality

| Item | Status |
|---|---|
| Template AI report/Q&A | **Real fallback**, not a fake success — but must be labeled `source=template` and UI must not call it “AI-generated” |
| Placeholder GLBs | Honest massing; not fake API; must document as replaceable assets |
| No fake AR mode | Good — unsupported browsers get OrbitControls fallback |
| No console-only buttons found in app source | Good |

---

## F. Security problems

- HF token correctly backend-only (good)
- `.env` in `.gitignore` (good); ensure never committed
- CORS allow-all when `DEBUG=True` (local OK)
- Ownership enforced on project endpoints (good)
- Register: email uniqueness not strictly required (username is)
- No rate limiting on AI endpoints (acceptable for FYP)

---

## G. UX problems

- Measurement accuracy disclaimer missing
- Land-unit locality caveat missing
- Dashboard thin (no stats / AI health)
- AR instructions could be clearer for viva demo
- Loading/error/retry incomplete on some pages

---

## H. Mobile / AR problems

- Primary target Android Chrome + ARCore — **device verification pending**
- iOS Safari unsupported — fallback exists
- HTTPS required — documented in README but needs `/docs/AR_SETUP.md`
- Point cap of 4 limits irregular plots

---

## I. AI integration problems

- `HF_TOKEN=hf_your_token_here` → `llm_configured: false`
- Model configurable via `HF_MODEL` (good)
- System prompts need stronger “not licensed architect / no invented numbers” language
- On HF failure: prefer explicit unavailable response over silent template-as-AI

---

## J. Testing gaps

- No `planning/tests/`
- No frontend unit tests for area/units
- No ownership cross-user tests
- No build/typecheck CI scripts beyond `lint`

---

## Trace summary (UI → API → DB)

| Flow | Connected? |
|---|---|
| Register → Token → Dashboard | Yes |
| Manual L×W → `/api/recommend/` → house | Yes |
| AR points → area → recommend → place GLB | Yes (code); device unproven |
| Save → `/api/projects/` → SQLite | Yes |
| Report → HF or template | Yes (HF needs token) |
| Ask → HF or template | Yes (HF needs token) |
| Delete project | **Missing** |
