# 🧪 Sylion Backend – AUDIT_CHECKLIST.md  
> Check-list d’auto-audit avant commit / merge / déploiement

Cette check-list sert à **contrôler ce que Copilot (ou toi) a modifié**,  
et à éviter de casser l’architecture, la sécurité ou le multi-tenant.

Statuts à utiliser : ✅ OK · ⚠️ À revoir · ❌ KO

---

## 0. Contexte du changement

- [ ] J’ai noté dans `docs/LEARNING_LOG.md` ce que je suis en train de changer.
- [ ] Je sais **quelle phase** de la roadmap je touche (Phase 2, 4, 5, …).
- [ ] Je sais si le changement est : bugfix / feature / refactor / infra.

---

## 1. Discipline de base

- [ ] `npm run build` passe **sans erreur**.
- [ ] `npm run lint` (ou équivalent) passe ou les warnings sont compris/assumés.
- [ ] Aucun fichier `.env` ou secret n’a été ajouté/commité.
- [ ] Les imports utilisent `@/...` et pas des chemins relatifs dégueulasses (`../../..`) sauf cas très particulier.

---

## 2. Schéma DB & Drizzle

Pour tout changement touchant `src/db/drizzle/schema.ts` ou un service :

- [ ] Chaque nouvelle table a :
  - [ ] une clé primaire claire,
  - [ ] les bons index (tenantId, foreign keys, etc.),
  - [ ] des relations définies (`references`) si nécessaire.
- [ ] Si j’ai ajouté/modifié une table :
  - [ ] une migration Drizzle a été générée.
  - [ ] la migration a été testée en local.
- [ ] Chaque requête Drizzle dans les services :
  - [ ] filtre correctement par `tenantId` quand c’est pertinent.
  - [ ] n’utilise pas de `any` ou de cast sauvage.
  - [ ] n’oublie pas le `where` (pas de `db.select().from(table)` global sur toute la base en prod).

---

## 3. Multi-tenant & isolation des données

Pour tout code qui touche `tenant`, `channel`, `assistant`, `conversation`, `message` :

- [ ] Je peux expliquer **comment le tenant est déterminé** (pas de “tenant par défaut magique”).
- [ ] Chaque accès aux données métier filtre sur `tenantId` ou passe par un service qui le fait.
- [ ] Aucune route admin n’expose des données de tous les tenants sans filtre.
- [ ] `channel_bindings` (quand présent) ne permet pas de relier le même numéro WhatsApp à plusieurs tenants de manière ambiguë.

---

## 4. WhatsApp Gateway (webhook)

Pour tout changement dans `src/modules/whatsapp/*` :

- [ ] Le webhook **ne fait presque rien** : parse, normalise, push dans BullMQ.  
  (Pas de logique métier lourde dans la route.)
- [ ] Le token de verification ou signature est **vérifié**.
- [ ] En cas de problème, la route renvoie un status HTTP cohérent (4xx ou 5xx), pas un 200 silencieux.
- [ ] Les logs du webhook :
  - [ ] ne dumpent pas le payload complet en production (juste un résumé),
  - [ ] ne loguent pas les tokens ou secrets.

---

## 5. BullMQ & Workers

Pour toute modification dans `src/jobs/*` :

- [ ] Chaque **queue** a un nom clair et (si possible) vient d’`env`.
- [ ] Chaque **worker** est enregistré une seule fois.
- [ ] Les jobs ont une politique de retry raisonnable (pas de retry infini silencieux).
- [ ] En cas d’erreur dans un job :
  - [ ] l’erreur est loguée de façon structurée,
  - [ ] l’erreur ne fait pas tourner le worker en boucle infinie.
- [ ] Si le job crée des entités (conversation, message, etc.) :
  - [ ] le code est **idempotent** autant que possible (pas de doublons massifs si le job rejoue).

---

## 6. LLM / IA (`lib/llm.ts` & futurs RAG)

Même si c’est encore un stub :

- [ ] Les messages passés à l’IA sont filtrés :
  - [ ] par conversation,
  - [ ] par tenant,
  - [ ] triés par date,
  - [ ] avec une limite de nombre de messages.
- [ ] Les erreurs d’IA (timeout, quota, crash) sont gérées proprement :
  - [ ] log + fallback,
  - [ ] message clair au user si besoin (“Le service est temporairement indisponible”).
- [ ] Je n’envoie pas des données inutiles ou sensibles au LLM.

---

## 7. Sécurité & secrets

- [ ] Toutes les clés / URLs / tokens viennent de `src/config/env.ts` + `.env`, jamais en dur.
- [ ] Les nouvelles variables d’env sont :
  - [ ] ajoutées dans `envSchema` (Zod),
  - [ ] typées correctement,
  - [ ] documentées (README ou commentaire).
- [ ] Aucune stack trace brute ou payload complet n’est renvoyé au client en réponse HTTP.
- [ ] Pas de `console.log` laissé pour le debug dans le code métier/infra.

---

## 8. Routes & API

Pour chaque nouvelle route ou modification dans `routes.ts` / `*.routes.ts` :

- [ ] La route est clairement nommée (`/api/admin/...`, `/webhooks/whatsapp`, etc.).
- [ ] Les schémas d’entrée sont validés (Zod ou autre) :
  - [ ] types corrects,
  - [ ] contraintes (min/max/enum) raisonnables.
- [ ] Les routes admin ne sont pas exposées sans protection (auth/ACL à prévoir).
- [ ] La route ne duplique pas la logique métier :  
  elle appelle un service dédié plutôt que de faire des requêtes DB directes.

---

## 9. Qualité du code & lisibilité

- [ ] Aucun `any` non justifié.
- [ ] Les noms de fonctions/méthodes sont explicites (`createTenant`, `resolveChannelFromPhone`, etc.).
- [ ] Les fonctions ne font pas 200 lignes chacune (penser “une responsabilité”).
- [ ] Les commentaires expliquent le **pourquoi**, pas le “ce que fait la ligne”.

---

## 10. Avant commit / push

- [ ] `npm run build` ✅
- [ ] `npm run lint` ✅ (ou warnings compris/acceptés)
- [ ] `git status` propre (pas de fichiers oubliés, pas de fichiers temporaires)
- [ ] J’ai mis à jour si nécessaire :
  - [ ] `docs/LEARNING_LOG.md`
  - [ ] `docs/PROGRESS_REPORT_YYYY_MM_DD.md`
  - [ ] `docs/ROADMAP_PHASES.md` (si une phase a avancé)

---

## 11. Avant déploiement (VPS / Prod)

- [ ] Les variables d’environnement nécessaires sont configurées sur la cible (VPS, Supabase, GCP).
- [ ] J’ai testé `/health` sur l’environnement cible.
- [ ] J’ai testé au moins un scénario complet (ex : message WhatsApp → IA → réponse).
- [ ] J’ai vérifié les logs (pas de flood d’erreurs silencieuses).
- [ ] J’ai au moins une **stratégie de rollback** (docker image précédente, branch stable, etc.).

---

## 12. Règle d’or

> Si je ne comprends pas 100 % d’un changement proposé par Copilot,  
> je **n’accepte pas** le code tel quel.  
> Je le fais réexpliquer, je le simplifie, ou je l’écris moi-même.

---
