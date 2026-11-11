#!/usr/bin/env bash
# Production phone demo: Django (no VISION_MOCK) + next build/start + local HTTPS.
# The phone opens the printed https:// URL and accepts the certificate warning.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTTP_PORT="${DEMO_HTTP_PORT:-3010}"
HTTPS_PORT="${DEMO_HTTPS_PORT:-3443}"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
CERT_DIR="$ROOT/scripts/.demo-certs"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

if [[ -z "$LAN_IP" ]]; then
  echo "No LAN address on en0 or en1. Join Wi-Fi or the phone hotspot, then run this again." >&2
  exit 1
fi

busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if busy 8000; then
  echo "Port 8000 is already in use. Stop that process first." >&2
  echo "This script starts Django itself so VISION_MOCK is unset." >&2
  exit 1
fi
if busy "$HTTP_PORT" || busy "$HTTPS_PORT"; then
  echo "Port $HTTP_PORT or $HTTPS_PORT is already in use." >&2
  exit 1
fi

mkdir -p "$CERT_DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days 30 -nodes \
  -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
  -subj "/CN=Plotline demo" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LAN_IP}" \
  >/dev/null 2>&1

cd "$ROOT/backend"
env -u VISION_MOCK ../.venv/bin/python manage.py runserver 0.0.0.0:8000 &
PIDS+=("$!")

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 2 http://127.0.0.1:8000/api/health/ >/dev/null; then
    break
  fi
  sleep 0.5
done

cd "$ROOT/frontend"
# Shell values win over frontend/.env.production, so this build stays on the laptop.
export NEXT_PUBLIC_API_ORIGIN=
export DJANGO_ORIGIN="http://127.0.0.1:8000"
npx next build
npx next start -H 127.0.0.1 -p "$HTTP_PORT" &
PIDS+=("$!")

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf --max-time 2 "http://127.0.0.1:${HTTP_PORT}/" >/dev/null; then
    break
  fi
  sleep 0.5
done

DEMO_HTTPS_PORT="$HTTPS_PORT" \
DEMO_HTTP_PORT="$HTTP_PORT" \
DEMO_TLS_KEY="$CERT_DIR/key.pem" \
DEMO_TLS_CERT="$CERT_DIR/cert.pem" \
node "$ROOT/scripts/https_proxy.mjs" &
PIDS+=("$!")

sleep 0.4
HEALTH="$(curl -kf --max-time 8 "https://127.0.0.1:${HTTPS_PORT}/api/health/")"
echo
echo "Phone URL: https://${LAN_IP}:${HTTPS_PORT}"
echo "Accept the certificate warning. Camera, motion, and WebXR need this https address."
echo "Health: ${HEALTH}"
echo "Overlay: https://${LAN_IP}:${HTTPS_PORT}/qa/massing?debug=1"
echo
wait
