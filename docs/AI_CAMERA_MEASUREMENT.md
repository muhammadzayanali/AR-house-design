# AI Camera Measurement

**Feature name:** AI Camera Measurement (not “full AR”)

Plotline’s primary device-compatible measurement path uses a normal browser camera plus OpenCV and a **free** Hugging Face depth model. WebXR remains optional.

```text
AI Camera (OpenCV + HF depth)  →  primary
Manual L × W / polygon          →  universal fallback
WebXR / ARCore                  →  optional immersive path
```

---

## Architecture (Option B — Django inference)

```text
Phone camera (getUserMedia)
        ↓ preview locally (no upload)
User taps Analyze Scene
        ↓ one JPEG frame
POST /api/vision/depth/
        ↓
OpenCV preprocess (resize, denoise, CLAHE, edges)
        ↓
Hugging Face Transformers depth-estimation
        ↓
Depth map + ground-plane RANSAC
        ↓ JSON (depth session, visualisation) — image discarded
User taps boundary points + known reference length
        ↓
POST /api/vision/measure/
        ↓
Unproject → plane → user scale → shoelace (existing geometry)
        ↓
m² → units → planning engine (unchanged)
```

Frames are **not** streamed at 30 FPS. Only explicit Analyze uploads one frame. Temporary buffers are not saved to disk.

---

## Hugging Face model selection (free — verified on Hugging Face)

Official model card: https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf

| Field | Value |
|-------|--------|
| Model ID | `depth-anything/Depth-Anything-V2-Small-hf` |
| Licence (model card YAML) | **`apache-2.0`** — free to download and run locally |
| Pipeline tag | `depth-estimation` |
| Card tags | `relative depth` |
| Params | ~24.8M |
| Paid hosted Inference API required? | **No** — local Transformers download |

Sibling checkpoints:

| Model | Licence | FYP use |
|-------|---------|---------|
| Depth Anything V2 **Small** | Apache-2.0 | **Selected** |
| Depth Anything V2 Base/Large | CC-BY-NC-4.0 | Rejected (non-commercial weights) |
| `apple/DepthPro-hf` | Apple-ASCL | Rejected (licence + ~1B params) |

**Selected:** `depth-anything/Depth-Anything-V2-Small-hf`

**Why:**

1. **Free** Apache-2.0 weights on Hugging Face (confirmed on the model README front-matter).
2. Official Transformers `depth-estimation` pipeline.
3. Small enough for CPU-only FYP servers.
4. Explicitly **relative** depth → metric scale from **user calibration** only.

Configure via env (server-side only):

```bash
HF_DEPTH_MODEL=depth-anything/Depth-Anything-V2-Small-hf
HF_DEPTH_TYPE=relative
# Optional CI: VISION_MOCK=1  (synthetic depth, no torch download)
```

`HF_TOKEN` is **not** required for local public Small weights. Never expose tokens as `NEXT_PUBLIC_*`.

Depth sessions: after Analyze, the server keeps a temporary in-memory `session_id` (TTL, no JPEG on disk). Measure with `session_id` preferred.

---

## OpenCV responsibilities

- Decode / resize / denoise / contrast (CLAHE)
- Edge map for debugging overlays
- Depth colour visualisation
- Ground-plane estimation helpers (RANSAC on unprojected samples)
- Perspective helpers when useful

OpenCV does **not** invent plot area.

---

## Hugging Face model responsibilities

- Monocular depth estimation (relative by default)

The model must **not** return `"area = 180 m²"`. Deterministic Python converts depth + calibration → metres.

---

## Calibration (required for relative depth)

```text
known_length_m / observed_world_distance → scale
```

User picks two boundary point indices whose real-world separation is known (tape measure, marked wall, etc.).

**Mandatory rule:** relative depth + no calibration → **reject** (no fake metres).

---

## Quality labels

`HIGH` / `MEDIUM` / `LOW` from lighting + ground-plane inliers.  
**Not** invented accuracy percentages.

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/vision/depth/` | One-frame depth analysis |
| POST | `/api/vision/measure/` | Points + calibration → area |

Project fields: `measurement_type=ai_camera`, `measurement_quality`, `calibration_method`.

---

## Fallbacks

- Depth / plane failure → clear guidance + **Manual Measurement**
- WebXR unavailable → hide/disable AR; AI Camera + Manual remain

---

## Validation

`docs/AI_CAMERA_VALIDATION_GEOMETRY.json` — controlled **world-coordinate** shoelace cases (5×5 … 15×12, irregular).  
This proves the area engine, **not** camera accuracy. Do not claim a camera accuracy % without a measured phone experiment.

---

## Install (real depth)

```bash
cd backend
../.venv/bin/pip install -r requirements.txt
../.venv/bin/pip install torch transformers   # for real HF inference
VISION_MOCK=0 ../.venv/bin/python manage.py runserver
```

For tests / CI without downloads:

```bash
VISION_MOCK=1 ../.venv/bin/python manage.py test planning -v1
```
