# Plotline — Complete System Working Guide

**Purpose:** Viva / demo explanation of how every feature works, with **real formulas** and **worked test data** from the codebase.

**Primary demo numbers used below:** Manual / AR-equivalent plot **15 m × 12 m = 180 m²** → **Italian Compact Villa**.

---

## 1. End-to-end flow (what the user does)

```text
1. Register / Login          → Django Token auth (SQLite)
2. Measure plot             → AR hit-test corners  OR  manual L × W
3. Area (m²)                → shoelace / rectangle math
4. Convert units            → Marla / Kanal / Acre (constants)
5. Pick architectural style → e.g. Italian Villa
6. Match catalog designs    → filter by style + plot range
7. Feasibility check        → footprint, remaining, coverage %
8. View 3D / Place in AR    → procedural house (or optional GLB)
9. Save Project             → full plot + house + feasibility snapshot
10. Report + Ask consultant → Local RAG (+ optional Hugging Face polish)
```

**Important:** AI does **not** measure the plot, pick the house by ML, or look at the camera. Numbers come from math + database rules. AI / RAG only **explains**.

---

## 2. How AR measures area (mathematics)

### 2.1 Coordinate system

WebXR + Three.js use a **right-handed, y-up** world:

| Axis | Meaning |
|------|---------|
| **X** | Horizontal (left/right on the ground plane) |
| **Y** | Vertical (height — ignored for land area) |
| **Z** | Horizontal (depth / forward on the ground plane) |

A land plot is a **2D parcel on the ground**. We project every hit point onto the **XZ plane** and drop **Y**.

Code: `frontend/lib/geometry/area.ts` (mirrored in `backend/planning/geometry.py`).

### 2.2 What happens when you tap “Mark corner”

1. Phone enters immersive AR (`store.enterAR()`).
2. ARCore / WebXR runs **ground hit-testing**.
3. A gold reticle shows the hit on the floor.
4. Each tap stores a world point `{ x, y, z }` in metres.
5. You tap **3–8 corners in order** around the plot boundary (clockwise or counter-clockwise).
6. On finish, area is computed from those points.

### 2.3 Distance between two corners (XZ)

\[
d = \sqrt{(x_2 - x_1)^2 + (z_2 - z_1)^2}
\]

Height \(y\) is **not** used (plot is flat for planning).

### 2.4 Case A — Manual rectangle (no AR)

User enters length \(L\) and width \(W\) in metres:

\[
A = L \times W
\]

**Test data T1 — Manual 15 × 12**

\[
A = 15 \times 12 = 180\ \mathrm{m}^2
\]

### 2.5 Case B — Two AR points (diagonal shortcut)

If only **2** points are stored, the app treats them as opposite corners of an **axis-aligned** rectangle on XZ:

\[
A = |x_2 - x_1| \times |z_2 - z_1|
\]

If that product is ≤ 0.5 m² (almost collinear on one axis), it falls back to \(d^2\) (square on the span).

**Test data T2 — Two points (0,0) → (15,12)**

\[
A = |15-0| \times |12-0| = 180\ \mathrm{m}^2
\]

### 2.6 Case C — Polygon (≥ 3 points): Shoelace formula

For ordered vertices \((x_i, z_i)\), \(i = 1 \ldots n\), with \((x_{n+1}, z_{n+1}) = (x_1, z_1)\):

\[
A = \frac{1}{2} \left| \sum_{i=1}^{n} \bigl( x_i z_{i+1} - x_{i+1} z_i \bigr) \right|
\]

This is the classical **shoelace (surveyor’s)** formula.

#### Worked example T3 — Rectangle as 4 AR corners (same as 15 × 12)

| Corner | \(x\) (m) | \(z\) (m) |
|--------|-----------|-----------|
| P1 | 0 | 0 |
| P2 | 15 | 0 |
| P3 | 15 | 12 |
| P4 | 0 | 12 |

Compute term \(x_i z_{i+1} - x_{i+1} z_i\):

| Edge | Term |
|------|------|
| P1→P2 | \(0\cdot0 - 15\cdot0 = 0\) |
| P2→P3 | \(15\cdot12 - 15\cdot0 = 180\) |
| P3→P4 | \(15\cdot12 - 0\cdot12 = 180\) |
| P4→P1 | \(0\cdot0 - 0\cdot12 = 0\) |

