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
