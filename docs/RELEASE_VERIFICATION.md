# Final Release Verification Log

**Freeze date:** 2026-09-23  
**Branch:** `devel`  
**Status:** DEMO / VIVA PREPARATION MODE — documentation synchronized; implementation frozen except for physical Android WebXR.

---

## Automated vs manual

| Layer | Status | Proves |
|-------|--------|--------|
| Django `planning` tests | **41 passed** | Engines, API, validator, RAG, ownership |
| TypeScript (`tsc --noEmit`) | **PASS** (prior verification) | Types compile |
| ESLint | **PASS** (prior verification) | Lint clean |
| Next.js production build | **PASS** (prior verification) | Shipable frontend |
| Playwright E2E | **4 passed** (prior verification) | Browser/API critical path |
| Physical Android WebXR | **MANUAL — PENDING DEVICE VERIFICATION** | Real immersive-ar on phone |

**Never claim Playwright (or Django/tsc/lint/build) proves physical WebXR.**

---

## Commands (automated)

```bash
cd backend && ../.venv/bin/python manage.py test planning -v1
# → Ran 41 tests … OK   (re-confirmed 2026-09-23 during freeze audit)

cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && API_BASE=http://127.0.0.1:8000 npx playwright test
# → 4 passed (recorded 2026-09-22; not re-run on docs-only freeze)
```

---

## Master demo scenario (must match `seed_houses` + engines)

```text
Plot:           15 m × 12 m
Area:           180 m²
Land units:     7.117 Marla → display 7.12 Marla (180.0 m²)
                0.3558 Kanal · 0.04448 Acre
Style:          Italian Villa
Design:         Italian Compact Villa
Plot range:     120–180 m²
Building:       10 × 9 m
Footprint:      90 m²
Remaining:      90 m²
Coverage:       50%
Rooms:          3 bedrooms · 2 bathrooms · 2 floors
Feasibility:    suitable_preliminary
Match:          exact
```

Verified against `seed_houses.py` Italian Compact Villa row (120–180, 10×9, 3/2/2).

---

## Style picker (8 styles)

1. Modern  
2. Italian Villa  
3. American  
4. Cottage / Hut  
5. Contemporary  
6. Traditional  
7. Villa  
8. Luxury Villa  

Source of truth: `StyleCatalogView.STYLES` in `backend/planning/views.py`.

---

## AI grounding architecture (unchanged)

```text
Django calculation engines
        ↓
project facts
        ↓
grounded context (FACT / ESTIMATE / LIMITATION)
        ↓
local RAG / optional Hugging Face
        ↓
AI narration
        ↓
validator (ai_validator.py)
        ↓
accept OR fallback to grounded local RAG
```

AI must **not** measure land, convert units, select designs, invent rooms/setbacks/FAR/approvals.

Validator spot-check (prior):

| Case | Result |
|------|--------|
| Valid grounded text | ACCEPT |
| Wrong bedroom count | REJECT → local RAG |
| Unsupported setback claim | REJECT → local RAG |
| Invented footprint number | REJECT → local RAG |

---

## Documentation corrections in this freeze

- `SYSTEM_WORKING_GUIDE.md`: style picker **7 → 8** styles; list + Villa aggregate note  
- `DESIGN_CATALOG.md`: full 8-style picker list + Villa filter behaviour  
- This file: automated vs manual split; freeze status; master scenario  

---

## Accepted limitations (do not “fix” in freeze)

1. AR measurement is approximate — not a licensed surveying tool.  
2. Not a municipal approval / by-law engine.  
3. No FAR / setback compliance claimed.  
4. Recommendation is deterministic / rule-based, not trained ML.  
5. No camera scene understanding / computer vision.  
6. Procedural 3D = real-time massing, not photoreal CGI.  
7. Physical WebXR needs ARCore-capable Android + Chrome + Play Services for AR + HTTPS.  
8. Cost values are catalog estimates.  
9. AI explains grounded facts; it does not author measurements.  
10. Modern / Contemporary / Luxury share some procedural massing (soft).  
11. **No AR scale slider** — 1 world unit = 1 metre by design.  
12. Physical WebXR remains **manual** until device checklist passes.

---

## Fixes applied during earlier verification (real issues only)

1. ESLint: `<a href="/">` → `<Link href="/">` in `ARExperience.tsx`  
2. ESLint: AuthProvider ready-state init  
3. AI validator: reject invented footprint numbers  
4. Restored / extended validator tests  

---

## FINAL RELEASE STATUS

```text
Backend:              PASS (41 Django planning tests)
Frontend:             PASS (tsc — prior)
Lint:                 PASS (prior)
Production Build:     PASS (prior)
Playwright:           PASS (4 — prior; not physical AR)
AI Grounding:         PASS (architecture + validator intact)
Local RAG:            PASS (works without HF_TOKEN)
3D:                   PASS (shared HouseRenderer)
Physical WebXR:       PENDING MANUAL DEVICE TEST
```

### Blockers

None for **demo / viva preparation** on the automated path and manual 15×12 → style → 3D flow.

Physical immersive AR is **blocked only by device/environment** until an ARCore Android phone completes `docs/AR_TESTING.md`.

### Minor issues

- Villa picker card aggregates `*villa*` styles (by design); no separate `style="Villa"` seed rows.  
- Some phones report WebXR support then fail `requestSession` (ARCore / Chrome / HTTPS).

### Next step

Physical Android AR verification per `docs/AR_TESTING.md`, then viva/demo.
