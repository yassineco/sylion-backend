# 🦁 Sylion Backend – Guide de Contribution

Bienvenue dans le backend principal de la plateforme **SylionAI**.  
Ce document décrit **les règles officielles** pour contribuer au projet, assurer une qualité constante et maintenir une architecture robuste.

Même si tu développes seul au début, ces règles garantissent la cohérence long terme du code et facilitent l’arrivée d’un futur développeur SylionTech.

---

# 🚀 1. Prérequis

Avant de contribuer, assure-toi d’avoir :

- Node.js 20+
- Docker + Docker Compose
- Un accès à la DB Supabase (PostgreSQL + pgvector)
- Un accès GCP pour Vertex AI
- Un `.env` local valide (jamais commité)

---

# 🧭 2. Workflow Git Officiel

Le projet suit le workflow suivant :

```
main      → version stable, déployée en prod
develop   → intégration continue des features
feature/* → nouvelles fonctionnalités
fix/*     → corrections
chore/*   → maintenance, CI/CD, docs
```

### 🔧 Créer une nouvelle branche

```
git checkout develop
git pull
git checkout -b feature/nom-feature
```

---

# 📝 3. Normes de Commit (Conventional Commits)

Chaque commit doit suivre le format :

```
type(scope): message court
```

### Types autorisés :
- **feat** : nouvelle fonctionnalité  
- **fix** : correction de bug  
- **chore** : changements sans impact métier  
- **refactor** : amélioration du code  
- **docs** : documentation  
- **test** : ajout/maj de tests  

### Exemples :

```
feat(whatsapp): add webhook route
fix(rag): correct embedding chunk index
chore(db): add drizzle migration for assistants table
docs: update engineering rules
```

---

# 🔄 4. Pull Requests – Règles obligatoires

Avant de soumettre une PR :

### ✔️ Checklist Qualité

- [ ] Tests locaux OK  
- [ ] Linter OK (`npm run lint`)  
- [ ] Code tapé strict (pas de `any`)  
- [ ] Services sans logique dupliquée  
- [ ] Logs nettoyés  
- [ ] Pas de données sensibles dans les logs (ex : numéros WhatsApp → masqués)  
- [ ] Migration Drizzle générée si nécessaire  
- [ ] Documentation mise à jour si impact architecture  

### ✔️ Checklist Sécurité

- [ ] Aucun secret dans la PR  
- [ ] Aucun fichier `.env`  
- [ ] Aucune clé dans les exemples ou captures  

---

# 🧩 5. Structure du Code (obligatoire à respecter)

Le projet suit une architecture **clean & modulaire** :

```
src/
  app/        → serveur, routes globales, middlewares
  modules/    → logique métier segmentée
  db/         → drizzle, migrations
  jobs/       → workers BullMQ
  lib/        → outils généraux
  config/     → environnement
```

### 📦 Modules (DDD léger)

Chaque module doit suivre :

```
module/
  module.routes.ts
  module.controller.ts
  module.service.ts
  module.types.ts
```

### ❌ Interdictions

- Pas de logique métier dans les routes  
- Pas d’accès DB direct dans les controllers  
- Pas de code non typé  
- Pas de dépendances circulaires  

---

# 🔥 6. Ajouter un nouveau module

Pour créer un nouveau module (ex : `billing/`) :

1. Créer le dossier :
   ```
   src/modules/billing/
   ```

2. Ajouter les fichiers :
   ```
   billing.routes.ts
   billing.controller.ts
   billing.service.ts
   billing.types.ts
   ```
3. Ajouter la migration Drizzle si nécessaire  
4. Exposer les routes dans `app/routes.ts`  
5. Ajouter les tests unitaires  
6. Documenter dans `LEARNING_LOG.md` les décisions importantes  

---

# 📡 7. Workers & Job Queue (BullMQ)

Principes :
- Tout traitement lourd passe dans **jobs/**  
- Le thread HTTP doit rester rapide  
- Usage de Redis centralisé (lib/redis.ts)  
- Chaque worker doit être autonome  

Pour ajouter un worker :

```
jobs/myWorker.worker.ts
```

Et l'enregistrer dans `jobs/index.ts`.

---

# 🧠 8. Règles TypeScript

- Pas de `any`  
- Jamais de logique sans types  
- Utiliser Zod pour valider les entrées utilisateur  
- Retourner des objets typés depuis les services  
- Typage strict des messages WhatsApp et Vertex  

---

# 🔐 9. Sécurité (critique)

Voir : `docs/SECURITY_GUIDE.md`

Résumé :

### ❌ Interdit
- Commettre un `.env`  
- Coller une clé Vertex/WhatsApp dans Copilot/ChatGPT  
- Logger des informations sensibles  
- Mettre un fichier JSON de service account dans le repo  

### ✔️ Obligatoire
- Masquer les numéros (`+2126xxxxxxx`)  
- Valider les Webhooks WhatsApp  
- Nettoyer les logs avant PR  

---

# 🧪 10. Tests

Les tests (Jest/Vitest) doivent couvrir :

- services (logique métier)  
- parseurs WhatsApp  
- workers (simulation job)  
- RAG (mock embeddings)  

Pas besoin de tester les routes directement → tester les services.

---

# 🧭 11. Process de Release

1. Merger les PR dans `develop`  
2. Tester la branche en staging (local ou VPS test)  
3. Merger dans `main`  
4. Déployer  
5. Tag version (ex : `v0.1.0`)  

---

# 📚 12. Ressources internes

- [Règles d’ingénierie](./docs/ENGINEERING_RULES.md)
- [Guide de sécurité](./docs/SECURITY_GUIDE.md)
- [Learning Log](./docs/LEARNING_LOG.md)

---

# 🙌 Merci

Chaque contribution doit améliorer la stabilité, la lisibilité ou la sécurité du système.  
SylionBackend est un produit long terme → garde en tête la vision à 5 ans.

