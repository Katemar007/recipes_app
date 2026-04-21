# Meal Planner Deployment Plan

## Goal

Deploy `meal-planner` so it works:

- on Android phone (installed app)
- in browser (public URL)
- from anywhere (public HTTPS API + hosted web app)

Keep monthly cost low for up to 10 users.

## Chosen Architecture (Nearest Future)

Low-cost AWS-first plan:

1. One small AWS server (Lightsail or EC2) runs:
   - FastAPI backend
   - local Postgres (same server, not RDS for now)
2. AWS S3 stores recipe images.
3. API exposed via domain and HTTPS (`api.<your-domain>`).
4. Web app built from Expo and hosted publicly.
5. Android app built with EAS and configured to hit production API.

## Budget Target

- Target monthly total: **$8-$18**
- Keep hard budget alert at: **$20/month**

Expected components:

- Server: ~$5-$12
- S3 images + storage requests: ~$0-$3
- Domain: yearly renewal (small monthly equivalent)

## Non-Goals (for now)

- No RDS yet (to avoid high fixed cost).
- No Kubernetes/ECS/App Runner initially.
- No complex multi-environment infra.

## Production Rules

- Postgres must **not** be public.
- Only API is publicly accessible over HTTPS.
- Store images in S3 and keep image URL in DB (`recipes.image_url`).
- Add basic backups before onboarding real usage.

## Phase Plan

## Phase 1 - Infrastructure baseline

- Create server (Lightsail or EC2 small instance).
- Configure firewall:
  - allow `80` and `443` to world
  - allow `22` only from your IP
  - deny everything else
- Install Docker + Docker Compose (or native runtime + systemd).
- Set up domain DNS for API subdomain.

## Phase 2 - Backend + DB on same server

- Deploy FastAPI backend from `backend/`.
- Run Postgres locally on server.
- Apply DB schema from `db/schema.sql`.
- Set env vars:
  - `DATABASE_URL`
  - `CORS_ORIGINS`
  - app secrets
- Put reverse proxy (Caddy/Nginx) in front with Let's Encrypt TLS.

## Phase 3 - Images

- Create private/public-read strategy for S3 bucket (prefer private + signed upload flow).
- Backend handles upload URL generation or upload endpoint.
- Save resulting URL in `recipes.image_url`.

## Phase 4 - Frontend web + Android

- Build web with Expo export and host publicly.
- Set `EXPO_PUBLIC_API_URL` to production API URL.
- Ensure CORS includes web origin.
- Build Android app with EAS (internal distribution first).

## Phase 5 - Safety + operations

- Daily automated Postgres backup.
- Weekly restore test (lightweight smoke restore).
- Log rotation and disk usage alerting.
- Cost alarms in AWS billing.

## Immediate Next Tasks

1. Choose compute option: Lightsail or EC2.
2. Buy/confirm domain for API subdomain.
3. Decide deployment mode:
   - Docker Compose (recommended for simplicity)
   - native services
4. Prepare production `.env` values.
5. Deploy backend + Postgres.

## Open Decisions

- Lightsail vs EC2
- Public web host:
  - same server via reverse proxy
  - separate static host
- Image upload flow:
  - direct-to-S3 presigned URLs
  - backend-proxy upload

## Resume Prompt (use this later)

When returning after a break, paste:

`Continue from docs/deployment-plan.md and start with Immediate Next Tasks.`

