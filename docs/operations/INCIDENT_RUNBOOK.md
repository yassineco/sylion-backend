# 🚨 Runbook Incident Production — Sylion Backend

> **Version:** 1.0  
> **Date:** 2025-12-13  
> **Environnement:** VPS / Docker / Nginx host / PostgreSQL / Redis

---

## 📞 Contacts escalade

| Rôle | Contact |
|------|---------|
| On-call DevOps | À définir |
| Tech Lead | À définir |
| Hébergeur VPS | Support ticket |

---

## 🔴 Incident 1 : API complètement down

### Symptômes
- `curl https://api.sylion.tech/health` → timeout ou connexion refusée
- Alertes monitoring "endpoint unreachable"
- Utilisateurs signalent erreur réseau

### Diagnostic

```bash
# 1. Vérifier si le VPS répond
ping api.sylion.tech

# 2. Vérifier Nginx
sudo systemctl status nginx
sudo nginx -t

# 3. Vérifier les containers Docker
docker ps -a

# 4. Vérifier les ports
ss -tlnp | grep -E "80|443|8000"

# 5. Vérifier le firewall
sudo ufw status
```

### Actions correctives

```bash
# Si Nginx down
sudo systemctl restart nginx

# Si containers down
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

# Si firewall bloque
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Si VPS ne répond pas
# → Reboot via panel hébergeur
# → Vérifier console VPS
```

### Quand restaurer backup
❌ Pas nécessaire — problème d'infrastructure, pas de données.

---

## 🟠 Incident 2 : Nginx OK, Backend KO (502/504)

### Symptômes
- `curl https://api.sylion.tech/health` → 502 Bad Gateway ou 504 Gateway Timeout
- Nginx logs : `connect() failed (111: Connection refused)`
- `curl http://127.0.0.1:8000/health` → connexion refusée

### Diagnostic

```bash
# 1. État du backend
docker ps | grep sylion-backend
docker inspect sylion-backend --format='{{.State.Status}} {{.State.Health.Status}}'

# 2. Logs backend
docker logs sylion-backend --tail=100

# 3. Restart count (crash loop?)
docker inspect sylion-backend --format='{{.RestartCount}}'

# 4. Vérifier port loopback
ss -tlnp | grep 8000

# 5. Logs Nginx
sudo tail -50 /var/log/nginx/error.log
```

### Actions correctives

```bash
# Restart backend
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend

# Si crash loop, rebuild complet
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build backend

# Si erreur de config/secret
docker logs sylion-backend --tail=50
# Vérifier .env.prod et corriger

# Si port pas exposé
# Vérifier docker-compose.prod.yml → ports: "127.0.0.1:8000:8000"
```

### Quand restaurer backup
❌ Pas nécessaire — problème applicatif, pas de corruption données.

---

## 🟠 Incident 3 : Redis down / Queue bloquée

### Symptômes
- Backend logs : `Redis connection refused` ou `ECONNREFUSED`
- `/health` retourne `redisConnected: false`
- Messages WhatsApp non traités (queue bloquée)
- Latence anormale

### Diagnostic

```bash
# 1. État Redis
docker ps | grep sylion-redis
docker logs sylion-redis --tail=50

# 2. Test connexion Redis
docker exec sylion-redis redis-cli -a "$REDIS_PASSWORD" ping
# Attendu : PONG

# 3. Mémoire Redis
docker exec sylion-redis redis-cli -a "$REDIS_PASSWORD" info memory

# 4. Taille des queues
docker exec sylion-redis redis-cli -a "$REDIS_PASSWORD" keys "bull:*"

# 5. Vérifier le volume
docker volume inspect sylion-redis-data
```

### Actions correctives

```bash
# Restart Redis
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart redis

# Attendre que Redis soit healthy, puis restart backend
sleep 10
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend

# Si queue corrompue, vider (PERTE DE MESSAGES EN ATTENTE)
docker exec sylion-redis redis-cli -a "$REDIS_PASSWORD" FLUSHDB
# ⚠️ Uniquement si messages non critiques

# Si mémoire saturée
docker exec sylion-redis redis-cli -a "$REDIS_PASSWORD" MEMORY PURGE
```

