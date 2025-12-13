# 📒 Sylion Backend – Learning Log

Journal d’apprentissage, décisions techniques, incidents, choix d’architecture.  
Ce document est destiné à devenir la mémoire technique du projet.

---

# 🔥 1. Vision du Logging

Utilisé pour :
- garder trace des décisions importantes
- éviter de refaire les mêmes erreurs
- documenter les choix techniques
- former les futurs développeurs SylionTech

Mettre à jour **après chaque milestone / bug important / refactor**.

---

# 📝 2. Décisions d'Architecture

## [2025-12-02] – Architecture TSConfig 4-Configs

### Problème rencontré

Le projet souffrait de conflits majeurs entre :
1. **Build production** : nécessite TypeScript STRICT pour garantir la qualité
2. **Tests** : nécessite des règles relâchées (mocks, fixtures, données partielles)
3. **VS Code IntelliSense** : affichait des erreurs parasites dans les tests

Symptômes :
- `strictPropertyInitialization` bloquait les mocks incomplets
- `noImplicitAny` causait des erreurs dans les fixtures de test
- VS Code Problems affichait 50+ erreurs dans les fichiers de test
- Les développeurs contournaient avec `@ts-ignore` (mauvaise pratique)

### Solution implémentée : Three-Layer TSConfig

```
tsconfig.base.json          ← STRICT config partagée (core rules)
    ↓
    ├── tsconfig.json       ← VS Code IntelliSense (src + test)
    ├── tsconfig.build.json ← Production build (src only, STRICT)
    └── tsconfig.test.json  ← Jest tests (relaxed rules)
```

**Principe** : Séparation des responsabilités
- Le code source (`src/`) est TOUJOURS compilé en mode STRICT
- Les tests (`test/`) utilisent des règles relâchées
- VS Code utilise une config qui inclut tout sans bloquer le développement

### Lessons Learned

1. **Une seule config TypeScript ne convient pas à tous les cas d'usage**
   - Production et tests ont des besoins différents
   - L'IDE a besoin d'une vue globale sans erreurs parasites

2. **L'héritage TypeScript (`extends`) est puissant**
   - Permet de partager un trunk strict
   - Les configs enfants peuvent relaxer sans dupliquer

3. **VS Code utilise `tsconfig.json` par défaut**
   - Il faut le configurer pour l'expérience éditeur
   - Les builds CI/CD doivent utiliser une config explicite

4. **Les scripts npm clarifient l'intention**
   ```json
   "build": "tsc -p tsconfig.build.json",  // STRICT
   "test": "jest",                          // relaxed via ts-jest
   ```

### Conséquences pour les modules multi-tenant

- Le code source multi-tenant reste STRICT (sécurité garantie)
- Les tests peuvent mocker les données tenant sans friction
- Pas de risque de relâcher accidentellement les règles de prod
- Les futures features RAG/WhatsApp bénéficient de cette séparation

### Fichiers impactés

```
tsconfig.base.json     (créé)
tsconfig.build.json    (refactoré)
tsconfig.test.json     (refactoré)
tsconfig.json          (simplifié)
package.json           (scripts mis à jour)
jest.config.js         (pointe vers tsconfig.test.json)
```

---

## [2025-11-29] – Migration imports relatifs vs alias
Raisons :
- imports @/* causaient erreurs TypeScript dans VS Code
- meilleure compatibilité avec tsx et compilation
- évite dépendance à la configuration tsconfig paths

## [2025-11-29] – Configuration VS Code dédiée
Raisons :
- améliorer DX (Developer Experience)
- résolution modules TypeScript optimisée
- settings.json pour cohérence équipe

## [2025-xx-xx] – Adoption Fastify
Raisons :
- plus performant qu'Express
- écosystème propre
- idéal pour WhatsApp webhook (low latency)

## [2025-xx-xx] – Drizzle ORM + Supabase
Raisons :
- typed SQL, migrations propres
- Supabase déjà utilisé par d'autres projets Sylion
- pgvector support natif

## [2025-xx-xx] – BullMQ obligatoire
Raisons :
- traitement IA asynchrone
- architecture scalable
- découpler HTTP du processing

---

# 🐛 3. Incidents & Résolutions

## Incident #4 – Conflits TSConfig Tests vs Production
**Date :** 2 décembre 2025
**Cause :** 
- Un seul `tsconfig.json` pour production ET tests
- Règles `strictPropertyInitialization`, `noImplicitAny` bloquaient les mocks
- VS Code affichait 50+ erreurs dans les fichiers de test
- Développeurs contournaient avec `@ts-ignore` (dette technique)
**Solution :**
- Architecture 4-configs : base → build/test/editor
- `tsconfig.base.json` = trunk STRICT partagé
- `tsconfig.build.json` = production STRICT
- `tsconfig.test.json` = tests relaxed
- `tsconfig.json` = editor IntelliSense
**Résultat :**
- 0 erreur VS Code Problems
- 147 tests passent
- Build production STRICT intact
- Scripts npm clarifiés

## Incident #3 – Erreurs imports TypeScript (@/)
**Date :** 29 novembre 2025
**Cause :** 
- imports alias @/* non résolus dans tenant.controller.ts
- TenantService module introuvable malgré existence
- configuration VS Code TypeScript incomplète
**Solution :**
- migration vers imports relatifs (../../lib/http)
- ajout .vscode/settings.json et tsconfig.json
- validation avec npm run type-check

## Incident #2 – Configuration chemins modules
**Date :** 29 novembre 2025
**Cause :** 
- tsconfig paths non correctement interprétés
- tsx vs TypeScript compiler différences
**Solution :**
- uniformisation avec imports relatifs
- configuration VS Code dédiée

## Incident #1 – Erreur JSON dans Webhook WhatsApp
Cause probable :
- payload 360dialog non parsé
Solution :
- ajouter un `fastify.rawBody` + parser spécifique

---

# 🧠 4. Concepts appris

(Complète au fur et à mesure)

- **Imports TypeScript** : Différence entre path aliases et imports relatifs pour compatibilité
- **VS Code configuration** : Impact settings.json sur résolution modules TypeScript
- **tsx vs tsc** : Différences compilation et résolution modules
- **Developer Experience** : Configuration IDE critique pour productivité équipe
- RAG local vs RAG hybride (Vertex)
- Patterns multi-tenant (tenantId dans toutes les entités)
- Reverse proxy Nginx clair vs Cloudflare Zero Trust
- Vertex AI → quotas, cold starts, rate limits

---

# 🚀 5. À surveiller / TODO futur

- passage à Cloud Run si charge augmente
- monitoring Prometheus + Grafana Cloud
- signature cryptographique des webhooks
- quotas dynamiques par tenant
- refactor workers en micro-services

---

# ✔️ 6. Post-mortems

## Release v0.1 (WhatsApp Only)
Ce qui a bien fonctionné :
- architecture propre
- workers isolés

Ce qui est améliorable :
- logs trop bavards
- manque d’outils pour rejouer un message entrant
