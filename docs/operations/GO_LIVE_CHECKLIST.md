# 🚀 GO-LIVE Checklist — Sylion Backend VPS Production

> **Version:** 1.0  
> **Date:** 2025-12-13  
> **Objectif:** Valider tous les prérequis avant le premier déploiement production.

---

## 1️⃣ VPS / OS

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | Firewall actif (UFW/iptables) | `sudo ufw status` |
| [ ] | Ports ouverts : 22, 80, 443 uniquement | `sudo ufw status numbered` |
| [ ] | SSH par clé uniquement | `grep -E "^PasswordAuthentication" /etc/ssh/sshd_config` |
| [ ] | Root login désactivé | `grep -E "^PermitRootLogin" /etc/ssh/sshd_config` |
| [ ] | Espace disque > 10 GB libre | `df -h /` |
| [ ] | Horloge synchronisée (NTP) | `timedatectl status` |
| [ ] | Timezone correcte | `cat /etc/timezone` |
| [ ] | Utilisateur sudo configuré | `sudo whoami` |

---

## 2️⃣ Docker / Docker Compose

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | Docker installé (>= 24.x) | `docker --version` |
| [ ] | Docker Compose installé (>= 2.x) | `docker compose version` |
| [ ] | Docker daemon actif | `sudo systemctl is-enabled docker` |
| [ ] | Utilisateur dans groupe docker | `groups $USER \| grep docker` |
| [ ] | Volumes créés | `docker volume ls \| grep sylion` |
| [ ] | Réseau créé | `docker network ls \| grep sylion-network` |

**Commandes de diagnostic :**

```bash
# État des containers
docker compose -f docker-compose.prod.yml ps

# Logs temps réel
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Inspecter un container
docker inspect sylion-backend
```

---

## 3️⃣ Réseau & Sécurité

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | PostgreSQL non exposé (5432) | `ss -tlnp \| grep 5432` (doit être vide) |
| [ ] | Redis non exposé (6379) | `ss -tlnp \| grep 6379` (doit être vide) |
| [ ] | Backend en loopback uniquement | `ss -tlnp \| grep 8000` → `127.0.0.1:8000` |
| [ ] | Pas de port public Docker | `docker ps --format "{{.Ports}}"` |
| [ ] | Réseau Docker isolé | `docker network inspect sylion-network` |

**Vérification critique :**

```bash
# Le backend NE DOIT PAS écouter sur 0.0.0.0:8000
ss -tlnp | grep 8000
# Résultat attendu : 127.0.0.1:8000 uniquement
```

---

## 4️⃣ Nginx (host)

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | Nginx installé et actif | `sudo systemctl status nginx` |
| [ ] | Config syntax OK | `sudo nginx -t` |
| [ ] | Certificat SSL valide | `sudo certbot certificates` |
| [ ] | Certificat non expiré | `echo \| openssl s_client -connect api.sylion.tech:443 2>/dev/null \| openssl x509 -noout -dates` |
| [ ] | Redirection HTTP → HTTPS | `curl -I http://api.sylion.tech` → `301` |
| [ ] | Proxy vers backend OK | `curl -I https://api.sylion.tech/health` → `200` |
| [ ] | Headers proxy configurés | Vérifier `X-Real-IP`, `X-Forwarded-For` |

**Test complet Nginx → Backend :**

```bash
# Depuis le VPS
curl -s http://127.0.0.1:8000/health | jq .

# Depuis l'extérieur
curl -s https://api.sylion.tech/health | jq .
```

---

## 5️⃣ Environnement & Secrets

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | `.env.prod` présent | `ls -la .env.prod` |
| [ ] | `.env.prod` non dans git | `git status .env.prod` (untracked) |
| [ ] | Permissions restreintes (600) | `stat -c %a .env.prod` → `600` |
| [ ] | `POSTGRES_PASSWORD` défini | `grep -q "^POSTGRES_PASSWORD=.\+" .env.prod && echo OK` |
| [ ] | `REDIS_PASSWORD` défini | `grep -q "^REDIS_PASSWORD=.\+" .env.prod && echo OK` |
| [ ] | `JWT_SECRET` défini | `grep -q "^JWT_SECRET=.\+" .env.prod && echo OK` |
| [ ] | `WHATSAPP_API_KEY` défini | `grep -q "^WHATSAPP_API_KEY=.\+" .env.prod && echo OK` |
| [ ] | `WHATSAPP_VERIFY_TOKEN` défini | `grep -q "^WHATSAPP_VERIFY_TOKEN=.\+" .env.prod && echo OK` |
| [ ] | `WHATSAPP_PHONE_NUMBER_ID` défini | `grep -q "^WHATSAPP_PHONE_NUMBER_ID=.\+" .env.prod && echo OK` |

