# AR Manual Testing Procedure (Physical Device)

This is **manual** verification. It is **not** covered by Django unit tests or Playwright E2E.

Automated browser tests **mock / skip** WebXR. Passing CI does **not** prove AR works on a phone.

---

## Requirements

| Requirement | Notes |
|-------------|--------|
| Android phone | ARCore-capable device |
| Chrome | Latest stable (not Samsung Internet) |
| Google Play Services for AR | Installed / up to date |
| HTTPS | `npm run dev:https` or deployed HTTPS URL |
| Same Wi‑Fi | Phone ↔ laptop for LAN demo |
| Camera permission | Grant when prompted |
| Backend + frontend running | Django `:8000`, Next `:3000` |

---

## Scale convention

```text
1 Three.js / WebXR world unit = 1 metre
```

Italian Compact Villa footprint **10 m × 9 m** must appear roughly that size relative to the measured plot when placed.

---

## Test procedure

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `https://<LAN_IP>:3000` in Android Chrome | Site loads (cert warning OK for dev) |
| 2 | Login / register | Dashboard accessible |
| 3 | Open AR / Measure | Setup HUD visible |
| 4 | Tap **Enter AR** | Immersive session starts |
| 5 | Grant camera | Live camera feed |
| 6 | Move phone slowly | Gold reticle appears on ground |
| 7 | Mark 4 corners of a known rectangle (e.g. ~15×12 m if known) | Points accumulate |
| 8 | Finish measurement | Area ≈ expected m² / Marla |
| 9 | Choose style (e.g. Italian Villa) | Style cards |
| 10 | Select compatible design | Exact badge + match reason |
| 11 | View 3D / continue | Same house in Orbit viewer |
| 12 | Place house on plot | Model anchors on hit point |
| 13 | Walk around | Same design, ~true scale |
| 14 | Reset placement | Model clears; can place again |
| 15 | Exit AR | Returns to non-immersive UI |

### Fallback test (unsupported device)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open on laptop / iOS Safari | Clear “AR unavailable” message |
| 2 | Enter manual L×W (15×12) | Area 180 m² shown |
| 3 | Style → design → 3D | Works without WebXR |

---

## Record sheet

```text
Device: _______________
Chrome version: _______________
Date: _______________
HTTPS URL: _______________

Area expected: _______________
Area actual: _______________
Design: _______________
Scale looks correct? Y/N
Placement/reset works? Y/N
Notes: _______________
```

---

## What this proves vs what it does not

| Proves | Does not prove |
|--------|----------------|
| WebXR session starts on this device | Survey-grade accuracy |
| Hit-test + placement UX | Bylaw compliance |
| Same HouseRenderer as desktop 3D | Photoreal CGI quality |
| Approximate real-world scale | Automated CI coverage |
