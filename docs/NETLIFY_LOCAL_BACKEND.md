# Netlify frontend + local Django

The phone demo and the tunnel host are written once in [DEMO_READINESS.md](DEMO_READINESS.md).

## Netlify build settings

| Field | Value |
|-------|--------|
| Branch | `devel` |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | empty or `.next` |