\[
\sum = 360,\quad A = |360|/2 = 180\ \mathrm{m}^2
\]

Same result as manual \(15 \times 12\).

#### Worked example T4 — Right triangle

| Corner | \(x\) | \(z\) |
|--------|-------|-------|
| A | 0 | 0 |
| B | 10 | 0 |
| C | 0 | 10 |

\[
A = \tfrac{1}{2}|0\cdot0 - 10\cdot0 + 10\cdot10 - 0\cdot0 + 0\cdot0 - 0\cdot10| = \tfrac{1}{2}|100| = 50\ \mathrm{m}^2
\]

(Matches \(\tfrac{1}{2}\times 10\times 10\).)

#### Worked example T5 — Irregular quadrilateral

| Corner | \(x\) | \(z\) |
|--------|-------|-------|
| A | 0 | 0 |
| B | 20 | 0 |
| C | 20 | 15 |
| D | 0 | 12 |

\[
A = 270\ \mathrm{m}^2
\]

(Verified by `planning.geometry.area_sqm_from_points`.)

### 2.7 Accuracy disclaimer (honest for viva)

- AR tracking can **drift** on large plots.
- Hit points are **approximate planning** positions, not a cadastral survey.
- Always show the in-app accuracy disclaimer.

---

## 3. Land unit conversion (Pakistan / Punjab constants)

Code: `backend/planning/units.py` and `frontend/lib/units/land.ts`.

| Unit | Definition used in this FYP |
|------|-----------------------------|
| 1 Marla | \(272.25\ \mathrm{ft}^2 = 25.29285264\ \mathrm{m}^2\) |
| 1 Kanal | \(20\) Marla \(= 505.8570528\ \mathrm{m}^2\) |
| 1 Acre | \(160\) Marla \(= 8\) Kanal \(= 4046.8564224\ \mathrm{m}^2\) |

Formulas:

\[
\mathrm{Marla} = \frac{A}{25.29285264},\quad
\mathrm{Kanal} = \frac{A}{505.8570528},\quad
\mathrm{Acre} = \frac{A}{4046.8564224}
\]

### Test data T6 — Convert 180 m²

\[
\begin{align*}
\mathrm{Marla} &= 180 / 25.29285264 \approx \mathbf{7.117}\ \mathrm{Marla}\\
\mathrm{Kanal} &= 180 / 505.8570528 \approx \mathbf{0.3558}\ \mathrm{Kanal}\\
\mathrm{Acre}  &= 180 / 4046.8564224 \approx \mathbf{0.04448}\ \mathrm{Acre}
\end{align*}
\]

Display label in UI: **7.12 Marla (180.0 m²)**.

These are **configured constants**, not ML parameters.

---

## 4. Style selection + catalog matching

### 4.1 How it works

1. After area ≥ 10 m², user opens **style picker** (8 styles):
   Modern, Italian Villa, American, Cottage / Hut, Contemporary, Traditional, Villa, Luxury Villa.
   (`GET /api/styles/` — `StyleCatalogView.STYLES`)
2. API: `GET /api/designs/match/?style=Italian%20Villa&plot_area=180`
3. Backend filters `HouseDesign` where:
   - `active = True`
   - `style` matches (case-insensitive); **Villa** aggregates styles containing `"villa"` (e.g. Italian Villa + Luxury Villa)
   - `min_plot ≤ plot_area ≤ max_plot` → **exact**
   - else nearest by range midpoint → **nearby**

**Not machine learning** — table lookup + distance to midpoint.

### 4.2 Test data T7 — Italian Compact Villa on 180 m²

From seed data (`seed_houses`):

| Field | Value |
|-------|-------|
| Name | Italian Compact Villa |
| Style | Italian Villa |
| Plot range | **120 – 180 m²** |
| Building W × D | **10 m × 9 m** |
| Footprint | \(10 \times 9 = \mathbf{90\ m^2}\) |
| Floors | 2 |
| Bedrooms / baths | 3 / 2 |
| Cost range | PKR 14,000,000 – 19,000,000 |

Check: \(120 \le 180 \le 180\) → **exact match**.

