# AR Manual Testing Procedure (Physical Device)

```text
Physical WebXR testing is MANUAL.
Automated tests (Django / TypeScript / ESLint / build / Playwright) do NOT prove physical AR.
Playwright mocks / skips WebXR. Passing CI does not mean AR works on a phone.
```

---

## Requirements (environment)

| Requirement | Notes |
|-------------|--------|
| Android phone | **ARCore-capable** (see [ARCore device list](https://developers.google.com/ar/devices)) |
| Chrome | Latest stable (**not** Samsung Internet; **not** iPhone Chrome/Safari for immersive-ar) |
| Google Play Services for AR | Installed / up to date |
| HTTPS | Netlify HTTPS or `npm run dev:https` — plain `http://LAN` often cannot start WebXR |
| Backend running | Django `0.0.0.0:8000` (+ tunnel if Netlify → laptop API) |
| Frontend running | Netlify or Next `:3000` |
| Camera permission | Grant when prompted |

---

## Scale convention

```text
1 Three.js / WebXR world unit = 1 metre
```

**Do not add an AR scale slider.** True-scale visualization is intentional.

Italian Compact Villa footprint **10 m × 9 m** must appear roughly that size relative to the measured plot when placed.

```text
AR scale correctness ≠ survey-grade measurement accuracy
```

---

## Manual AR flow checklist

```text
Open application
→ Login/register
→ Open Measure/AR
→ Enter AR
→ Grant camera
→ Move phone
→ Ground reticle (gold ring) appears
→ Mark plot corners (3–8 points)
→ Finish measurement
→ Area / Marla displayed
→ Select style (e.g. Italian Villa)
→ Select compatible design (e.g. Italian Compact Villa)
→ Open 3D (same HouseRenderer)
→ Enter AR (if not already)
→ Place house
→ Walk around — verify ~true scale
→ Reset placement
→ Exit AR
```

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open HTTPS app in Android Chrome | Site loads |
| 2 | Login / register | Dashboard accessible |
| 3 | Open AR / Measure | Setup HUD visible |
| 4 | Tap **Enter AR** | Immersive session starts |
| 5 | Grant camera | Live camera feed |
| 6 | Move phone slowly | Gold reticle on ground |
| 7 | Mark corners (e.g. ~15×12 m if known) | Points accumulate |
| 8 | Finish measurement | Area ≈ expected m² / Marla |
| 9 | Choose style (Italian Villa) | Style cards (8 styles) |
| 10 | Select compatible design | Exact / closest fit + why-it-fits |
| 11 | View 3D / continue | Same house in Orbit viewer |
| 12 | Place house on plot | Model anchors on hit point |
| 13 | Walk around | Same design, ~true scale |
| 14 | Reset placement | Model clears; can place again |
| 15 | Exit AR | Returns to non-immersive UI |

### Fallback (unsupported / failed WebXR)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Laptop / iOS / non-ARCore phone | Clear AR unavailable or session-fail message |
| 2 | Manual L×W **15×12** | Area **180 m²** / **7.12 Marla** |
| 3 | Style → design → 3D | Full FYP path without WebXR |

---

## Record sheet

```text
Device: _______________
ARCore listed? Y/N
Chrome version: _______________
Date: _______________
HTTPS URL: _______________

Area expected: _______________
Area actual: _______________
Design: _______________
Scale looks correct? Y/N
Placement/reset works? Y/N
Notes: _______________

Physical WebXR result: PASS / FAIL / BLOCKED (device)
```

Until this sheet is filled on a real compatible Android device, release status remains:

```text
Physical WebXR: MANUAL — PENDING DEVICE VERIFICATION
```

---

## What this proves vs what it does not

| Proves | Does not prove |
|--------|----------------|
| WebXR session starts on **this** device | Survey-grade accuracy |
| Hit-test + placement UX | Bylaw / FAR / setback compliance |
| Same HouseRenderer as desktop 3D | Photoreal CGI quality |
| Approximate real-world scale | Automated CI coverage of AR |

---

## Phone AR still fails after Enter AR

`isSessionSupported` can say yes while `requestSession` still fails (missing ARCore, old Play Services, non‑certified device).

1. Install / update **Google Play Services for AR**  
2. Update **Chrome**  
3. Allow **Camera** (+ AR if shown) for the site  
4. Use **HTTPS**  
5. Hard refresh; retry in good light  

If it still fails, use **manual 15×12 → Continue** — valid full FYP demo path.
