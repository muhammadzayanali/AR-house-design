# Architecture — Plotline FYP

## Stack

```
User (Android Chrome / desktop browser)
        │
        ▼
   Next.js (React + TypeScript + Tailwind)
        │  WebXR / R3F / Three.js / drei
        │  Hit-test → world (x,y,z) → shoelace area
        │
        ▼  /api/* rewrite
   Django REST Framework
        │
        ├─► SQLite  (User, HouseDesign, Project, Report)
        │
        └─► Local RAG (+ optional Hugging Face)
                 Explain stored facts — never recalculate area
```

## Responsibility separation

| Layer | Responsibility |
|---|---|
| WebXR | Spatial tracking + ground hit-test coordinates |
| Mathematics | Distances, polygon/rectangle area (m²) — shoelace on XZ |
| Units | Marla / Kanal / Acre conversion (configured constants) |
| Django | Auth, validation, persistence, ownership |
| Rule engine | Match plot m² to HouseDesign ranges (not ML) |
| Feasibility | Footprint, remaining area, coverage % |
| Three.js / R3F | Procedural house / GLB + OrbitControls / AR placement |
| Local RAG | Grounded consultant Q&A from corpus + project JSON |
| Hugging Face | Optional natural-language polish |

**Full worked math + test data + every feature:** [SYSTEM_WORKING_GUIDE.md](./SYSTEM_WORKING_GUIDE.md).

## What AI is not

- Does not design geometric houses
- Does not analyse camera images
- Does not replace a licensed architect or surveyor

## Data flow (happy path)

Measure → area → recommend → visualize → save Project → generate Report → Ask Q&A