Reason text style: *Exact match for Italian Villa on 7.12 Marla (180.0 m²).*

---

## 5. Feasibility (how coverage is calculated)

Code: `backend/planning/feasibility.py`

\[
\begin{align*}
\mathrm{Footprint} &= W_{\mathrm{bldg}} \times D_{\mathrm{bldg}}\\
\mathrm{Remaining} &= A_{\mathrm{plot}} - \mathrm{Footprint}\\
\mathrm{Coverage\%} &= \frac{\mathrm{Footprint}}{A_{\mathrm{plot}}} \times 100
\end{align*}
\]

Optional rectangle fit: house \(W\times D\) must fit in plot \(L\times W\) in either orientation.

Status rules:

| Condition | Status |
|-----------|--------|
| Footprint > plot | `oversized` |
| Coverage > 70% | `tight` |
| Rectangle dimensions don’t fit | `dimension_conflict` |
| Else | `suitable_preliminary` |

### Test data T8 — Italian villa on 180 m²

\[
\begin{align*}
\mathrm{Footprint} &= 90\ \mathrm{m}^2\\
\mathrm{Remaining} &= 180 - 90 = \mathbf{90\ m^2}\\
\mathrm{Coverage} &= 90/180 \times 100 = \mathbf{50.0\%}
\end{align*}
\]

Status: **suitable_preliminary** (coverage well under 70%).

Fit check for 15 × 12 plot vs 10 × 9 house: \(10\le15\) and \(9\le12\) → **fits**.

**Disclaimer:** Not a bylaw / setback / FAR check.

---

## 6. Preliminary space estimate (before picking a design)

Area bands (examples):

| Plot m² | Suggested bedrooms (heuristic) |
|---------|--------------------------------|
| 0–100 | 1–2 |
| 100–150 | 2–3 |
| **150–220** | **3–4** ← 180 m² lands here |
| 220–350 | 4–5 |
| 350+ | 5+ |

After a catalog design is selected, that design’s **room programme** is authoritative.

---

## 7. 3D visualization & AR placement

| Mode | How it works |
|------|----------------|
| **Procedural** (`model_type=procedural`) | Three.js / R3F builds `ArchitecturalHouse` from `model_config` (floors, footprint, Italian portico, roof, windows, trees…) |
| **GLB** (`model_type=glb`) | Loads `glb_url` / `model_url` into the same viewer |
| **Desktop viewer** | OrbitControls + sun shadows + optional Evening light |
| **AR place** | Same model anchored on the measured ground plane so the user can walk around |

Scale is in **metres** so a 10×9 footprint reads true-to-scale relative to the plot.

---

## 8. Authentication & project save (SQLite)

### Auth

- Register / Login → DRF **Token**
- Token stored in browser `localStorage`
- Every project / report / ask call sends `Authorization: Token …`

### What is saved on a Project

- Owner user
- Plot area (m²), length/width, measurement type (`ar` | `manual`)
- Plot corner points JSON (if AR)
- Preferred style, selected house FK
- Recommendation reason
- Feasibility snapshot
- Optional screenshot
- Converted Marla / Kanal / Acre fields

**Test scenario:** User measures 15×12 → selects Italian Villa → Italian Compact Villa → save → reopen from dashboard — all fields reload from SQLite.

Ownership: User B requesting User A’s project → **404**.

---

## 9. Report generation

1. Flatten project → `project_facts()` JSON (plot, house, rooms, feasibility, cost, reason).
2. Prefer optional Hugging Face narration if `HF_TOKEN` works.
3. Otherwise **local RAG report** (`source: local_rag`).

AI never recalculates area; it only narrates stored facts.

---

## 10. Ask the consultant (Local RAG)

Full design: [`LOCAL_RAG.md`](./LOCAL_RAG.md).

```text
Question
  → detect intent (beautify / cost / why / rooms / coverage / …)
  → retrieve top knowledge chunks (TF–IDF) + project-facts chunk
  → synthesize answer grounded on numbers + style guidance
  → optional HF polish
```

**Test question:** *how can I make this house more beautiful?*  
For Italian Compact Villa → terracotta roof, portico, shutters, landscaping, Evening mode — **not** a raw JSON dump.

Sources:

