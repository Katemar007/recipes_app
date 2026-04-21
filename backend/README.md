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

## Key endpoints (portfolio)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/recipes/scale` | Scale ingredients + nutrition (send recipe snapshot) |
| POST | `/units/convert` | Ingredient-aware unit conversion |
| POST | `/shopping-lists/dedupe` | Merge duplicate shopping lines |

RDS wiring: replace in-memory logic with SQLAlchemy queries using `../db/schema.sql`.
