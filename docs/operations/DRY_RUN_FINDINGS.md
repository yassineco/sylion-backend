# 🧪 DRY RUN — GO-LIVE Findings (local, sans VPS)

> **Date:** 2025-12-15  
> **Basé sur:** GO_LIVE_CHECKLIST.md v1.0 (2025-12-13)

---

## ✅ OK (clair et prêt)

- **VPS / OS :** Toutes les vérifications sont explicites avec commandes concrètes (UFW, SSH, NTP, etc.)
- **Docker :** Prérequis versionnés (Docker >= 24.x, Compose >= 2.x) et commandes de diagnostic claires
- **Sécurité réseau :** Vérifications PostgreSQL/Redis non exposés bien documentées
- **Nginx host :** Procédure SSL/Certbot et tests HTTP→HTTPS explicites
- **Secrets :** Liste exhaustive des variables requises avec grep de validation
- **Procédures de secours :** Restart, arrêt, rebuild et rollback documentés
- **Backup/Restore :** Scripts existants (`backup_postgres.sh`, `restore_postgres.sh`) et rétention 7 jours

---

## ⚠️ À clarifier (ambigu / décision manquante)

### 1. Port backend : 8000 vs 3000
- **Flou :** La checklist mentionne le port `8000` partout, mais `docker-compose.yml` et `Dockerfile` utilisent le port `3000`.
- **Risque prod :** Nginx configuré sur le mauvais port = 502 Bad Gateway dès le go-live.

### 2. Nom du container backend
- **Flou :** La checklist référence `sylion-backend`, mais `docker-compose.yml` définit `sylion-api`.
- **Risque prod :** Les commandes de diagnostic (`docker logs sylion-backend`) échoueront silencieusement.

### 3. Rollback sans stratégie de tagging
- **Flou :** La section rollback mentionne "si taguée" mais aucune convention de tags n'est définie.
- **Risque prod :** En cas de rollback urgent, pas de version précédente identifiable.

### 4. Cron backup non mentionné dans la checklist
- **Flou :** `BACKUP_RESTORE.md` documente un cron, mais la GO-LIVE checklist ne le vérifie pas.
- **Risque prod :** Backup non activé = perte de données silencieuse.

### 5. Variables WhatsApp sans validation de format
- **Flou :** La checklist vérifie si les variables sont "définies" mais pas leur validité (API key format, token length, etc.)
- **Risque prod :** Secrets invalides → échec au premier webhook WhatsApp.

---

## 🧱 Bloquants AVANT go-live (max 5)

### 1. Fichier `docker-compose.prod.yml` inexistant

- **Problème :** La checklist référence `docker-compose.prod.yml` dans toutes les commandes, mais ce fichier n'existe pas dans le repo.
- **Impact :** Aucune commande Docker de la checklist ne fonctionnera. Impossible de démarrer l'application en production.
- **Décision attendue :** Créer `docker-compose.prod.yml` avec les ports en loopback (`127.0.0.1:8000:3000`) OU documenter explicitement l'utilisation de `docker-compose.yml` modifié.

---

### 2. Incohérence ports/binding : checklist vs docker-compose actuel

- **Problème :** La checklist exige un binding loopback (`127.0.0.1:8000`), mais `docker-compose.yml` expose `"5432:5432"`, `"6379:6379"` et `"3000:3000"` sur toutes les interfaces.
- **Impact :** PostgreSQL et Redis accessibles depuis Internet = faille de sécurité critique. La validation finale GO-LIVE échouera sur les tests "Postgres not exposed" et "Redis not exposed".
- **Décision attendue :** Confirmer la configuration cible des ports pour prod et l'appliquer au fichier docker-compose utilisé.

---

### 3. Absence de configuration Nginx versionnée

- **Problème :** La checklist vérifie Nginx mais aucun fichier de config Nginx n'est versionné dans le repo.
- **Impact :** Configuration Nginx écrite à la main sur VPS = risque d'erreur, pas de reproductibilité, pas de rollback possible.
- **Décision attendue :** Décider si la config Nginx doit être versionnée dans le repo (ex: `deploy/nginx/api.sylion.tech.conf`) ou documentée exhaustivement.

---

### 4. Aucun test de connexion WhatsApp en pre-prod

- **Problème :** La checklist valide les secrets WhatsApp via grep, mais aucune vérification fonctionnelle (webhook test, envoi test) n'est mentionnée.
- **Impact :** Go-live possible avec des credentials WhatsApp invalides ou un webhook URL mal configuré côté Meta.
- **Décision attendue :** Définir un test de validation WhatsApp minimal avant go-live (ex: script `test-webhook.sh` ou vérification manuelle documentée).

---

### 5. Chemin `/srv/sylion` non documenté

- **Problème :** Toutes les procédures utilisent `cd /srv/sylion` mais aucune section ne documente la création de ce répertoire, le clone du repo, ou les permissions.
- **Impact :** Premier déploiement impossible sans deviner les étapes de setup initial.
- **Décision attendue :** Ajouter une section "Setup initial VPS" ou créer un document `FIRST_DEPLOY.md` détaillant : création user, clone repo, structure dossiers.

---

**Document généré le :** 2025-12-15  
**Auteur :** Dry Run automatisé (pre-go-live)