| `source` | Meaning |
|----------|---------|
| `local_rag` | Offline grounded answer |
| `huggingface` | HF polish with RAG context |

---

## 11. Feature checklist — what each feature does

| # | Feature | Input | Process | Output |
|---|---------|-------|---------|--------|
| 1 | **Register / Login** | username/password | Django auth + Token | Session for API |
| 2 | **AR Enter** | Camera + ARCore | WebXR immersive session | Live ground tracking |
| 3 | **Mark corners** | Hit-test taps | Store `{x,y,z}` | Polygon vertices |
| 4 | **Area from AR** | Points | Shoelace / 2-pt rectangle | m² |
| 5 | **Manual L×W** | metres | \(L\times W\) | m² (fallback) |
| 6 | **Unit conversion** | m² | ÷ Marla/Kanal/Acre constants | Local units |
| 7 | **Style picker (8 styles)** | Style id | List styles API | UI cards + 3D preview |
| 8 | **Design match** | style + plot m² | Range filter | Exact / nearby designs |
| 9 | **Feasibility** | plot + house dims | Remaining + coverage % | Status + note |
| 10 | **Space estimate** | plot m² | Band table | Preliminary rooms hint |
| 11 | **3D viewer** | HouseDesign | Procedural or GLB | Orbit view |
| 12 | **AR place house** | Same model | Anchor on ground | Walk-around viz |
| 13 | **Save project** | All of above | SQLite Project row | Persistent record |
| 14 | **Dashboard** | Token | List user’s projects | Totals + links |
| 15 | **Report** | Project facts | Local RAG / HF | Narrated summary |
| 16 | **Ask consultant** | Question + facts | Local RAG (+ HF) | Grounded Q&A |
| 17 | **Delete project** | Project id | Owner-only destroy | Removed from DB |

---

## 12. Master test dataset (use in viva / demo)

### Dataset A — Happy path (matches your Italian villa project)

| Step | Value |
|------|-------|
| Length × Width | 15 m × 12 m |
| Area | **180 m²** |
| Marla | **7.117** (show as 7.12) |
| Kanal | **0.3558** |
| Acre | **0.04448** |
| Style | Italian Villa |
| Design | Italian Compact Villa |
| Building | 10 × 9 m |
| Footprint | **90 m²** |
| Remaining | **90 m²** |
| Coverage | **50%** |
| Rooms | 3 bed, 2 bath, 2 floors |
| Cost | PKR 14M – 19M |
| Feasibility | suitable_preliminary |
| Match | exact (120–180 m² range) |

### Dataset B — Geometry unit tests (already in Django tests)

| Case | Points / dims | Expected area |
|------|---------------|---------------|
| Manual rect | 15 × 12 | 180 |
| Shoelace rect | (0,0),(15,0),(15,12),(0,12) | 180 |
| Triangle | (0,0),(10,0),(0,10) | 50 |
| Irregular | (0,0),(20,0),(20,15),(0,12) | 270 |
| 1 Marla | 25.29285264 m² | 1.000 Marla |
| 1 Kanal | 505.8570528 m² | 1.000 Kanal |

Run:

```bash
cd backend
../.venv/bin/python manage.py test planning -v2
```

---

## 13. What is *not* claimed (say this in viva)

1. Not a licensed architect / surveyor / municipal approval tool.  
2. Not computer vision — no image understanding of the camera feed.  
3. Recommendation is **rule-based**, not trained ML.  
4. Procedural 3D is real-time architectural massing, not Unreal photoreal CGI.  
5. Local RAG explains stored facts + knowledge; it does not invent new measurements.

---

## 14. Code map (where to open during viva)

