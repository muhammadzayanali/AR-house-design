# Netlify frontend + local Django backend

## Goal

- **Frontend** → Netlify (`devel`)
- **Backend** → laptop Django + HTTPS tunnel
- **Secrets** stay local (`backend/.env`)

## Run stack (laptop)

```bash
# Terminal A — Django (you should see request logs here)
cd backend && ../.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal B — HTTPS tunnel
npx -y localtunnel --port 8000
# → https://something.loca.lt  (update netlify.toml if URL changes)
```

Set `NEXT_PUBLIC_API_ORIGIN` in `netlify.toml` / `frontend/.env.production` to that tunnel URL, push `devel`, redeploy.

Phone browser calls the tunnel **directly** (CORS allows `Bypass-Tunnel-Reminder`). Do **not** rely on Netlify rewriting `/api` to the tunnel — that caused 502/503.

## Reliable demo without Netlify

Same Wi‑Fi:

```text
http://192.168.2.105:3000
```

(Local Next rewrites `/api` → Django on the laptop.)

## Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | empty or `.next` |
