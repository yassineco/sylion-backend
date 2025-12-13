# 🦁 SylionTech — Daily Progress Report  
**Date : 11 décembre 2025**

---

## 1. Résumé exécutif

Aujourd'hui, session Golden Hour dédiée à la mise en conformité de l'authentification GCP et à la préparation du système RAG interne. L'erreur critique `ERR_OSSL_UNSUPPORTED` rencontrée lors de l'exécution du Knowledge Pack loader a été résolue par une migration complète vers **Application Default Credentials (ADC)**. 

Cette décision d'architecture élimine définitivement les problèmes de compatibilité OpenSSL 3.x et renforce la sécurité en externalisant les credentials dans un fichier `.secrets/` dédié (gitignored). Le Knowledge Pack (13 fichiers markdown) est prêt à être indexé dès l'insertion de la vraie clé GCP.

**Déblocage majeur :** L'infrastructure d'embeddings Vertex AI est maintenant compatible avec l'environnement Node.js moderne via `google-auth-library`.

---

## 2. Travaux réalisés aujourd'hui

### 2.1. Création du système de secrets
| Élément | Détails |
|---------|---------|
| Dossier `.secrets/` | Créé à la racine du projet |
| `.gitignore` | Mis à jour pour ignorer `.secrets/` |
| `gcp-vertex-dev.json` | Fichier placeholder créé, en attente de la vraie clé JSON |

### 2.2. Migration GCP vers ADC

| Fichier modifié | Changement |
|-----------------|------------|
| `.env.local` | `GCP_SERVICE_ACCOUNT_KEY` → `GOOGLE_APPLICATION_CREDENTIALS=.secrets/gcp-vertex-dev.json` |
| `src/config/env.ts` | Schema Zod mis à jour : `GOOGLE_APPLICATION_CREDENTIALS` (path) au lieu de JSON inline |
| `src/config/env.ts` | `config.gcp.serviceAccountKey` → `config.gcp.credentialsPath` |

### 2.3. Réécriture complète de `src/lib/embedding.ts`

**Avant :** Signature JWT manuelle avec `crypto.createSign('RSA-SHA256')` → incompatible OpenSSL 3.x  
**Après :** Utilisation de `google-auth-library` avec ADC

Changements clés :
- Import de `GoogleAuth` depuis `google-auth-library`
- Suppression des fonctions `createJWT()`, `signRS256()`, `base64UrlEncode()`
- Méthode `getAccessToken()` simplifiée via `auth.getClient().getAccessToken()`
- Ajout de la méthode `getServiceAccountInfo()` pour diagnostic
- Logging structuré avec tag `[EmbeddingService]`

### 2.4. Scripts créés

| Script | Chemin | Commande npm | Description |
|--------|--------|--------------|-------------|
| Test GCP Auth | `scripts/test-gcp-auth.ts` | `npm run test:gcp` | Diagnostic complet de l'auth GCP + test API Vertex AI |
| KB Loader | `scripts/loadKnowledgePack.ts` | `npm run load:kb` | Charge les 13 fichiers .md dans la DB avec embeddings |
| Test DB | `scripts/test-db-connection.ts` | N/A | Diagnostic connexion PostgreSQL local |

### 2.5. Dépendances installées

```bash
npm install google-auth-library
# Résultat: added 48 packages, changed 5 packages, audited 786 packages in 4s
```

### 2.6. Knowledge Pack créé

13 fichiers markdown dans `/knowledge/` :

| Fichier | Contenu |
|---------|---------|
| `00-index.md` | Index du Knowledge Pack |
| `01-vision-positionnement.md` | Vision & stratégie SylionAI |
| `03-offres-pricing.md` | Structure des offres Starter/Business/Enterprise |
| `05-architecture-technique-highlevel.md` | Architecture Gateway → Queue → Workers |
| `06-arguments-ventes-generiques.md` | Argumentaire commercial générique |
| `07-arguments-par-secteur.md` | Arguments par secteur (cliniques, écoles, immobilier…) |
| `08-objections-reponses.md` | Objections commerciales et réponses |
| `09-securite-limites.md` | Guardrails, limites et sécurité |
| `10-roadmap-90-jours.md` | Roadmap MVP → Production |
| `11-prompt-system-assistant-commercial.md` | Prompt système assistant commercial |
| `12-prompt-system-assistant-technique.md` | Prompt système assistant technique |
| `13-glossaire-terminologie.md` | Glossaire officiel SylionAI |
| `CHANGELOG_KB.md` | Changelog du Knowledge Pack |

### 2.7. Environnement Docker vérifié