| Topic | File |
|-------|------|
| AR area math (frontend) | `frontend/lib/geometry/area.ts` |
| Area math (backend) | `backend/planning/geometry.py` |
| Units | `backend/planning/units.py` |
| Recommendation | `backend/planning/recommendation.py` |
| Feasibility | `backend/planning/feasibility.py` |
| Seed catalog | `backend/planning/management/commands/seed_houses.py` |
| Procedural 3D | `frontend/components/architecture/ArchitecturalHouse.tsx` |
| Local RAG | `backend/planning/services/local_rag.py` |
| Grounded FACT/ESTIMATE | `backend/planning/grounded_context.py` |
| AI validator | `backend/planning/services/ai_validator.py` |
| Master test dataset | `backend/planning/test_dataset.py` |
| AR UI flow | `frontend/components/ar/ARExperience.tsx` |

Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [AR_SETUP.md](./AR_SETUP.md) · [AR_TESTING.md](./AR_TESTING.md) · [LOCAL_RAG.md](./LOCAL_RAG.md) · [FEASIBILITY_ENGINE.md](./FEASIBILITY_ENGINE.md) · [DESIGN_CATALOG.md](./DESIGN_CATALOG.md) · [FYP_HARDENING_GAP_REPORT.md](./FYP_HARDENING_GAP_REPORT.md).

---

## 15. Facts vs estimates vs limitations (AI grounding)

Every consultant / report context is built as:

```text
facts      → plot, design, rooms, footprint, coverage (Django engines + HouseDesign)
estimates  → catalog cost min/max, preliminary space bands
limitations→ survey / bylaw / approval / photorealism disclaimers
```

Code: `planning/grounded_context.py` → attached on `project_facts()` and `/ask/` as `grounded`.

Optional Hugging Face polish is validated by `ai_validator.py`. Unsupported regulation claims or contradictory room counts → **discard HF text**, keep local RAG.

---

## 16. Testing layers (do not mix these numbers)

| Layer | What it proves | Command / doc |
|-------|----------------|---------------|
| **Django unit/API** | Math, units, match, feasibility, RAG, grounding, ownership | `python manage.py test planning` (**41** tests) |
| **Playwright** | Browser/API critical path; **not** physical AR | `cd frontend && npm run test:e2e` |
| **Physical AR** | WebXR on Android device | [AR_TESTING.md](./AR_TESTING.md) manual sheet |

---

## 17. Viva Technical Explanation

### Why Django?
DRF + SQLite keeps auth, ownership, catalog, and calculation engines in one explainable backend. Ideal for FYP scope — no microservices.

### Why Next.js?
TypeScript React app for WebXR/R3F UI, API proxy, and fast demo iteration on LAN HTTPS.

### Why Three.js / R3F?
Real-time 3D in the browser. Procedural houses need no large GLB downloads for the default catalog.

### Why WebXR?
Places the **same** metre-scale house on a real ground plane via hit-testing. Ordinary Orbit viewer cannot do that immersion.

### Why procedural generation?
Deterministic style configs (Italian portico, American garage, modern cantilever) without depending on unlicensed Sketchfab assets. Optional GLB remains supported.

### Why TF–IDF instead of a vector DB?
Lightweight, offline, no Chroma/FAISS ops cost. Corpus is small (~15 chunks). Cosine TF–IDF is viva-explainable and sufficient.

### What is RAG?
Retrieve relevant knowledge passages + **current project-facts chunk**, then synthesize an answer. Not “the LLM invents the plan.”

### How does current project context reach the AI?
`POST /ask/` → load Project (owner-only) → `project_facts()` → dynamic `project-facts` chunk + grounded JSON → local synthesis / optional HF.

### Why doesn't the LLM calculate feasibility?
Feasibility is deterministic Python (`compute_feasibility`). LLM only narrates those numbers.

### How is hallucination reduced?
1) Facts/estimates split  
2) Strong HF system prompt  
3) Deterministic `validate_ai_text` → fallback to local RAG  
4) Disclaimers in corpus and UI

### What are the system limitations?
Approximate measurement; no bylaws/setbacks/FAR; costs are estimates; procedural ≠ photoreal; AR needs Android Chrome + ARCore + HTTPS.

### How is AR different from ordinary 3D?
AR uses WebXR immersive session + hit-test anchors in real space. Desktop 3D uses OrbitControls in a canvas.

### How is plot area calculated?
XZ shoelace (or L×W). See §2.

### How is the same design reused between 3D and AR?
`HouseRenderer` in `ArchViewer.tsx` — procedural or GLB from `HouseDesign.model_type`.

### What do the Django tests prove?
Backend correctness of units, geometry, matching, feasibility, RAG, grounding, auth — **not** device AR.

### What is manually tested?
Physical WebXR placement/scale on Android — see `AR_TESTING.md`.
