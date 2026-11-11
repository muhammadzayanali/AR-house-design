# Netlify frontend + local Django backend

## Goal

- **Frontend** → Netlify (`devel`)
- **Backend** → laptop Django + HTTPS tunnel
- **Secrets** stay local (`backend/.env`)

## Run stack (laptop)

```bash
# Terminal A — Django (you should see request logs here)
cd backend && ../.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal B — HTTPS tunnel (fixed subdomain so Netlify keeps working after restarts)
npx -y localtunnel --port 8000 --subdomain late-zebras-end
# → https://late-zebras-end.loca.lt
```

Set `NEXT_PUBLIC_API_ORIGIN` / `DJANGO_ORIGIN` in `netlify.toml` and `frontend/.env.production` to that URL (already set for `late-zebras-end`). If the subdomain is taken, pick another and update both files, then push `devel` and redeploy.

Phone browser calls the tunnel **directly** for `/api` (CORS allows `Bypass-Tunnel-Reminder`). Do **not** rely on Netlify rewriting `/api` to the tunnel — that caused 502/503.

## Screenshots on Netlify

Project previews live on **laptop Django** (`backend/media/`). The dashboard uses same-origin `/api/media-proxy/...`, which fetches the tunnel with `Bypass-Tunnel-Reminder` (a plain `<img src="*.loca.lt">` hits the 511 reminder page and shows a broken image).

Also set `DJANGO_ORIGIN` to the same tunnel URL (used by the media proxy). Keep Django + localtunnel running while viewing Netlify projects.


## Reliable demo without Netlify

Leave `NEXT_PUBLIC_API_ORIGIN` unset so the browser calls same-origin `/api`. Next proxies that to Django (`DJANGO_ORIGIN`, default `http://127.0.0.1:8000`).

```bash
# Terminal A
cd backend && ../.venv/bin/python manage.py runserver 0.0.0.0:8000

# Terminal B — planner on the LAN. WebXR needs the https script.
cd frontend && npm run dev
# or: npm run dev:https
```

Same Wi-Fi: `http://<this-laptop-ip>:3000`. On 12 Nov 2026 this laptop was `192.168.2.104`, and `http://192.168.2.104:3000/api/health/` returned 200 through the Next proxy. Phone hotspot: join the hotspot from the laptop, then open the laptop’s address on that network. That variant was not run. `npm run dev:https` is the script that can start the camera and WebXR; it was not started here because port 3000 was already the HTTP dev server.

## Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | empty or `.next` |
