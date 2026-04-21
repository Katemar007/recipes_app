4. Deploy the API on the server
Example layout as user deploy:

sudo mkdir -p /opt/meal-planner && sudo chown deploy:deploy /opt/meal-planner
cd /opt/meal-planner
git clone <YOUR_REPO_URL> .
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
Persist data:

mkdir -p data/uploads
Configure CORS and DB via environment (systemd below). At minimum:

CORS_ORIGINS=https://app.yourdomain.com
(comma-separate if you add www)
Run with Uvicorn bound to localhost only:

/opt/meal-planner/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
When that works, add a systemd unit so it survives reboots (e.g. /etc/systemd/system/meal-api.service):

WorkingDirectory=/opt/meal-planner/backend
Environment="CORS_ORIGINS=https://app.yourdomain.com"
ExecStart=/opt/meal-planner/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Then sudo systemctl enable --now meal-api.

5. Build and upload the web app
On your Mac (not the droplet):

cd /path/to/meal-planner
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npx expo export --platform web
Upload the contents of the export folder (often dist/ — check Expo’s output) to the server, e.g.:

/var/www/meal-planner/
(sudo mkdir, sudo chown deploy:deploy or www-data as you prefer.)

6. Caddyfile (both hosts + Basic Auth)
Example shape (adjust domains and paths):

api.yourdomain.com {
    basicauth {
        youruser $2a$14$...hash-from-caddy-hash-password...
    }
    reverse_proxy 127.0.0.1:8000
}
app.yourdomain.com {
    basicauth {
        youruser $2a$14$...same-or-different-hash...
    }
    root * /var/www/meal-planner
    file_server
    try_files {path} /index.html
}
try_files helps the SPA on refresh/deep links. If something 404s, tweak to match your export layout (Expo sometimes uses _expo assets; keep that directory next to index.html).

Reload Caddy: sudo systemctl reload caddy.

7. Smoke tests
https://api.yourdomain.com/docs (after auth)
https://api.yourdomain.com/health
https://app.yourdomain.com loads, login once, recipes load (no CORS errors in devtools).
8. Backups
Copy /opt/meal-planner/backend/data/meal_planner.db (and data/uploads if you care about images) on a schedule (cron + rclone/scp).
TL;DR next actions: DNS app + api → IP → UFW → Caddy → Python venv + systemd for API → export web with EXPO_PUBLIC_API_URL=https://api... → upload static → Caddy basicauth on both vhosts → test /docs and the app.

If you paste your real hostnames (redacted is fine), a single Caddyfile and a meal-api.service unit can be filled in literally for copy-paste.