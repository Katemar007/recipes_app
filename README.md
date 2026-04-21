# Meal Planner (portfolio)

Expo (Android + web): **top navigation** (Home, Recipes, Planned, Shopping, Add new recipe, Settings — similar in spirit to editorial recipe sites like [RECIPE30](https://recipe30.com/)), **Zustand** client state, plus a **FastAPI** backend with **SQLite** recipe storage (swap `DATABASE_URL` later for Postgres/RDS), scaling, unit conversion, and shopping-list dedupe.

## Prerequisites

- **Node.js LTS** — `node -v`, `npx -v`
- Optional: **Watchman** — `brew install watchman`
- Backend: **Python 3.11 or 3.12** — see `backend/README.md`

## Frontend setup

```bash
cd meal-planner
npm install
npx expo install --fix
```

Create `.env` in the project root (see `.env.example`) when the API is not the built-in default:

- **iOS simulator / web:** defaults to `http://localhost:8000` if unset.
- **Android emulator:** defaults to `http://10.0.2.2:8000` if unset (reaches the host machine).
- **Physical device:** set `EXPO_PUBLIC_API_URL` to `http://YOUR_LAN_IP:8000` or your public API URL (`https://api.example.com`).

If the API is behind HTTP Basic Auth (e.g. Caddy), set `EXPO_PUBLIC_API_BASIC_USER` and `EXPO_PUBLIC_API_BASIC_PASSWORD` to match the server.

## Run app

```bash
npx expo start
```

Press **w** (web), **Expo Go** on Android, or **a** (emulator).

**Note:** `web.output: "static"` is intentionally **not** set. Static SSR in dev often hits `Cannot find module 'react'` (especially if the project path contains **spaces**). For a static production build, set the public API URL and export (output goes to **`dist/`**, gitignored):

```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npx expo export --platform web
```

Upload the contents of `dist/` to your static host and ensure the server rewrites unknown paths to `index.html` for client-side routes. VPS/Caddy/systemd notes for API + static app: **`deployment-plan.md`** (repo root).

If the web page is **blank**, clear the Metro cache and reinstall deps (NativeWind **4.2.x** pulled in a Babel plugin that needs packages not compatible with Expo SDK 52):

```bash
rm -rf node_modules package-lock.json
npm install
npx expo install --fix
npx expo start --clear
```

This project pins **`nativewind` to `4.1.23`** for SDK 52 and uses **`overrides`** in `package.json` so every package resolves **`react-native-css-interop@0.1.22`** (newer `0.2.x` expects `react-native-worklets/plugin`, which does not match Expo SDK 52 / RN 0.76).

## Run API (recipes DB + “Scale (API)” + “Dedupe (API)”)

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Docs: http://localhost:8000/docs  
- Recipes persist to **`backend/data/meal_planner.db`** (created on first run) with demo seed rows. Uploaded images are stored under **`backend/data/uploads/`** and served at **`/static/uploads/...`**.
- On web, CORS allows default Expo dev ports; override with `CORS_ORIGINS` in `backend/.env` (see `backend/.env.example`). For production, set `CORS_ORIGINS` to your real web origin(s), e.g. `https://app.yourdomain.com` (comma-separated if you use `www` too).

## Project layout

| Path | Purpose |
|------|---------|
| `app/(drawer)/` | Main shell + **top nav** (`TopNavigationBar`): Home, Recipes, Planned, Shopping, Add new recipe, Settings |
| `app/(drawer)/recipe/[id].tsx` | Detail, move to planned, add to shopping, notes |
| `app/(drawer)/new-recipe.tsx` | Create recipe → **POST /recipes** (DB) |
| `src/store/` | Zustand (recipes hydrate from **GET /recipes** when API is up) |
| `src/api/` | `fetch` client + recipe CRUD + shopping dedupe / convert endpoints |
| `src/features/recipes/` | `RecipeCard`, `RecipeGrid`, image placeholder |
| `src/theme/` | Paper theme, tokens, screen style factories |
| `backend/app/` | FastAPI — **GET/POST/PATCH /recipes**, `/recipes/scale`, `/units/convert`, `/shopping-lists/dedupe` |
| `db/schema.sql` | Postgres schema for RDS (sections, normalization, shopping history) |

## Next steps (AWS)

- Deploy API (ECS Fargate / Lambda + API Gateway)
- **RDS** using `db/schema.sql`
- **Cognito** JWT validation in FastAPI middleware
