# Demo readiness

12 Nov 2026. Desktop numbers are from Chrome on this Mac (AMD Radeon Pro 560X), viewport 1440×900, device pixel ratio capped at 1.5 (buffer 2160×1350). No phone was in the room. Feature work stops here. What follows is the measured result, the corrected phone setup, and the proof that still has to be collected on real devices.

The on-screen label stays **Generated massing model**. Catalogue prices are assumptions, not a bill of quantities.

## Correction: a phone needs HTTPS for the camera

An earlier note said a phone could open `http://<laptop-ip>:3000` and that only WebXR needed HTTPS. That is wrong.

On a phone, a LAN `http://` address is not a secure context. The browser will not start:

- the camera, so AI Camera measurement fails
- `deviceorientation`, so Camera preview cannot ask for motion or use tap-to-place
- WebXR, so “View in AR” fails

The planner can still be clicked through on the laptop over HTTP. The phone demo cannot.

Phone demo, from the repo root:

```bash
./scripts/demo_up.sh
```

That is `next build` and `next start`, not the dev server, so there is no Next dev indicator. The script:

1. Starts Django on `0.0.0.0:8000` with `VISION_MOCK` unset.
2. Builds Next with `NEXT_PUBLIC_API_ORIGIN` empty and `DJANGO_ORIGIN=http://127.0.0.1:8000`, so `/api` and `/media` stay on the laptop instead of the Netlify tunnel.
3. Serves that build on `127.0.0.1:3010`.
4. Serves a local HTTPS proxy on `0.0.0.0:3443` and prints `https://<lan-ip>:3443` plus the health JSON.

On the phone, open that URL and accept the certificate warning. The certificate is self-signed and includes that day’s LAN address. Camera, motion sensors, and WebXR need this `https://` page. A LAN `http://` address is not a secure context. Then open `?debug=1`. The overlay line `WebXR immersive-ar` is the record for that phone. Write down the value it prints. Do not fill it in from the phone’s brand.

Read the IP that day. On 12 Nov 2026 it was `192.168.2.104`. An earlier session on this network saw `192.168.2.103`. If port 8000 is already taken, the script stops. If the Mac firewall or the venue Wi-Fi blocks device-to-device traffic, join the phone’s hotspot from the laptop and run the script again so it prints the new address.

`npm run dev:https` remains the dev-server shortcut. The phone demo is the production script above.

Checked from this laptop on 12 Nov 2026, without a phone. `next build` succeeded with `/api` and `/media` rewrites aimed at `http://127.0.0.1:8000`, and the client bundle did not contain the tunnel hostname. `https://127.0.0.1:3443/api/health/` and `https://192.168.2.104:3443/api/health/` returned 200 through the proxy (`curl -k`). Without `-k`, curl refused the self-signed certificate. `/media/does-not-exist.png` and `/api/media-proxy/does-not-exist.png` returned 404 from the local Django, not from the tunnel. Port 8000 was already a Django process started with `VISION_MOCK=1`, so that process was left running and `./scripts/demo_up.sh` exited instead of starting a second one. A fresh process with `VISION_MOCK` unset reads `VISION_MOCK False`. No phone opened the URL, so the camera, motion sensors, and WebXR were not exercised.

Backup if the room network fails: a recorded video, labelled on the slide as a recording, played from the laptop. Do not present the recording as a live session.

## Tunnel (Netlify → laptop Django)

This is the only place that names the tunnel.

The current host, written in `netlify.toml` and `frontend/.env.production`, is the Cloudflare quick tunnel:

`https://inbox-sbjct-dominant-dating.trycloudflare.com`

`DJANGO_ALLOWED_HOSTS` in `backend/.env` and `backend/.env.example` includes that hostname. The old localtunnel name `late-zebras-end.loca.lt` is not current, and `.loca.lt` is not in `DJANGO_ALLOWED_HOSTS`.

On 12 Nov 2026 that Cloudflare hostname did not resolve (`curl` exit 6). It is still the host in the files. A quick tunnel dies when `cloudflared` stops, and the next run gets a new name. Do not type a replacement until `cloudflared` prints one. Do not switch the files back to localtunnel.

`CORS_ALLOWED_ORIGINS` is unset. The Netlify site name is not in the repo, so none was invented. With `DJANGO_DEBUG=true`, CORS allows every origin. With `DJANGO_DEBUG=false`, set `CORS_ALLOWED_ORIGINS` to the real Netlify origin before a public demo.

