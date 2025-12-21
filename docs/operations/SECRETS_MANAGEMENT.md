# 🔐 Secrets Management — Sylion Backend Production

> **Version :** 1.0  
> **Date :** 2025-12-15  
> **Objectif :** Documenter la gestion sécurisée des secrets pour la production.

---

## 📋 Variables requises

| Variable | Requis | Source | Format | Rotation |
|----------|--------|--------|--------|----------|
| `POSTGRES_PASSWORD` | ✅ | Généré localement | Base64, 32+ chars | Annuelle ou après incident |
| `REDIS_PASSWORD` | ✅ | Généré localement | Base64, 32+ chars | Annuelle ou après incident |
| `JWT_SECRET` | ✅ | Généré localement | Base64, 64+ chars | Annuelle ou après incident |
| `WHATSAPP_API_KEY` | ✅ | Portail 360dialog | Alphanum, 20+ chars | Selon 360dialog |
| `WHATSAPP_VERIFY_TOKEN` | ✅ | Choisi par l'équipe | Alphanum, 8+ chars | À chaque reconfiguration webhook |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | Portail 360dialog | Numérique | Fixe (lié au numéro) |
| `GCP_PROJECT_ID` | ⚠️ | Console GCP | String | Fixe |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ | Console GCP (service account) | Chemin fichier JSON | Annuelle |
| `GCS_BUCKET_NAME` | ⚠️ | Console GCP | String, 3+ chars | Fixe |

> ⚠️ = Requis si fonctionnalité LLM/Vertex AI activée

---

## 🔑 Détails par variable

### POSTGRES_PASSWORD

- **Source :** Généré localement avec `openssl rand -base64 32`
- **Format :** Base64, minimum 32 caractères, pas de caractères spéciaux problématiques (`$`, `\`, `'`)
- **Utilisé par :** PostgreSQL container, DATABASE_URL du backend
- **Rotation :** Annuelle ou immédiatement après suspicion de compromission

### REDIS_PASSWORD

- **Source :** Généré localement avec `openssl rand -base64 32`
- **Format :** Base64, minimum 32 caractères
- **Utilisé par :** Redis container, REDIS_URL du backend
- **Rotation :** Annuelle ou après incident

### JWT_SECRET

- **Source :** Généré localement avec `openssl rand -base64 64`
- **Format :** Base64, minimum 64 caractères (512 bits)
- **Utilisé par :** Backend pour signer les tokens JWT
- **Rotation :** Annuelle. ⚠️ Invalide tous les tokens existants lors de la rotation.

### WHATSAPP_API_KEY

- **Source :** Portail 360dialog → Settings → API Keys
- **Format :** Alphanumérique, généralement 64+ caractères
- **Utilisé par :** Backend pour appeler l'API WhatsApp
- **Rotation :** Selon politique 360dialog, ou après suspicion de fuite

### WHATSAPP_VERIFY_TOKEN

- **Source :** Choisi par l'équipe (token de validation webhook)
- **Format :** Alphanumérique, minimum 8 caractères, recommandé 32+
- **Utilisé par :** Backend pour valider les requêtes webhook entrantes
- **Rotation :** À chaque reconfiguration du webhook côté Meta/360dialog

### WHATSAPP_PHONE_NUMBER_ID

- **Source :** Portail 360dialog → Numéros → ID du numéro configuré
- **Format :** Numérique (ex: `1234567890123456`)
- **Utilisé par :** Backend pour identifier le numéro WhatsApp Business
- **Rotation :** Fixe, lié au numéro de téléphone

---

## 📦 Règles de stockage

### ✅ Recommandé

1. **Password Manager** (1Password, Bitwarden, etc.)
   - Stocker tous les secrets dans un vault partagé équipe
   - Activer 2FA sur le password manager

2. **Fichier `.env.prod` local**
   - Présent uniquement sur le VPS de production
   - Permissions : `chmod 600 .env.prod`
   - Propriétaire : utilisateur de déploiement (`sylion`)

3. **Backup chiffré**
   - Exporter les secrets dans un fichier chiffré (GPG)
   - Stocker hors-ligne ou dans un second vault

### ❌ DO NOT — Interdictions absolues

| Interdit | Raison |
|----------|--------|
| Commiter `.env.prod` dans Git | Exposition publique des secrets |
| Partager via Slack/Email/Chat | Historique non sécurisé |
| Stocker en clair sur Google Drive/Dropbox | Pas de chiffrement at-rest garanti |
| Utiliser les mêmes secrets en dev et prod | Contamination des environnements |
| Hardcoder dans le code source | Exposition dans l'historique Git |
| Copier-coller dans des tickets Jira/GitHub Issues | Logs et caches non sécurisés |

---

## 🔄 Procédure de rotation

### Rotation planifiée (annuelle)

1. Générer nouveau secret
2. Mettre à jour `.env.prod` sur le VPS
3. Redémarrer les containers concernés
4. Valider le fonctionnement (health check)
5. Mettre à jour le password manager
6. Documenter la date de rotation

### Rotation d'urgence (après incident)

1. Révoquer immédiatement l'ancien secret (si applicable : API keys)
2. Générer nouveau secret
3. Déployer en urgence
4. Post-mortem : identifier la source de la fuite

---

## 📁 Fichiers associés

| Fichier | Rôle |
|---------|------|
| `.env.prod.example` | Template avec placeholders (versionné) |
| `.env.prod` | Secrets réels (NON versionné, VPS uniquement) |
| `docs/operations/SECRETS_CHECKLIST.md` | Checklist de génération |

---

**Document maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-15
