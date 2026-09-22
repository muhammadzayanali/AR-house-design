# API Reference

Base URL (via Next proxy): `/api/`  
Auth header: `Authorization: Token <token>`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health/` | no | `{ ok, llm_configured, llm_model }` |
| POST | `/auth/register/` | no | `{ username, password, email? }` → `{ token, user }` |
| POST | `/auth/login/` | no | `{ username, password }` → `{ token, user }` |
| POST | `/auth/logout/` | yes | 204 |
| GET | `/auth/me/` | yes | current user |
| GET | `/houses/` | no | active HouseDesign list |
| GET | `/houses/<id>/` | no | detail |
| POST | `/recommend/` | no | `{ land_size_sqm }` → house + reason + land_units |
| GET | `/projects/` | yes | current user's projects |
| POST | `/projects/` | yes | JSON or multipart (screenshot) |
| GET | `/projects/<id>/` | yes | owner only (404 otherwise) |
| PATCH/PUT | `/projects/<id>/` | yes | update |
| DELETE | `/projects/<id>/` | yes | destroy |
| GET/POST | `/projects/<id>/report/` | yes | fetch / generate narration (`source`: local_rag \| huggingface) |
| POST | `/projects/<id>/ask/` | yes | `{ question }` → `{ answer, source, intent, passages, warning }` |
| GET | `/reports/<id>/` | yes | owner only |

## Project create fields

- `land_size_sqm` (required, > 0)
- `measurement_type`: `ar` \| `manual`
- `plot_length_m`, `plot_width_m` (manual)
- `plot_points`: `[{x,y,z}, ...]`
- `selected_house_id`
- `recommendation_reason`
- `name`
- `screenshot` (optional file)

## Errors

- 400 validation
- 401 unauthenticated
- 404 not found / wrong owner
- 503 empty house catalog
