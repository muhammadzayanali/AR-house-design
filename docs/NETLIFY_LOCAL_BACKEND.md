# Netlify frontend + local Django backend

## Goal

- **Frontend** → Netlify (`devel` branch, base dir `frontend`)
- **Backend** → your laptop (`python manage.py runserver 0.0.0.0:8000`)
- **Secrets** (`backend/.env`, `HF_TOKEN`, `DJANGO_SECRET_KEY`) stay **only on your machine**

Netlify **cannot** reach `127.0.0.1` on your laptop. The browser must call Django on your **LAN IP**.

## 1. Keep secrets local

Already gitignored:

- `backend/.env`
- `frontend/.env.local`
- `.env*`

Only commit `backend/.env.example` / `frontend/.env.example` (no real tokens).

## 2. Run Django on LAN

```bash
cd backend
../.venv/bin/python manage.py runserver 0.0.0.0:8000
```

Find your Mac IP (e.g. `192.168.1.140`).

## 3. Netlify + local Django (HTTPS tunnel required)

Browsers **block** Netlify HTTPS → `http://192.168.x.x:8000` (mixed content → “Failed to fetch”).

Use an HTTPS tunnel to Django:

```bash
# Terminal A — Django
cd backend && ../.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal B — tunnel
npx -y localtunnel --port 8000
# → prints https://something.loca.lt
```

Put that URL in `netlify.toml` / `frontend/.env.production` as `NEXT_PUBLIC_API_ORIGIN`, push `devel`, redeploy Netlify.

**Quick phone demo without Netlify:** open `http://YOUR_LAN_IP:3000` (local Next) — no mixed content.

## 4. Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | **empty** or `.next` — **never** `frontend` |

If publish = base (`frontend`), `@netlify/plugin-nextjs` fails with:
`Your publish directory cannot be the same as the base directory`

## 5. Phone / demo

1. Phone and laptop on **same Wi‑Fi**
2. Open the Netlify HTTPS URL
3. API calls go to `http://YOUR_LAN_IP:8000`

If API fails: check firewall, Django running on `0.0.0.0:8000`, and IP matches `NEXT_PUBLIC_API_ORIGIN`.

## 6. Local full-stack (no Netlify)

Leave `NEXT_PUBLIC_API_ORIGIN` unset. Next rewrites `/api` → `http://127.0.0.1:8000`.