### Quand restaurer backup
❌ Redis est un cache/queue — pas de restore, les données sont reconstruites.

---

## 🔴 Incident 4 : PostgreSQL inaccessible

### Symptômes
- Backend logs : `Connection refused` ou `FATAL: password authentication failed`
- `/health` retourne `dbConnected: false`
- API retourne 500 sur toutes les requêtes DB

### Diagnostic

```bash
# 1. État Postgres
docker ps | grep sylion-postgres
docker logs sylion-postgres --tail=50

# 2. Test connexion
docker exec sylion-postgres pg_isready -U sylion_user -d sylion_prod
# Attendu : accepting connections

# 3. Espace disque volume
docker system df -v | grep postgres

# 4. Connexions actives
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT count(*) FROM pg_stat_activity;"

# 5. Vérifier les locks
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

### Actions correctives

```bash
# Restart Postgres
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart postgres

# Attendre healthy, puis restart backend
sleep 30
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart backend

# Si mot de passe incorrect
# Vérifier POSTGRES_PASSWORD dans .env.prod

# Si trop de connexions
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"

# Si corruption détectée
docker logs sylion-postgres --tail=200 | grep -i corrupt
# → Voir section restore
```

### Quand restaurer backup
✅ **OUI** si :
- Corruption de données confirmée
- Erreur `PANIC` dans les logs Postgres
- Volume Docker corrompu

```bash
# Restore depuis backup
cd /srv/sylion
ENV_FILE=.env.prod ./scripts/restore_postgres.sh backups/postgres/sylion_YYYY-MM-DD_HHMMSS.sql.gz
```

---

## 🟠 Incident 5 : VPS full disk

### Symptômes
- Erreurs `No space left on device`
- Docker ne démarre plus
- Postgres refuse les writes
- Logs tronqués

### Diagnostic

```bash
# 1. Espace disque global
df -h

# 2. Répertoires les plus gros
du -sh /* 2>/dev/null | sort -hr | head -10

# 3. Espace Docker
docker system df

# 4. Logs Docker (souvent coupables)
du -sh /var/lib/docker/containers/*/*.log | sort -hr | head -5

# 5. Backups accumulés
du -sh /srv/sylion/backups/
```

### Actions correctives

```bash
# Nettoyer Docker (images/containers inutilisés)
docker system prune -af --volumes

# Nettoyer les logs Docker > 100MB
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log

# Supprimer vieux backups manuellement
ls -lt /srv/sylion/backups/postgres/ | tail -n +8 | awk '{print $NF}' | xargs -I {} rm /srv/sylion/backups/postgres/{}

# Nettoyer apt
sudo apt autoremove -y
sudo apt clean

# Nettoyer journalctl
sudo journalctl --vacuum-time=3d

# Après nettoyage, restart services
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml restart
```

### Quand restaurer backup
⚠️ **Peut-être** si Postgres a crashé pendant un write (corruption).

---

## 🟠 Incident 6 : VPS high load / lent

### Symptômes
- API très lente (> 5s)
- SSH lag
- Load average > nombre de CPUs

### Diagnostic

```bash
# 1. Load average
uptime

# 2. Processus consommateurs
top -bn1 | head -20

# 3. Mémoire
free -h

# 4. I/O disque
iostat -x 1 5

# 5. Containers consommateurs
docker stats --no-stream

# 6. Connexions réseau
ss -s
```

### Actions correctives

```bash
# Si backend consomme trop
docker restart sylion-backend

# Si Postgres consomme trop (requêtes lentes)
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 5;"

# Tuer requêtes longues (> 5 min)
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# Si swap utilisé massivement
free -h
# → Augmenter RAM VPS ou optimiser app

