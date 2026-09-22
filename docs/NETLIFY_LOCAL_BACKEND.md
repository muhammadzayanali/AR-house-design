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

## 3. Netlify env (Site settings → Environment variables)

```text
NEXT_PUBLIC_API_ORIGIN=http://192.168.1.140:8000
```

Use your real LAN IP. Rebuild/redeploy after changing it.

Do **not** set `HF_TOKEN` on Netlify.

## 4. Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | *(empty / Next.js default)* |

## 5. Phone / demo

1. Phone and laptop on **same Wi‑Fi**
2. Open the Netlify HTTPS URL
3. API calls go to `http://YOUR_LAN_IP:8000`

If API fails: check firewall, Django running on `0.0.0.0:8000`, and IP matches `NEXT_PUBLIC_API_ORIGIN`.

## 6. Local full-stack (no Netlify)

Leave `NEXT_PUBLIC_API_ORIGIN` unset. Next rewrites `/api` → `http://127.0.0.1:8000`.
