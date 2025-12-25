## Local Development — Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 9
- Docker & Docker Compose

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file from template
cp .env.example .env

# 3. Start Postgres and Redis containers
docker compose -f docker-compose.dev.yml up -d

# 4. Run database migrations
npm run db:migrate

# 5. Start the development server
npm run dev
```

In development, Docker Compose runs only the dependencies (Postgres, Redis). The backend itself runs on the host via `npm run dev`.

### Verification

```bash
curl http://localhost:3000/health
```

Expected response: `{"status":"ok"}` or similar health check payload.

### Common Local Issues (First Run)

- **Postgres/Redis not running** — Verify containers are up: `docker compose -f docker-compose.dev.yml ps`
- **Migrations fail (DB not ready)** — Wait for containers to be healthy, then re-run `npm run db:migrate`
- **Port 3000 already in use** — Check what process uses the port (`lsof -i :3000`) and stop it before retrying

---

## Minimal Environment Variables (Local Dev)

For basic local startup, only the following variables are required:

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/sylion`) |
| `REDIS_URL` | Redis connection string (e.g., `redis://localhost:6379`) |
| `JWT_SECRET` | Secret key for JWT signing (minimum 32 characters) |

Connection strings in `.env` should match the service names and credentials defined in `docker-compose.dev.yml`. Refer to `.env.example` for default values.

WhatsApp-related variables (`WHATSAPP_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) are **not required** for basic local startup. They are only needed when testing WhatsApp message ingestion.

See [WhatsApp Development Notes](#whatsapp-development-notes) for WhatsApp-specific setup.

---

### Déploiement VPS Production (derrière Nginx)

**Architecture de référence**  
Nginx tourne sur le **host du VPS (hors Docker)** et proxifie les requêtes HTTPS vers le backend exposé **uniquement en loopback** (`127.0.0.1:8000`).

---

#### 1. Prérequis

- VPS avec Docker et Docker Compose installés
- Nginx installé sur le host (hors Docker)
- Certificat SSL configuré (Let’s Encrypt ou équivalent)

---

#### 2. Déploiement

```bash
# 1. Créer le fichier d’environnement production à partir du template
cp .env.prod.example .env.prod

# 2. Renseigner les secrets OBLIGATOIRES dans .env.prod :
#    - POSTGRES_PASSWORD   (ex: openssl rand -base64 32)
#    - REDIS_PASSWORD      (ex: openssl rand -base64 32)
#    - JWT_SECRET          (ex: openssl rand -base64 64)
#    - WHATSAPP_API_KEY    (depuis le dashboard 360dialog)
#    - WHATSAPP_VERIFY_TOKEN
#    - WHATSAPP_PHONE_NUMBER_ID

# 3. Lancer les services
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Vérifications usuelles :

```bash
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml ps
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

Arrêt des services :

```bash
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

> Important : si un secret obligatoire est manquant, `docker compose` refusera de démarrer avec un message d’erreur explicite.

---

#### 3. Architecture réseau (résumé exact)

- Nginx écoute sur le host du VPS (ports 80/443).
- Le conteneur `backend` écoute sur le port `8000` **à l’intérieur de Docker**.
- Docker publie ce port **uniquement en loopback sur le host** :
  `127.0.0.1:8000 → backend:8000`.
- PostgreSQL et Redis restent accessibles **uniquement via le réseau Docker interne** (`sylion-network`).

---

#### 4. Configuration `docker-compose.prod.yml`

Pour exposer le backend en loopback sur le host :

```yaml
backend:
  ports:
    - "127.0.0.1:8000:8000"
```

> ℹ️ `expose:` est optionnel lorsque `ports:` est défini.

---

#### 5. Configuration Nginx (host)

Exemple minimal (fichier : `/etc/nginx/sites-available/api.sylion.tech`) :

```nginx
server {
    listen 80;
    server_name api.sylion.tech;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.sylion.tech;

    ssl_certificate     /etc/letsencrypt/live/api.sylion.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sylion.tech/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }
}
```

---

#### 6. Tests de validation (local / CI uniquement)

> ⚠️ **À NE PAS exécuter sur le VPS de production**  
> Cette section est réservée à la validation syntaxique en local ou en CI.

```bash
# Créer un fichier temporaire avec des valeurs de test
cat > .env.tmp << 'EOF'
POSTGRES_PASSWORD=test
REDIS_PASSWORD=test
JWT_SECRET=test_jwt_secret_minimum_32_chars
WHATSAPP_API_KEY=test_api_key
WHATSAPP_VERIFY_TOKEN=test_verify_token
WHATSAPP_PHONE_NUMBER_ID=test_phone_id
EOF

# Valider uniquement la syntaxe YAML et l’interpolation des variables
ENV_FILE=.env.tmp docker compose --env-file .env.tmp -f docker-compose.prod.yml config --quiet   && echo "✅ YAML valid"

# Nettoyage
rm -f .env.tmp
```

Objectif : vérifier que le fichier `docker-compose.prod.yml` est syntaxiquement correct **sans démarrer de conteneurs**.

---

#### ✅ Résumé des modifications

| Élément | Avant | Après |
|------|------|------|
| Architecture | Ambiguë (Docker vs host) | **Nginx sur host uniquement** |
| Loopback | Mal interprété | Publication loopback via `ports:` |
| Snippet YAML | Parasité / non valide | Minimal et valide |
| Configuration Nginx | DNS Docker interne | `127.0.0.1:8000` explicite |
| Tests CI | Mélangés avec prod | Section dédiée + cleanup |
| Lisibilité | Moyenne | **Runbook production clair** |ci check
merge block test


---

## WhatsApp Development Notes

WhatsApp message processing requires specific setup in development:

### Key Points

1. **A WhatsApp channel must exist in the database** — The worker resolves incoming messages to a channel by matching `channel.config.phoneNumber` (E.164 format) against the message's phone number.

2. **HTTP 200 does not guarantee processing** — The webhook acknowledges receipt immediately, but messages are silently dropped if no matching channel exists.

3. **Run the seed script before testing**:
   ```bash
   npx tsx scripts/seed-dev-channel.ts
   ```
   This script is idempotent and safe to run multiple times.

### Documentation

- [ADR-0003: WhatsApp Ingestion Contract](docs/architecture/adr/0003-whatsapp-ingestion-contract.md)
- [WhatsApp Debugging Runbook](docs/operations/whatsapp-debugging.md)
- [Dev Onboarding: WhatsApp Seed](docs/onboarding/dev-seed-whatsapp.md)
