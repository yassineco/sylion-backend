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

# 📝 2. Décisions d’Architecture

## [2025-xx-xx] – Adoption Fastify
Raisons :
- plus performant qu’Express
- écosystème propre
- idéal pour WhatsApp webhook (low latency)

## [2025-xx-xx] – Drizzle ORM + Supabase
Raisons :
- typed SQL, migrations propres
- Supabase déjà utilisé par d’autres projets Sylion
- pgvector support natif

## [2025-xx-xx] – BullMQ obligatoire
Raisons :
- traitement IA asynchrone
- architecture scalable
- découpler HTTP du processing

---

# 🐛 3. Incidents & Résolutions

## Incident #1 – Erreur JSON dans Webhook WhatsApp
Cause probable :
- payload 360dialog non parsé
Solution :
- ajouter un `fastify.rawBody` + parser spécifique

---

# 🧠 4. Concepts appris

(Complète au fur et à mesure)

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
