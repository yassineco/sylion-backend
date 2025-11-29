# 🔐 Sylion Backend – Guide de Sécurité

Ce document définit les règles de sécurité strictes pour le projet **sylion-backend**.  
Tout manquement peut entraîner une fuite de données critiques (WhatsApp, GCP, Supabase, clients marocains & européens).

---

# 1. Principes essentiels

1. **Aucune clé secrète dans le code, jamais.**
2. **Jamais de commit contenant un `.env`.**
3. **Secrets uniquement dans :**
   - `.env.local` (non versionné)
   - variables CI/CD GitHub (plus tard)
   - Secret Manager (plus tard)
4. **Toujours valider les variables via `config/env.ts`.**

---

# 2. Variables sensibles du projet

| Variable | Description |
|---------|-------------|
| `DATABASE_URL` | Connexion Supabase |
| `REDIS_URL` | Redis pour BullMQ |
| `WHATSAPP_API_KEY` | 360dialog |
| `WHATSAPP_VERIFY_TOKEN` | Vérification Webhook |
| `GCP_SERVICE_ACCOUNT` | Key JSON Vertex AI |
| `GCS_BUCKET` | Bucket des documents RAG |
| `JWT_SECRET` | Signature API Admin (plus tard) |

⚠️ Aucun de ces champs ne doit apparaître dans un commit, dans Copilot, ou dans une capture d’écran.

---

# 3. Sécurité VS Copilot / IA

1. **Ne jamais envoyer une clé GCP ou WhatsApp dans une question IA.**
2. **Ne jamais demander à Copilot de lire un fichier `.env`.**
3. **Ne jamais coller une erreur contenant un secret sans l’anonymiser.**
4. **Demander à Copilot uniquement du code, pas des configs sensibles.**

---

# 4. GitHub & Sécurité du Repo

- Repo **privé** obligatoire.
- Activer :
  - **Secret Scanning Alerts**
  - **Dependabot alerts**
- Utiliser un token GitHub avec permissions minimales.

---

# 5. Sécurité Backend

- Tous les webhooks doivent être validés (token/headers).
- Logger les IPs d’origine des webhooks.
- Limiter la taille des payloads entrants.
- Masquer les numéros WhatsApp dans les logs :
  - `+212635xxxxxx`

---

# 6. VPS & Déploiement

- Firewall obligatoire :
  - autoriser uniquement : 80/443/22
- Docker + Nginx reverse proxy
- Certificat Let's Encrypt / Cloudflare
- Séparation réseau :  
  API <-> Redis <-> Postgres Supabase (pas d'accès public)

---

# 7. Sécurité IA & RAG

- Ne stocker aucun fichier local (tout → Cloud Storage)
- Les documents uploadés ne doivent être accessibles qu’au tenant concerné.
- Pas de logs contenant du texte privé des documents.

---

# 8. Bonnes pratiques développeur

- Utiliser VS Code avec GitLens + ESLint.
- Toujours vérifier un diff avant commit.
- Si doute : demander une revue (même IA → Copilot context-check).
