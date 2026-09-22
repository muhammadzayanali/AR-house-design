# FYP Hardening Gap Report (pre-fix baseline → addressed)

Generated during final hardening pass. Status after implementation noted.

| Area | Baseline | After hardening |
|------|----------|-----------------|
| Facts / estimates / limitations JSON | PARTIAL (convention only) | **EXISTS** `grounded_context.py` |
| HF grounding validator | MISSING | **EXISTS** `ai_validator.py` |
| Corpus `source_type` / `category` | MISSING | **EXISTS** |
| RAG debug/trace | PARTIAL (passages only) | **EXISTS** (`debug` on ask when DEBUG/`?debug=1`) |
| Report same `project_facts` | EXISTS | Strengthened + grounded sections |
| Design match reason w/ footprint/coverage | PARTIAL | **EXISTS** `match_reason` + `feasibility_preview` |
| Villa style card | MISSING | **EXISTS** (aggregates *Villa designs) |
| Style → catalog UX badges | PARTIAL | Compatible / Nearby + match reason + empty catalog |
| Procedural 3D | EXISTS | Foundation/fence/site polish (modern/contemporary/luxury still share some massing) |
| Shared HouseRenderer AR+viewer | EXISTS | Unchanged (verified) |
| AR unsupported fallback copy | PARTIAL | Strengthened |
| Playwright E2E | MISSING | Added (manual measure / API path) |
| Empty catalog UI | MISSING | **EXISTS** (DesignCatalog empty state) |
| Master test dataset | PARTIAL (scattered) | **EXISTS** `test_dataset.py` |
| Vector DB | N/A (correctly absent) | Still absent (by design) |

Note: early audit agents ([Audit FYP frontend 3D/AR/UX/E2E gaps](7eb06072-f0bb-46bc-9543-05c4fe2a3954), [Audit FYP backend AI/RAG/feasibility/views gaps](9229c132-e3b5-4f15-a9a7-ce658909710b)) ran on pre-hardening code; this table reflects post-hardening status.