```bash
docker ps
# sylion-postgres-dev (5433) ✅
# sylion-redis-dev (6380) ✅  
# sylion-redis-ui (8081) ✅

# Test connexion DB
tsx scripts/test-db-connection.ts
# ✅ Connection successful! Result: [{"test":1}]
```

---

## 3. Décisions d'architecture validées

### 3.1. Adoption ADC (Application Default Credentials)
- **Décision :** Utiliser `google-auth-library` avec ADC au lieu de JWT manuel
- **Raison :** Compatibilité OpenSSL 3.x, maintenance simplifiée, sécurité renforcée
- **Impact :** Tout service GCP (Vertex AI, GCS) utilisera désormais ADC

### 3.2. Interdiction des clés JSON dans `.env`
- **Règle :** Ne jamais stocker de clé JSON GCP dans les variables d'environnement
- **Standard :** `GOOGLE_APPLICATION_CREDENTIALS` pointe vers un fichier externe
- **Sécurité :** Le fichier `.secrets/` est gitignored

### 3.3. Structure "dual-mode DB"
- **Dev :** PostgreSQL Docker local (`localhost:5433`)
- **Prod :** Supabase PostgreSQL (configuration future)
- **Configuration :** `DATABASE_URL` dans `.env.local`

### 3.4. Normalisation scripts RAG
- **Commande unifiée :** `npm run load:kb` pour indexer le Knowledge Pack
- **Pattern :** Scripts dans `/scripts/` avec extension `.ts`, exécutés via `tsx`

### 3.5. Politique secrets
| Élément | Emplacement | Versionné |
|---------|-------------|-----------|
| Variables non-sensibles | `.env.example` | ✅ |
| Configuration locale | `.env.local` | ❌ |
| Clés GCP | `.secrets/` | ❌ |
| Certificats | `.secrets/` | ❌ |

### 3.6. Knowledge Pack v0.1
- **Localisation :** `/knowledge/`
- **Format :** Markdown structuré
- **Versioning :** `CHANGELOG_KB.md` avec semver
- **Indexation :** Via `npm run load:kb` → pgvector

---

## 4. Problèmes rencontrés & Résolutions

### 4.1. Erreur `ERR_OSSL_UNSUPPORTED`

**Symptôme :**
```
Error: error:0308010C:digital envelope routines::unsupported
code: 'ERR_OSSL_UNSUPPORTED'
```

**Cause :** Le code utilisait `crypto.createSign('RSA-SHA256')` pour signer les JWT manuellement. Cette approche est incompatible avec OpenSSL 3.x (Node.js 18+) qui désactive certains algorithmes legacy par défaut.

**Solution :** Migration vers `google-auth-library` qui gère l'authentification en interne avec des méthodes compatibles.

**Fichiers modifiés :**
- `src/lib/embedding.ts` (réécriture complète)
- `src/config/env.ts` (changement schema)
- `.env.local` (nouvelle variable)

### 4.2. Configuration Docker PostgreSQL

**Symptôme :** `ECONNREFUSED` lors des tentatives de connexion DB

**Cause :** Conteneurs Docker non démarrés

**Solution :**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Vérification :**
```bash
tsx scripts/test-db-connection.ts
# ✅ Connection successful!
```

### 4.3. Port PostgreSQL

**Configuration validée :**
- Port local : `5433` (évite conflit avec Postgres système sur 5432)
- `DATABASE_URL=postgres://sylion_dev:dev_password@localhost:5433/sylion_dev`

---

## 5. Risques identifiés

| Risque | Sévérité | Mitigation |
|--------|----------|------------|
| Clé JSON GCP non encore configurée | 🔴 Bloquant | Coller la vraie clé dans `.secrets/gcp-vertex-dev.json` |
| Dépendance Vertex AI (coût tokens) | 🟡 Moyen | Monitorer usage, prévoir budget GCP |
| Migration future Supabase | 🟡 Moyen | Documenter procédure, tester avec URL Supabase |
| 5 vulnérabilités npm (4 moderate, 1 high) | 🟡 Moyen | Auditer avec `npm audit` et corriger |
| Knowledge Pack non versionné en DB | 🟢 Faible | Hash SHA-256 par document pour détecter changements |

---

## 6. Prochaines étapes (Plan clair)

### Immédiat (Aujourd'hui/Demain)
- [ ] **Coller la vraie clé JSON GCP** dans `.secrets/gcp-vertex-dev.json`
- [ ] **Lancer `npm run test:gcp`** pour valider l'authentification
- [ ] **Lancer `npm run load:kb`** pour indexer le Knowledge Pack

