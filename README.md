# Plotline — AI-Powered Web-Based Architectural Planning Assistant with AR Visualization

BS Computer Science Final Year Project. Browser-only (no native app). Primary demo target: **Android Chrome over HTTPS**.

**Full documentation:** see [`docs/README.md`](docs/README.md).  
**Start here for viva:** [`docs/SYSTEM_WORKING_GUIDE.md`](docs/SYSTEM_WORKING_GUIDE.md) — AR area math, unit conversion, test data, and every feature explained.

## What it does

1. Open the site on a phone and grant camera permission.
2. Tap plot corners on the live camera feed (WebXR hit-testing).
3. Convert the measured area to **Marla / Kanal / Acre** (Pakistan units).
4. Recommend a house from a catalog with a **rule-based lookup** (not ML).
5. Place a true-to-scale `.glb` on the real ground and walk around it.
6. Save the project and generate an **LLM-narrated report** + Q&A.

Unsupported browsers (typical iOS Safari) get a **manual rectangle form + OrbitControls 3D viewer**. No computer vision / obstacle detection — that is out of scope.

## Architecture (viva map)

| Module | Where | What to say |
|---|---|---|
| AR interface | `frontend/components/ar/` | WebXR via `@react-three/xr` v6 `createXRStore` + `store.enterAR()` + `<XR>` |
| Measurement | `frontend/lib/geometry/area.ts` | Hit points → XZ shoelace / rectangle area in m² |
| Units | `frontend/lib/units/land.ts` and `backend/planning/units.py` | 1 Marla = 25.29285264 m², 1 Kanal = 20 Marla, 1 Acre = 160 Marla |
| Recommendation | `backend/planning/recommendation.py` | Inclusive min/max range match on `HouseDesign` |
| Local RAG consultant | `backend/planning/services/local_rag.py` | TF–IDF retrieve + grounded answer (works offline) |
| Optional HF polish | `backend/planning/services/huggingface_service.py` | InferenceClient rewrite using facts + RAG passages |
| Persistence | Django + SQLite | `User`, `Project`, `HouseDesign`, `Report` |

AI is **practical AI**: rule-based catalog match + **local RAG** over project JSON and a built-in knowledge corpus. Hugging Face is optional phrasing polish. Nothing is trained in this repo.

## Consultant / Local RAG (default)

Ask-the-consultant always answers via local RAG — no token required. See [`docs/LOCAL_RAG.md`](docs/LOCAL_RAG.md).

## Optional Hugging Face polish

HF can rephrase the same grounded answer when a token works. The app does **not** depend on HF for Q&A.

### 1. Create an account and token

1. Sign up: [https://huggingface.co/join](https://huggingface.co/join)
2. Create a token: [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
3. Create a **fine-grained** or **read** token that is allowed to **make calls to Inference Providers**.
4. Copy the token (`hf_…`).

### 2. Pick a model

In `backend/.env`:

```bash
HF_TOKEN=hf_your_real_token
HF_MODEL=Qwen/Qwen2.5-72B-Instruct
HF_PROVIDER=auto
```

Or Llama (you **must** open the model page while logged in and accept Meta’s license):

```bash
HF_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
```

### 3. How answers are built

1. Local RAG retrieves knowledge chunks + project facts and synthesizes an answer.
2. If HF is configured, that answer’s context is sent for optional polish.
3. If HF fails, the local RAG answer is returned (source: `local_rag`).

Camera frames are never sent.

### 4. Billing note

Hugging Face routes instruct models through **Inference Providers**. Free quota may be limited. Local RAG still demos without it.

```bash
curl http://127.0.0.1:8000/api/health/
# { "ok": true, "llm_configured": true|false, "llm_model": "..." }
```

## Run locally

You need **two terminals**.

### Backend

```bash
cd /Users/muhammadzayanali/Developer/fyp
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then paste HF_TOKEN
cd backend
python manage.py migrate
python manage.py seed_houses
python manage.py runserver 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js proxies `/api/*` and `/media/*` to Django on port 8000.

Default demo user: register at `/register`.

### HTTPS on a real Android phone (WebXR)

WebXR **will not** start on `http://192.168.x.x`.

```bash
cd frontend
npm run dev:https
```

On the phone (same Wi-Fi), open `https://YOUR_LAN_IP:3000`. Accept the certificate warning, then **Enter AR** in Chrome.

If the self-signed cert blocks WebXR, use ngrok instead:

```bash
npm run dev          # terminal 1
ngrok http 3000      # terminal 2 — open the https URL on the phone
```

Requirements on the device: **Android Chrome**, **Google Play Services for AR (ARCore)**.

Put your LAN IP in `frontend/next.config.ts` → `allowedDevOrigins` if hot reload is blocked.

## Placeholder 3D models

Massing models (metres, origin on the ground) live in `frontend/public/models/`. Regenerate:

```bash
python3 scripts/generate_placeholder_houses.py
```

Swap files later; keep the same names or update `glb_url` in Django admin / `seed_houses`.

Catalog ranges:

| House | Plot range | Programme |
|---|---|---|
| Compact Cottage | 50–140 m² (~2–5.5 Marla) | 1 floor, 2 bed, no parking |
| Modern Family Home | 140–280 m² (~5.5–11 Marla) | 2 floors, 3 bed, parking |
| Italian Villa | 280–560 m² (~11–22 Marla) | 2 floors, 5 bed, parking |

## REST API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health/` | no |
| POST | `/api/auth/register/` | no |
| POST | `/api/auth/login/` | no |
| GET | `/api/houses/` | no |
| POST | `/api/recommend/` `{ "land_size_sqm": 220 }` | no |
| GET/POST | `/api/projects/` | token |
| GET | `/api/projects/:id/` | token |
| POST/GET | `/api/projects/:id/report/` | token |
| POST | `/api/projects/:id/ask/` `{ "question": "..." }` | token |
| GET | `/api/reports/:id/` | token |

Header: `Authorization: Token <token>`.

## Out of scope (v1)

Camera-based scene understanding, obstacle detection, VLM / vision models, custom-trained recommenders, iOS Safari WebXR (use the fallback viewer).
