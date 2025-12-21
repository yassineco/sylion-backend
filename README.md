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