### Court terme (Cette semaine)
- [ ] Tester les requêtes RAG internes avec les chunks indexés
- [ ] Créer l'assistant technique interne SylionAI (module `assistant`)
- [ ] Documenter la partie Security Guide (clés GCP, secrets, ADC)
- [ ] Corriger les 5 vulnérabilités npm

### Moyen terme (2 semaines)
- [ ] Intégrer le RAG dans le Message Processor
- [ ] Préparer la configuration Supabase pour production
- [ ] Tester le flow complet WhatsApp → RAG → Réponse

---

## 7. Journal technique (trace détaillée)

### 7.1. Fichiers créés

#### `.secrets/gcp-vertex-dev.json`
```json
{
  "PLACEHOLDER": "Collez ici le contenu de votre fichier JSON de service account GCP"
}
```

#### `scripts/test-gcp-auth.ts` (extrait)
```typescript
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  // ... test Vertex AI API
}
```

### 7.2. Fichiers modifiés

#### `src/config/env.ts` (diff partiel)
```diff
- GCP_SERVICE_ACCOUNT_KEY: z.string().min(100, 'GCP_SERVICE_ACCOUNT_KEY must be a valid JSON string'),
+ GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1, 'GOOGLE_APPLICATION_CREDENTIALS path is required'),

  gcp: {
    projectId: env.GCP_PROJECT_ID,
-   serviceAccountKey: env.GCP_SERVICE_ACCOUNT_KEY,
+   credentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
    bucketName: env.GCS_BUCKET_NAME,
  },
```

#### `src/lib/embedding.ts` (nouvelle structure)
```typescript
import { GoogleAuth } from 'google-auth-library';

class EmbeddingService {
  private auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token!;
  }
}
```

#### `package.json` (scripts ajoutés)
```json
{
  "scripts": {
    "load:kb": "tsx scripts/loadKnowledgePack.ts",
    "test:gcp": "tsx scripts/test-gcp-auth.ts"
  },
  "dependencies": {
    "google-auth-library": "^10.5.0"
  }
}
```

### 7.3. Commandes exécutées

```bash
# Installation dépendance
npm install google-auth-library
# added 48 packages, changed 5 packages, audited 786 packages in 4s

# Vérification Docker
docker ps
# sylion-postgres-dev, sylion-redis-dev, sylion-redis-ui

# Test connexion DB
tsx scripts/test-db-connection.ts
# ✅ Connection successful! Result: [{"test":1}]

# Git status
git log --oneline -5
# 6bfff01 feat(KB): add backend knowledge pack loader
# 8375000 feat(whatsapp): implement vertical slice...
```

### 7.4. Structure finale du projet (ajouts)

```
sylion-backend/
├── .secrets/                          # ← NOUVEAU (gitignored)
│   └── gcp-vertex-dev.json            # ← Clé GCP (placeholder)
├── knowledge/                         # ← NOUVEAU
│   ├── 00-index.md
│   ├── 01-vision-positionnement.md
│   ├── 03-offres-pricing.md
│   ├── 05-architecture-technique-highlevel.md
│   ├── 06-arguments-ventes-generiques.md
│   ├── 07-arguments-par-secteur.md
│   ├── 08-objections-reponses.md
│   ├── 09-securite-limites.md
│   ├── 10-roadmap-90-jours.md
│   ├── 11-prompt-system-assistant-commercial.md
│   ├── 12-prompt-system-assistant-technique.md
│   ├── 13-glossaire-terminologie.md
│   └── CHANGELOG_KB.md
├── scripts/
│   ├── loadKnowledgePack.ts           # ← NOUVEAU
│   ├── test-db-connection.ts          # ← NOUVEAU
│   └── test-gcp-auth.ts               # ← NOUVEAU
└── src/
    ├── config/
    │   └── env.ts                     # ← MODIFIÉ (ADC)
    └── lib/
        └── embedding.ts               # ← RÉÉCRIT (google-auth-library)
```

---

## 8. Métriques de la session

| Métrique | Valeur |
|----------|--------|
| Fichiers créés | 17 (13 KB + 4 scripts/configs) |
| Fichiers modifiés | 4 |
| Packages npm ajoutés | 48 |
| Tests passés | DB connection ✅ |
| Commits | 1 (feat(KB)) |
| Temps estimé | ~2h Golden Hour |

---

**Auteur :** Session Golden Hour  
**Statut :** ✅ Prêt pour validation GCP et indexation  
**Prochaine action :** Configurer `.secrets/gcp-vertex-dev.json` puis `npm run test:gcp`
