# StockPulse Deployment Guide

Step-by-step guide to deploy StockPulse on an E2E Networks node.
Domain: `stockpulse.hiteshsadhwani.xyz`

---

## Phase 1: Code Changes (Codex does this)

This phase is already complete in the repo.

Implemented pieces:
- production deps, Gunicorn, WhiteNoise, and `dj-database-url`
- `/api/health/`
- Django-served SPA deep-link fallback
- `Dockerfile`
- `docker-compose.yml` and `docker-compose.dev.yml`
- GitHub Actions deploy workflow
- `deploy/setup-server.sh`, `deploy/nginx-stockpulse.conf`, `deploy/crontab.txt`
- `.env.production.example`

Before starting the server work, verify locally:
```bash
make lint && make test && make build
docker build -t stockpulse .
```

---

## Phase 2: Generate SSH Deploy Key (your laptop, 2 min)

This key lets GitHub Actions SSH into your E2E node to deploy.

```bash
# Generate a dedicated key pair (no passphrase)
ssh-keygen -t ed25519 -C "github-deploy-stockpulse" -f ~/.ssh/stockpulse-deploy -N ""

# View the PRIVATE key (you'll paste this into GitHub)
cat ~/.ssh/stockpulse-deploy

# View the PUBLIC key (you'll paste this on the server)
cat ~/.ssh/stockpulse-deploy.pub
```

Save both outputs — you'll need them in Phase 3 and Phase 4.

---

## Phase 3: GitHub Repo Secrets (github.com, 5 min)

Go to: `github.com/hitesh07082002/stockpulse` → Settings → Secrets and variables → Actions → New repository secret

Add these 3 secrets:

| Secret Name | Value |
|-------------|-------|
| `DEPLOY_HOST` | Your E2E node's IP address (e.g., `103.xx.xx.xx`) |
| `DEPLOY_USER` | SSH username on the node (e.g., `root` or `ubuntu`) |
| `DEPLOY_SSH_KEY` | Entire contents of `~/.ssh/stockpulse-deploy` (the PRIVATE key) |

---

## Phase 4: DNS Setup (your domain registrar, 2 min)

Go to wherever you bought `hiteshsadhwani.xyz` (Namecheap, Cloudflare, GoDaddy, etc.)

Add this DNS record:

```
Type:  A
Name:  stockpulse
Value: <your E2E node IP address>
TTL:   300 (or Auto)
```

This makes `stockpulse.hiteshsadhwani.xyz` point to your server.

**Verify** (may take 1-5 minutes to propagate):
```bash
ping stockpulse.hiteshsadhwani.xyz
# Should show your E2E node IP
```

---

## Phase 5: Server Setup (SSH into E2E node, 15 min)

### 5.1 Connect to your node
```bash
ssh your-user@YOUR_E2E_NODE_IP
```

### 5.2 Install Docker (skip if already installed)
```bash
# Check if Docker exists
docker --version

# If not installed:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# IMPORTANT: Log out and back in for group change to take effect
exit
ssh your-user@YOUR_E2E_NODE_IP

# Verify
docker run hello-world
```

### 5.3 Install Docker Compose plugin (skip if already installed)
```bash
# Check if it exists
docker compose version

# If not installed:
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

### 5.4 Create app directory
```bash
sudo mkdir -p /opt/stockpulse
sudo chown $USER:$USER /opt/stockpulse
sudo mkdir -p /var/log/stockpulse
sudo chown $USER:$USER /var/log/stockpulse
```

### 5.5 Add the deploy public key
```bash
# Add the PUBLIC key so GitHub Actions can SSH in
mkdir -p ~/.ssh
echo "PASTE_YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Replace `PASTE_YOUR_PUBLIC_KEY_HERE` with the contents of `~/.ssh/stockpulse-deploy.pub` from Phase 2.

### 5.6 Allow GHCR pulls
GitHub Container Registry needs authentication to pull your Docker images.

Create a GitHub Personal Access Token (PAT):
1. Go to: github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate new token with `read:packages` scope
3. Copy the token

