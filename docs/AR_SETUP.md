# AR Setup (Android Chrome)

WebXR camera access requires a **secure context (HTTPS)**.

## 1. Start backend

```bash
cd backend
../.venv/bin/python manage.py runserver 8000
```

## 2. Start frontend with HTTPS

```bash
cd frontend
npm run dev:https
```

## 3. Phone (same Wi-Fi)

1. Find your laptop LAN IP (e.g. `192.168.x.x`).
2. Add it to `frontend/next.config.ts` → `allowedDevOrigins` if HMR is blocked.
3. Open `https://<LAN_IP>:3000` in **Android Chrome**.
4. Accept the development certificate warning if prompted.
5. Grant camera permission.
6. Tap **Enter AR** → wait for the gold reticle on the ground → **Mark corner** (3–8 points in order) → **Finish & recommend** → **Place house on plot** → walk around.

## Requirements

- Android device with **ARCore** (Google Play Services for AR)
- Chrome (not Samsung Internet / not iOS Safari for immersive AR)

## Fallback

If AR is unsupported, use **Length × Width** on the same page, then 3D OrbitControls viewer.

## Accuracy

Approximate planning only — not a professional survey. Large plots can accumulate tracking drift.