**Vérifier le fail-fast (secret manquant = échec) :**

```bash
# Doit échouer si un secret manque
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet
echo $?  # 0 = OK, autre = erreur
```

**Sécuriser les permissions :**

```bash
chmod 600 .env.prod
chown $USER:$USER .env.prod
```

---

## 6️⃣ Application & Santé

| Check | Item | Commande de vérification |
|-------|------|--------------------------|
| [ ] | Containers running | `docker compose -f docker-compose.prod.yml ps` |
| [ ] | Backend healthy | `docker inspect sylion-backend --format='{{.State.Health.Status}}'` |
| [ ] | `/health` retourne 200 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health` |
| [ ] | Logs sans erreur critique | `docker logs sylion-backend 2>&1 \| grep -i error` |
| [ ] | Connexion Postgres OK | Vérifier dans logs : `Database connected` |
| [ ] | Connexion Redis OK | Vérifier dans logs : `Redis connected` |
| [ ] | Restart après reboot | `sudo reboot` puis vérifier `docker ps` |

**Test santé complet :**

```bash
curl -s http://127.0.0.1:8000/health | jq .
# Attendu : {"status":"healthy","demoMode":false,"dbConnected":true,"redisConnected":true,...}
```

---

## 7️⃣ Procédures de secours

### 🔄 Restart rapide

```bash
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend
```

### 🛑 Arrêt propre

```bash
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

### 🚀 Redémarrage complet (rebuild)

```bash
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### ⏪ Rollback (image précédente)

```bash
# Lister les images disponibles
docker images | grep sylion

# Forcer une image spécifique (si taguée)
docker compose -f docker-compose.prod.yml up -d --no-build
```

### 🔍 Où regarder en cas de panne

| Problème | Logs à consulter |
|----------|------------------|
| Backend ne répond pas | `docker logs sylion-backend --tail=200` |
| Nginx erreur 502/504 | `sudo tail -f /var/log/nginx/error.log` |
| Postgres crash | `docker logs sylion-postgres --tail=200` |
| Redis timeout | `docker logs sylion-redis --tail=200` |
| SSL expiré | `sudo certbot certificates` |
| Conteneur restart loop | `docker inspect sylion-backend --format='{{.RestartCount}}'` |

---

## ✅ Validation finale GO-LIVE

Avant de considérer le déploiement comme **LIVE**, tous les items suivants doivent être validés :

```bash
# Script de validation rapide (copier-coller)
echo "=== GO-LIVE Validation ==="
echo -n "Docker running: " && docker ps --format "{{.Names}}" | grep -q sylion && echo "✅" || echo "❌"
echo -n "Backend healthy: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health | grep -q 200 && echo "✅" || echo "❌"
echo -n "HTTPS accessible: " && curl -s -o /dev/null -w "%{http_code}" https://api.sylion.tech/health | grep -q 200 && echo "✅" || echo "❌"
echo -n "Postgres not exposed: " && ss -tlnp | grep -q ":5432" && echo "❌ EXPOSED!" || echo "✅"
echo -n "Redis not exposed: " && ss -tlnp | grep -q ":6379" && echo "❌ EXPOSED!" || echo "✅"
echo -n "Backend loopback only: " && ss -tlnp | grep ":8000" | grep -q "127.0.0.1" && echo "✅" || echo "❌"
echo "==========================="
```

---

## 📋 Signature GO-LIVE

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| DevOps | | | [ ] Validé |
| Tech Lead | | | [ ] Validé |

---

**Document maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-13