On the server:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u hitesh07082002 --password-stdin
```

### 5.7 Copy docker-compose.yml to server

**From your laptop** (not the server):
```bash
scp /Users/hiteshsadhwani/Desktop/StockPulse/docker-compose.yml your-user@YOUR_E2E_NODE_IP:/opt/stockpulse/
```

### 5.8 Create production .env file

**On the server:**
```bash
nano /opt/stockpulse/.env
```

Paste this (fill in real values):
```
STOCKPULSE_ENV=production
APP_IMAGE_TAG=SET_BY_DEPLOY_WORKFLOW
SECRET_KEY=GENERATE_ONE_BELOW
DEBUG=False
DATABASE_URL=postgres://stockpulse:YOUR_DB_PASSWORD@db:5432/stockpulse
POSTGRES_PASSWORD=YOUR_DB_PASSWORD
ALLOWED_HOSTS=stockpulse.hiteshsadhwani.xyz
CORS_ALLOWED_ORIGINS=https://stockpulse.hiteshsadhwani.xyz
FRONTEND_APP_ORIGIN=https://stockpulse.hiteshsadhwani.xyz
ENABLE_GOOGLE_OAUTH_MOCK=False
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL=noreply@stockpulse.hiteshsadhwani.xyz
SERVER_EMAIL=noreply@stockpulse.hiteshsadhwani.xyz
EMAIL_HOST=smtp.your-provider.example
EMAIL_PORT=587
EMAIL_HOST_USER=your-smtp-user
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
PASSWORD_RESET_TIMEOUT=3600
AUTH_REGISTER_RATE=5/h
AUTH_LOGIN_RATE=10/m
EMAIL_VERIFICATION_RESEND_RATE=5/h
EMAIL_VERIFICATION_CONFIRM_RATE=15/h
PASSWORD_RESET_REQUEST_RATE=5/h
PASSWORD_RESET_CONFIRM_RATE=10/h
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://stockpulse.hiteshsadhwani.xyz/api/auth/google/callback/
```

Generate a SECRET_KEY:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Choose a strong POSTGRES_PASSWORD and use it in both `POSTGRES_PASSWORD` and `DATABASE_URL`.
Production is fail-closed: the app will refuse to boot if `DEBUG=True`, SQLite is used, `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`/`FRONTEND_APP_ORIGIN` are missing, an insecure email backend is configured, `DEFAULT_FROM_EMAIL` is blank, SMTP is selected without `EMAIL_HOST`, or mock Google OAuth is left enabled.

Password reset and email verification in production both depend on the SMTP settings above. After the first deploy, confirm that `/verify-email` and `/reset-password` both work against a real inbox.

Save and exit (Ctrl+X, Y, Enter in nano).

### 5.9 Setup nginx

**On the server:**
```bash
# Create the config file
sudo nano /etc/nginx/sites-available/stockpulse.conf
```

Paste:
```nginx
server {
    server_name stockpulse.hiteshsadhwani.xyz;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support for AI copilot streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
    }

    listen 80;
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/stockpulse.conf /etc/nginx/sites-enabled/
sudo nginx -t          # Test config — must say "ok"
sudo systemctl reload nginx
```

### 5.10 Get HTTPS certificate

```bash
# Install certbot if not present
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate (follow prompts, choose redirect HTTP to HTTPS)
sudo certbot --nginx -d stockpulse.hiteshsadhwani.xyz
```

Certbot auto-renews. Verify:
```bash
sudo certbot renew --dry-run
```

### 5.11 Setup cron jobs

```bash
# Edit crontab
crontab -e
```

Add these lines at the bottom:
```
# StockPulse scheduled jobs
*/15 * * * * (docker exec stockpulse-web python manage.py update_prices && docker exec stockpulse-web python manage.py compute_snapshots) >> /var/log/stockpulse/prices.log 2>&1
0 6 * * * (docker exec stockpulse-web python manage.py ingest_financials && docker exec stockpulse-web python manage.py compute_snapshots) >> /var/log/stockpulse/nightly.log 2>&1
0 5 * * 0 (docker exec stockpulse-web python manage.py ingest_companies && docker exec stockpulse-web python manage.py enrich_company_metadata) >> /var/log/stockpulse/weekly.log 2>&1
```

Save and exit.

### 5.12 Setup firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

## Phase 6: First Deploy (automatic, 5 min)

There is no staging environment in the current V1 setup. `main` is the production deploy branch.

Push or merge to `main`:
```bash
# On your laptop, in the StockPulse directory
git checkout main
git merge rewrite/v1    # or create a PR and merge
git push origin main
```

GitHub Actions will: build image → push to GHCR → SSH deploy → migrate → health check.
The deploy workflow also pins `APP_IMAGE_TAG` to the exact commit SHA that passed CI and verifies that `stockpulse-web` is running that same SHA-tagged image.

Important note:
- the deploy health check hits Gunicorn on `127.0.0.1:8000`, but it must send the production `Host` header plus `X-Forwarded-Proto: https`
- without those headers Django will reject the request (`ALLOWED_HOSTS`) or redirect it (`SECURE_SSL_REDIRECT`), even when the app is actually healthy

---

## Phase 7: Verify Everything Works (5 min)

### From your laptop:
```bash
# Health check
curl https://stockpulse.hiteshsadhwani.xyz/api/health/

