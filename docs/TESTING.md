# Testing

## Backend

```bash
cd backend
../.venv/bin/python manage.py check
../.venv/bin/python manage.py test planning -v 1
```

Coverage includes:

- Marla / Kanal / Acre conversion
- Rectangle / triangle / polygon area
- Recommendation ranges + inactive exclusion
- Register / ownership isolation / delete / create

## Frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Manual checks: see `FINAL_QA_CHECKLIST.md`.

## AR

Physical Android Chrome verification required — see `AR_SETUP.md`.