`NEXT_PUBLIC_API_ORIGIN` stays unset for the same-Wi-Fi demo above, so the phone calls `/api` on the laptop and Next proxies it to Django. The tunnel origin is only for the Netlify build.

## Desktop result (measured)

### Draw calls after merging static meshes by material

Settled sample, after a 4 second wait. Day and evening draw counts matched. Median frame 16.7 ms (60 fps). Toggling Evening moved one frame by 17 ms.

| House | Draws | Triangles |
|---|---:|---:|
| Italian Family Villa, before the merge | 141 | 2194 |
| Italian Family Villa, after | 12 | 2194 |
| Cottage Compact | 13 | 1090 |
| Modern Family | 24 | 2420 |
| Contemporary Family | 25 | 2440 |

All four are under the 80-draw target. They are not the same count: Modern and Contemporary keep more materials (glazing, door, trim), so they draw more than Italian and Cottage. Triangle counts did not drop, which is the check that the merge did not throw geometry away.

Evening window glow is still on the glass after the merge. Modern Family and Cottage Compact match the pre-merge evening shots (warm panes; the cottage porch light is still lit). Contemporary Family shows the same warm panes. Shots:

- `docs/qa/massing/draws-italian-family-day-1440x900.png`
- `docs/qa/massing/draws-italian-family-evening-1440x900.png`
- `docs/qa/massing/draws-modern-family-evening-1440x900.png`
- `docs/qa/massing/draws-cottage-compact-evening-1440x900.png`
- `docs/qa/massing/draws-contemporary-family-evening-1440x900.png`

Pre-merge evening references: `docs/qa/massing/modern-family-evening-1440x900.png`, `docs/qa/massing/cottage-compact-evening-1440x900.png`.

### Texture memory

Uncompressed RGBA8 plus a full mip chain, 18 maps:

- 1024 px tier: **96 MB**
- 512 px tier: **24 MB**
- Phone budget: **about 40 MB**, so phones request the 512 px files
- Desktop keeps 1K

Live unique textures on this desktop (shared maps, so below the 96 MB unique-file estimate): Italian Family **49.8 MB**, Modern and Contemporary about **64.8 MB**, Cottage about **65.4 MB**. Tier reported: `webp-1k`.

The canvas textures still paint the first frame. If the frame rate stays under 30, the viewer steps the pixel ratio down and then puts the canvas maps back.

### Dev server (not the production build)

On Italian Family with `?debug=1`, the overlay’s 5 second window read about 57 fps average and a **minimum of 4 fps**. The settled 2 second sample, taken after the first frames, was 60 fps with a 16.7 ms median. The dip is one hitch, most likely the texture upload or the first shader compile. The other three styles, sampled after 4 seconds, stayed at 60 fps. On a phone that hitch can last longer. In every pasted phone report, read the **min** as well as the average.

### Production build (`next build`, then `next start`)

Measured 12 Nov 2026 on this Mac, Chrome, Italian Family Villa, viewport 1440×900, `deviceScaleFactor` 2. The app cap is still 1.5, so the buffer was 2160×1350. Port 3000 was already the dev server, so this run was `next start -H 127.0.0.1 -p 3010`.

| | Dev server | Production |
|---|---:|---:|
| Median frame | 16.7 ms | **16.7 ms** |
| Draws | 12 | **12** |
| Triangles | 2194 | **2194** |
| Overlay average, last 5 s | 57 | **59** |
| Overlay minimum, last 5 s | 4 | **7** |
| Texture tier | webp-1k | **webp-1k** |
| Live texture MB | 49.8 | **49.8** |

The production 5 second minimum was **7 fps**. A following 2 second window still had a 16.7 ms median and 12 draws; its average was 55 fps because that window included a slow frame. The minimum is one hitch, not the settled rate. A phone can hold that hitch longer.

### Diagnostics overlay

`?debug=1` shows fps average and minimum over 5 seconds, device pixel ratio, draw calls, triangles, textures, geometries, texture tier, live texture MB, the 96 MB and 24 MB estimates, WebXR immersive-ar, the camera track’s `facingMode`, whether `deviceorientation` is firing, and a short user-agent. **Copy report** wrote that block to the clipboard in desktop Chrome. On this machine the report said WebXR immersive-ar false, facingMode not reported, and deviceorientation not firing.

## Proof still to collect

These rows are blank on purpose. Fill them from the phones. Do not type a guess.

