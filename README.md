# Meal Planner

Frontend: **Expo (React Native, Android + web)** with **React Query** for server state and **Zustand** for shopping state. 

Backend: **Python FastAPI** with **SQLAlchemy** and **SQLite** recipe storage (swap `DATABASE_URL` later for Postgres/RDS). UI includes top navigation (Home, Recipes, Planned, Shopping, Add new recipe, Settings.


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

**Note:** `web.output: "static"` is intentionally **not** set.

- Static SSR in dev often hits `Cannot find module 'react'` (especially if the project path contains **spaces**)
- For a static production build, set the public API URL and export (output goes to **`dist/`**, gitignored)

```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npx expo export --platform web
```

Upload the contents of `dist/` to your static host and ensure the server rewrites unknown paths to `index.html` for client-side routes.

VPS/Caddy/systemd notes for API + static app: **`deployment-plan.md`** (repo root).

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

# Next steps: possible enhancements

### AWS path

- **Containerize backend API** and deploy on **ECS Fargate** (recommended), or use **Lambda + API Gateway** if you want serverless request-based scaling.
- Move DB from SQLite to **Postgres on RDS** using `db/schema.sql` and set `DATABASE_URL` in runtime secrets.
- Serve web build (`dist/`) from **S3 + CloudFront** (or Amplify Hosting) on a dedicated frontend domain (for example, `app.example.com`).
- Put API behind a custom HTTPS domain (for example, `api.example.com`) with ACM certificates and strict CORS for frontend origin(s).
- Store secrets in **AWS Secrets Manager/SSM** (DB URL, auth creds, JWT settings), not in `.env` files on hosts.
- Add basic observability: CloudWatch logs/metrics, alarms (5xx, latency), and DB backups + automated restore checks.
- Optional auth hardening: validate **Cognito JWTs** in FastAPI middleware once user auth is enabled.

### VPS path (DigitalOcean) + separate domain on Cloudflare

- Provision a DigitalOcean Droplet (Ubuntu LTS), create a non-root deploy user, and install Docker (or Python + Node + Caddy + systemd).
- Run backend API behind **Caddy** (or Nginx) with TLS; expose only `443`/`80`, keep app process on localhost.
- Build/export web app (`npx expo export --platform web`) and host static files from Caddy/Nginx on a separate frontend domain.
- Use separate DNS records in Cloudflare, e.g. `app.example.com` (frontend) and `api.example.com` (backend), both proxied through Cloudflare.
- Configure Cloudflare SSL mode (**Full (strict)**), automatic HTTPS redirects, and optional WAF/rate-limiting for API routes.
- Set backend `CORS_ORIGINS` to only the frontend origin(s), and set `EXPO_PUBLIC_API_URL=https://api.example.com` for web/mobile builds.
- For persistence in production, run **managed Postgres** (DigitalOcean Managed DB or external) instead of SQLite on the Droplet filesystem.
- Add deployment safety: systemd restart policies (or Docker restart), health checks, nightly DB backups, and log rotation.


### Authorization implementation

- Use JWT-based auth: Managed IdP issues access tokens; client sends Authorization: Bearer <token> on every request.
- Validate tokens server-side: FastAPI checks signature, issuer, audience, and expiration before serving data.
- Map identity to app user: Use token sub to create/find local user record.
- Enforce ownership in queries: Every recipe/shopping query is scoped to the authenticated user.
- Add object-level authorization: GET/PATCH/DELETE on a resource must verify resource.user_id == current_user.id.
- Ship v1, then extend: Add roles/shared households/audit logs as phase-2 enhancements.

### AI for units conversion, deduping and parsing new recipes
- Build a single AI ingestion pipeline: feed URL -> scrape/extract recipe text -> AI parse to structured recipe JSON -> save recipe.
- Run AI normalization per ingredient: detect quantity/unit/item, standardize names, and store confidence + original text.
- Apply unit conversion to a canonical base (e.g., metric in g/ml) and generate user-facing US/metric display lines.
- Use AI-assisted dedupe with safety gates: semantic ingredient matching + deterministic checks (unit family, quantity tolerance) before merge.
- Keep human-safe fallbacks: low-confidence parse/convert/dedupe results are flagged for review instead of auto-merged.
- Track quality and cost metrics: parse success rate, bad merges, conversion errors, latency, and token spend per imported recipe.