# Homepage loads
curl -s https://stockpulse.hiteshsadhwani.xyz/ | head -5

# API works
curl https://stockpulse.hiteshsadhwani.xyz/api/companies/?search=AAPL
```

### Open in browser:
1. `https://stockpulse.hiteshsadhwani.xyz` — landing page should load
2. Click a company — stock detail should work
3. Try the AI tab — copilot should stream responses
4. Check HTTPS padlock in browser — should be green

### On the server — check containers are running:
```bash
docker compose ps
# Should show: stockpulse-web (Up), stockpulse-db (Up, healthy)

docker compose logs web --tail 20
# Should show gunicorn access logs, no errors
```

---

## Phase 8: Seed Production Data (10 min, one-time)

The database starts empty. Run ingestion commands to populate it:

```bash
# On the server
docker exec stockpulse-web python manage.py ingest_companies
docker exec stockpulse-web python manage.py ingest_financials
docker exec stockpulse-web python manage.py compute_snapshots
docker exec stockpulse-web python manage.py update_prices
docker exec stockpulse-web python manage.py enrich_company_metadata
```

After this, cron jobs keep data fresh automatically.

---

## Troubleshooting

### Container won't start
```bash
docker compose logs web     # Check for Python/Django errors
docker compose logs db      # Check for Postgres errors
```

### Health check fails
```bash
# Check if web container is running
docker compose ps

# Check if Postgres is healthy
docker exec stockpulse-db pg_isready -U stockpulse

# Check Django logs
docker compose logs web --tail 50
```

### HTTPS not working
```bash
# Check nginx config
sudo nginx -t

# Check certbot
sudo certbot certificates

# Re-run certbot
sudo certbot --nginx -d stockpulse.hiteshsadhwani.xyz
```

### Deploy fails in GitHub Actions
- Check Actions tab on GitHub for error logs
- Verify secrets are set correctly (DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY)
- SSH manually to test: `ssh -i ~/.ssh/stockpulse-deploy user@YOUR_IP`

### Roll back to a previous image
If a release is bad and the migration is backward-compatible:
1. Find the previous good commit SHA on GitHub
2. Update `APP_IMAGE_TAG` in `/opt/stockpulse/.env` to that SHA
3. Run:

```bash
cd /opt/stockpulse
APP_IMAGE_TAG=<GOOD_SHA> docker compose pull web
APP_IMAGE_TAG=<GOOD_SHA> docker compose up -d --remove-orphans
```

After the rollback, revisit the app health and smoke checks before considering the incident closed.

### Cron jobs not running
```bash
# Check crontab is installed
crontab -l

# Check logs
tail -f /var/log/stockpulse/prices.log

# Run manually to test
docker exec stockpulse-web python manage.py update_prices
```

---

## Useful Commands (cheat sheet)

```bash
# View running containers
docker compose ps

# View logs (follow mode)
docker compose logs -f

# Restart everything
docker compose restart

# Rebuild and restart
APP_IMAGE_TAG=$(grep '^APP_IMAGE_TAG=' .env | cut -d= -f2) docker compose pull web && \
APP_IMAGE_TAG=$(grep '^APP_IMAGE_TAG=' .env | cut -d= -f2) docker compose up -d --remove-orphans

# Run Django management command
docker exec stockpulse-web python manage.py <command>

# Open Django shell
docker exec -it stockpulse-web python manage.py shell

# Database backup
docker exec stockpulse-db pg_dump -U stockpulse stockpulse > backup-$(date +%Y%m%d).sql

# Database restore
cat backup.sql | docker exec -i stockpulse-db psql -U stockpulse stockpulse

# Check disk usage
docker system df

# Clean up old images
docker image prune -f
```
