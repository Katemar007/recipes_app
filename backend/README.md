# Meal Planner API (FastAPI)

Use **Python 3.11 or 3.12** (recommended). Python 3.14+ may lack prebuilt wheels for some dependencies.

## Setup

```bash
cd backend
python3.12 -m venv .venv   # or python3.11
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

SQLite data files live under **`data/`** (gitignored): `meal_planner.db` plus `uploads/` for recipe images.

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- OpenAPI: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Recipes: **GET/POST `/recipes`**, **GET/PATCH `/recipes/{id}`** (portfolio demo; replace SQLite with RDS using `../db/schema.sql` when ready).

## CORS

Set `CORS_ORIGINS` in `.env` (comma-separated). Defaults include Expo web dev ports.

## Internal REST API

All routes are defined in `app/main.py`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Redirects to interactive API docs (`/docs`) for browser visits |
| GET | `/health` | Service health check |
| GET | `/categories` | List recipe categories catalog |
| GET | `/ingredient-sections` | List shared ingredient section catalog used by recipe editor |
| GET | `/recipes` | List recipes |
| POST | `/recipes` | Create a new recipe |
| GET | `/recipes/{recipe_id}` | Fetch one recipe by id |
| PUT | `/recipes/{recipe_id}` | Replace a recipe (full update) |
| PATCH | `/recipes/{recipe_id}` | Partially update a recipe (currently status/notes/category links) |
| POST | `/units/convert` | Convert quantity between units (ingredient-aware conversion rules) |
| POST | `/shopping-lists/dedupe` | Merge duplicate shopping lines |
| POST | `/shopping-lists/generate` | Placeholder endpoint for generating a list from planned recipes |
| GET | `/shopping-lists/state` | Read current shopping state (active list + snapshots) |
| PUT | `/shopping-lists/state` | Replace current shopping state |

Static files:
- `GET /static/...` serves uploaded recipe images from `backend/data/uploads`.
