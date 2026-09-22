# Final Release Verification Log

Verified: 2026-09-22

## Commands run

```bash
cd backend && ../.venv/bin/python manage.py test planning -v1   # 41 OK
cd frontend && npx tsc --noEmit                                 # PASS
cd frontend && npm run lint                                     # PASS (after Link/AuthProvider fixes)
cd frontend && npm run build                                    # PASS
cd frontend && API_BASE=http://127.0.0.1:8000 npx playwright test  # 4 OK
```

## Fixes applied during verification (real issues only)

1. ESLint: `<a href="/">` → `<Link href="/">` in `ARExperience.tsx`
2. ESLint: AuthProvider ready-state init without sync setState-in-effect when no token
3. AI validator: reject invented footprint numbers (e.g. 145 vs fact 90)
4. Restored `test_accepts_grounded_text` + added `test_rejects_footprint_mismatch`

## Validator behaviour (manual script)

| Case | Result |
|------|--------|
| Valid grounded text | accept |
| "4 bedrooms" vs fact 3 | reject → local RAG |
| "5-foot setback" | reject → local RAG |
| "footprint … 145" | reject → local RAG |

## Known accepted limitations

- Modern / Contemporary / Luxury share some procedural massing
- No AR scale slider (1 unit = 1 m intentional)
- Physical WebXR is manual (`docs/AR_TESTING.md`)
- Procedural ≠ photoreal CGI
