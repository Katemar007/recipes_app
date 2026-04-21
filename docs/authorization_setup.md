Here’s a concise picture of where your app stands and what “full-scale” user auth usually means for this stack.

What you have today
No per-user authentication. Recipes and shopping lists use a fixed string user id (demo-user) in the backend models and services; the API does not verify who is calling it.
Optional HTTP Basic (src/api/basicAuth.ts + apiFetch) is only for gatekeeping the whole API (e.g. Caddy). Everyone shares the same username/password; it does not identify individual users.
Your Postgres db/schema.sql already anticipates real users: a users table keyed by Cognito sub, and recipes.user_id as a foreign key. The running FastAPI app uses SQLite and SQLAlchemy models where user_id is a string defaulting to demo-user, not that Postgres design.
So “full scale” means introducing real identity, then enforcing it on every mutating and sensitive read.

What you need to implement (layers)
1. Pick an identity provider (IdP)
Examples: AWS Cognito (matches your schema comment), Auth0, Clerk, Supabase Auth, Firebase Auth. You need:

Sign-up / sign-in (email-password, magic link, and/or OAuth).
JWT access tokens (and usually refresh tokens) the client can send to your API.
Stable subject claim (sub) to map to your users.id (or store cognito_sub / external_sub as you already sketched).
2. Mobile app (Expo): authentication UX and token handling
Add sign-in / sign-out screens and session state (context or small store).
Store tokens with expo-secure-store (not AsyncStorage alone for refresh tokens).
On each API request, send Authorization: Bearer <access_token> from your IdP. You’ll need to decide how this coexists with Basic (e.g. Basic only in production behind a proxy, Bearer for user identity—or drop Basic if not needed).
Images and static URLs (RecipeRemoteImage already special-cases auth headers): anything loaded outside apiFetch must also get the Bearer header where required.
3. Backend (FastAPI): verify tokens and resolve the user
Add a dependency (e.g. get_current_user) that:
Reads Authorization: Bearer …
Validates the JWT (signature, issuer, audience, expiry) using the IdP’s JWKS or shared secret (depends on provider).
Extracts sub (and optionally email).
Provision users: on first valid token, upsert a row in users keyed by sub, then use your internal user_id everywhere.
Replace all uses of DEMO_USER / default demo-user in recipe and shopping services with the authenticated user’s id from that dependency.
Return 401 if missing/invalid token; 403 if the user is known but not allowed for a specific action (if you add roles later).
4. Authorization (not just “logged in”)
Object-level checks: every GET/PATCH/DELETE for a recipe (and shopping state) must ensure resource.user_id == current_user.id (or equivalent). Listing should filter by user_id.
Roles (optional): if you need admins or shared cookbooks, add roles or membership tables and check them in dependencies or service layer.
5. Database alignment
Local dev: either add a users table to SQLite and migrate user_id to an integer FK (like Postgres), or keep string sub as user_id for a while (works but is weaker for constraints).
Production: move to the Postgres schema you already have (or evolve it) so foreign keys and cascades match real multi-tenant data.
6. Operations and security
HTTPS only in production; lock CORS to real app origins (you already have CORS_ORIGINS).
Rotate secrets; short-lived access tokens; refresh flow on the client.
Rate limiting and basic abuse protection on auth endpoints (often partly handled by the IdP).
7. Migration
Decide what happens to existing demo-user rows: assign to a test account, or one-time migration to the first real user—explicit script is safer than implicit behavior.
Summary
Full-scale authorization here means: IdP + JWT validation in FastAPI + user rows + every route scoped by user_id + secure token storage and Bearer headers in Expo, and aligning your SQLite dev model with the Postgres + users + cognito_sub direction you already documented in db/schema.sql.

If you tell me which IdP you prefer (e.g. Cognito vs Clerk vs Supabase), I can outline the exact FastAPI dependency shape and the minimal schema changes for this repo’s current SQLite layout.