# Si I/O saturé
# → Vérifier si backup en cours
# → Différer les opérations lourdes
```

### Quand restaurer backup
❌ Pas nécessaire — problème de performance, pas de données.

---

## 📋 Checklist post-incident

Après chaque incident résolu :

- [ ] Services UP et healthy
- [ ] `/health` retourne 200
- [ ] Logs sans erreurs critiques
- [ ] Monitoring vert
- [ ] Documenter l'incident (timeline, cause, fix)
- [ ] Créer ticket si fix permanent nécessaire

---

## � Incident: Quota Blocking (Indexation Limit)

### Symptômes
- Documents stuck in `uploaded` or `error` status
- Error in logs: `Daily indexing limit reached: X/Y`
- Users report "document not searchable"
- `GET /admin/knowledge/stats` shows `docsIndexedCount` at limit

### Diagnostic

```bash
# 1. Check document status
psql $DATABASE_URL -c "
  SELECT id, name, status, error_reason, created_at
  FROM knowledge_documents
  WHERE tenant_id = 'TENANT_UUID'
  ORDER BY created_at DESC LIMIT 10;
"

# 2. Check daily counter
psql $DATABASE_URL -c "
  SELECT date, docs_indexed_count, rag_queries_count
  FROM usage_counters_daily
  WHERE tenant_id = 'TENANT_UUID'
  ORDER BY date DESC LIMIT 5;
"

# 3. Check plan limits
psql $DATABASE_URL -c "
  SELECT t.id, t.plan_code, p.limits_json->>'maxDailyIndexing' as daily_limit
  FROM tenants t
  JOIN plans p ON t.plan_code = p.code
  WHERE t.id = 'TENANT_UUID';
"

# 4. Check failed jobs in BullMQ
docker exec sylion-redis redis-cli keys "bull:rag:index-document:failed*"
```

### Actions correctives

```bash
# Option 1: Wait for daily reset (midnight UTC)
# Counters reset automatically

# Option 2: Upgrade tenant plan
psql $DATABASE_URL -c "
  UPDATE tenants SET plan_code = 'pro' WHERE id = 'TENANT_UUID';
"

# Option 3: Manual counter reset (EMERGENCY ONLY)
psql $DATABASE_URL -c "
  UPDATE usage_counters_daily
  SET docs_indexed_count = 0
  WHERE tenant_id = 'TENANT_UUID' AND date = CURRENT_DATE;
"

# Then retry failed documents
curl -X POST http://localhost:3000/admin/knowledge/documents/DOC_UUID/reindex \
  -H "X-Tenant-ID: TENANT_UUID"
```

### Prevention
- Monitor `docsIndexedCount` approaching limit
- Alert at 80% of daily quota
- Educate tenants about plan limits

---

## 🗄️ DB Migration Runbook

### Executing Migrations

```bash
# 1. Ensure PostgreSQL is running
pg_isready -h localhost -p 5433

# 2. Run migration (idempotent)
psql "postgres://sylion_dev:dev_password@localhost:5433/sylion_dev" \
  -f drizzle/0003_add_plans_and_knowledge.sql

# 3. Verify (run twice to confirm idempotency)
psql "postgres://sylion_dev:dev_password@localhost:5433/sylion_dev" \
  -f drizzle/0003_add_plans_and_knowledge.sql
```

### Migration Tables Reference

| Table | Purpose |
|-------|---------|
| `plans` | Plan definitions with `limits_json` |
| `knowledge_documents` | Uploaded documents metadata |
| `knowledge_chunks` | Chunked content with pgvector embeddings |
| `usage_counters_daily` | Daily quota counters per tenant |

### Idempotency Guarantees
- All `CREATE TABLE IF NOT EXISTS`
- All `CREATE INDEX IF NOT EXISTS`
- Constraints use `DO $$ ... IF NOT EXISTS ... $$`
- Plans seeded with `ON CONFLICT DO UPDATE`

---

## �🔧 Commandes utiles mémo

```bash
# Redémarrage complet propre
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml down
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# Logs tous services
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=100

# État rapide
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health check
curl -s http://127.0.0.1:8000/health | jq .

# Backup d'urgence avant intervention
ENV_FILE=.env.prod ./scripts/backup_postgres.sh
```

---

**Maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-13
