# Netlify frontend + local Django backend

## Goal

- **Frontend** → Netlify (`devel` branch, base dir `frontend`)
- **Backend** → your laptop (`python manage.py runserver 0.0.0.0:8000`)
- **Secrets** (`backend/.env`, `HF_TOKEN`, `DJANGO_SECRET_KEY`) stay **only on your machine**

## How API calls work on Netlify

The phone browser calls **same-origin** `/api/...` on your Netlify site.
Next.js rewrites those requests **server-side** to your HTTPS tunnel (`DJANGO_ORIGIN`).

That avoids:

- mixed content (HTTPS page → `http://LAN`)
- localtunnel browser interstitial (`511 Tunnel website ahead`)
- CORS failures from `Bypass-Tunnel-Reminder`

## 1. Keep secrets local

Already gitignored: `backend/.env`, `frontend/.env.local`, `.env*`.

## 2. Run Django + tunnel

```bash
# Terminal A — Django
cd backend && ../.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal B — HTTPS tunnel
npx -y localtunnel --port 8000
# → prints https://something.loca.lt
```

Put that URL in `netlify.toml` / `frontend/.env.production` as **`DJANGO_ORIGIN`** (not `NEXT_PUBLIC_API_ORIGIN`), push `devel`, redeploy Netlify.

## 3. Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | **empty** or `.next` — **never** `frontend` |

## 4. Reliable phone demo (no Netlify)

Same Wi‑Fi as the laptop:

```text
http://YOUR_LAN_IP:3000
```

Local Next rewrites `/api` → `http://127.0.0.1:8000`. No tunnel needed.

## 5. If Android still says “Failed to reach the API”

1. Django + localtunnel still running on the laptop
2. Netlify redeployed after the `DJANGO_ORIGIN` change
3. Or skip Netlify and open `http://YOUR_LAN_IP:3000`