### 1. Phone reports

On each phone open `https://<lan-ip>:3443/?debug=1`, walk the real flow, tap **Copy report**, and paste the text under the matching heading.

Phones: one Android with ARCore, one Android without ARCore, one iPhone.

For each phone write:

- Does the camera open?
- Does AI Camera measurement return an area?
- Does Camera preview ask for motion permission, and does tap-to-place put the house down?
- On the ARCore phone only: does “View in AR” place the house and keep it locked while you walk?
- fps average, fps minimum, texture tier, texture MB, from the copied report.

| Check | Android + ARCore | Android, no ARCore | iPhone |
|---|---|---|---|
| Camera opens | | | |
| AI Camera returns an area | | | |
| Motion permission, tap-to-place | | | |
| View in AR, stays locked while walking | | | |
| fps avg / min | | | |
| texture tier / MB | | | |
| Pasted report | | | |

For each phone, copy the overlay line `WebXR immersive-ar`. That true or false is the record for the browser you actually opened. Camera preview is the path when the overlay says false.

### 2. Tape-measure trials

Mark one rectangle on the ground. Measure its sides with a tape and compute the true area. On two phones, run AI Camera about 10 times each against that same rectangle.

Use the real depth model. Start Django **without** `VISION_MOCK`. `VISION_MOCK=1` returns a synthetic depth map and must not be the source of these rows. The model named in health is `depth-anything/Depth-Anything-V2-Small-hf`.

Log every trial at `/measure-log`. The page starts empty and writes a row only when you submit one. Download `ai-camera-trials.csv` from that page. Columns: time, true area m², measured area m², error percent, device, notes. Do not add rows for trials you did not run.

### 3. Demo day

Before demo day:

- Stop any old Django on port 8000.
- Run `./scripts/demo_up.sh`.
- Confirm `vision_mock=False` in the log.
- Warm up one real Analyze Scene.
- Test once offline with `HF_HUB_OFFLINE=1`.

Main plan: the HTTPS laptop-and-phone setup above, IP checked that morning. Phone reports use `https://<lan-ip>:3443/?debug=1`.

Backup: a clearly labelled recording. Say “this is a recording” on the slide and out loud.

### 4. Slides and viva

Send the filled phone table and the CSV when they exist. Until then the slides can use only the desktop table in this file, with a limitations line that the handset rows are not in yet.

Short answers, matched to what the software actually does:

**Where is the AI?** The consultant is local retrieval over the stored project facts and a small knowledge set (`local_rag` and `planning/knowledge/corpus.py`). It writes the answer from those facts. The language model only rewords some answers. It is skipped for fee, authority, and build answers (`answer_question` returns the local text for those intents and does not call the model). On the answers it does reword, `validate_ai_text` drops the rewrite when the numbers are not the stored ones, and the screen keeps the local answer. The model never changes the numbers. Separately, AI Camera sends one frame to a depth model (`depth-anything/Depth-Anything-V2-Small-hf`); the area still comes from the existing geometry code and a length the user supplies. The house on screen is a generated massing model.

**Why rule-based recommendation?** The recommender picks from the fifteen seeded houses by plot fit. When two houses are equally close it prefers lower site coverage, then lower catalogue price, and it can say the other one also fits. The rule is inspectable in a viva. It is not a learned ranker, and the prices are catalogue assumptions, not a contractor quote.

**How accurate is measurement?** The product copy says the numbers are approximate planning estimates, not a survey. There is no tape-measure error figure yet. The number to quote is the one from `/measure-log` after the trials above. Until that CSV exists, the honest answer is that accuracy has not been measured on the ground.

**Why a fallback mode?** Immersive AR needs a secure context and a browser whose overlay reports `WebXR immersive-ar true`. Use the value from the phone you tested. When that line is false, Camera preview places the same 1:1 massing model on the rear camera when motion is available, with tap-to-place. Manual length and width remain the path when the camera cannot be used. The fallback is so a demo still shows the house and the plan when immersive AR is absent on that phone.

## Not claimed

- No phone fps, no phone texture MB, no tap-to-place on a real gyro, no ARCore walk-through.
- No tape-measure error.
- No hotspot session, and `npm run dev:https` was not started in this session.
- The public tunnel hostname `inbox-sbjct-dominant-dating.trycloudflare.com` did not resolve on 12 Nov 2026. The Netlify site name is not in the repo, so `CORS_ALLOWED_ORIGINS` was left unset.
