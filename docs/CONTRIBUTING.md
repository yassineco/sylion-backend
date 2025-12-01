Version : 1.0
Projet : SYLION WhatsApp AI Assistant
Type : Règles strictes GitHub pour contributions backend

Merci de contribuer au projet SYLION !
Ce document décrit toutes les règles obligatoires pour contribuer au backend.
Toute Pull Request qui ne respecte pas ces règles sera automatiquement rejetée.

1. 📘 Pré-requis (à lire OBLIGATOIREMENT)

Avant toute contribution, vous devez avoir lu :

PROJECT_CONTEXT.md

ARCHITECTURE_RULES.md

ENGINEERING_STYLE_GUIDE.md

BACKEND_NAMING_CONVENTIONS.md

SECURITY_GUIDE.md

TEST_STRATEGY.md

⚠️ Si votre contribution contredit un de ces fichiers → PR rejetée.

2. 🏛️ Architecture obligatoire

Le backend SYLION est un monolithe modulaire strict.

Vous ne pouvez PAS :

créer un nouveau module sans justification architecturale

modifier la structure des dossiers

déplacer des fichiers arbitrairement

écrire de la logique métier dans les controllers

appeler la DB dans les controllers/gateways

appeler l’IA ailleurs que dans messageProcessor.worker.ts via lib/llm.ts

Vous DEVEZ :

respecter la structure par modules

appliquer la separation of concerns

protéger l’isolation multi-tenant

faire passer chaque message via la queue

respecter RAG local-first (pgvector)

3. 🧪 Tests obligatoires

Toute PR doit inclure :

tests unitaires pour les services / repositories

tests d’intégration pour les flows WhatsApp & Processor

tests d’isolation multi-tenant

mocks obligatoires (WhatsApp provider, Vertex AI, Redis)

Une contribution sans tests = refusée.

Structure des tests :

test/
├─ unit/
├─ integration/


Nom des tests :

*.unit.test.ts
*.int.test.ts

4. 🔡 Conventions de commit

Tous les commits doivent respecter le format :

type(scope): description


Types autorisés :

feat: nouvelle fonctionnalité

fix: correction de bug

refactor: amélioration interne sans changer le comportement

test: ajout/correction de tests

docs: documentation

chore: maintenance, scripts, CI

Exemples valides :

feat(assistant): add rag_mode support
fix(conversation): enforce tenant isolation when fetching a conversation
refactor(rag): extract chunking logic into dedicated helper
test(whatsapp): add normalization unit tests


❌ Interdit :
"update code", "bug fix", "wip".

5. 🧱 Travail dans les modules (obligations)
5.1. Controllers

input validation uniquement

pas de logique métier

pas d’accès DB direct

5.2. Services

logique métier seulement

signature doit inclure tenantId

vérification permissions obligatoire

5.3. Repositories

accès DB via Drizzle uniquement

filtre tenant_id obligatoire

pas de SQL brut non justifié

5.4. Workers

orchestrent conversation → RAG → IA → réponses WhatsApp

ne peuvent PAS écrire directement dans WhatsApp provider

6. 🔐 Sécurité & multi-tenant

Chaque PR doit garantir :

aucune fuite cross-tenant

filtre tenant_id systématique dans chaque requête

validation des permissions

isolation stricte RAG/phrases/usage/messages

Tout manquement → PR rejetée immédiatement.

7. 🔥 Règles IA (ChatGPT, Copilot, Cursor…)

L’utilisation d’IA est autorisée mais régulée.

Vous DEVEZ :

utiliser le fichier SYLION_CODING_PROMPT.md

charger les docs d’architecture dans toutes les sessions IA

analyser avant de générer du code

respecter strictement les conventions

Vous NE POUVEZ PAS :

appliquer un refactor global proposé par Copilot sans validation

introduire un pattern non validé (DTO, pipelines custom, CQRS…)

générer des fichiers hors structure

Si l’IA propose une modification architecturale → refuser.

8. 🔍 Checklist Pull Request (OBLIGATOIRE)

Chaque PR doit contenir cette checklist cochée :

Architecture

 Respecte PROJECT_CONTEXT.md

 Respecte ARCHITECTURE_RULES.md

 Aucun contournement des modules officiels

 Pas de logique métier dans controllers/gateways

 Pas d'accès DB hors repositories

Multi-tenant

 tenantId propagé correctement

 Requêtes filtrées par tenant_id

 Aucun accès cross-tenant possible

IA/RAG

 RAG intégré via rag.orchestrator.ts

 LLM appelé via lib/llm.ts

 Aucun appel IA ailleurs

Qualité

 Tests unitaires inclus

 Tests d’intégration inclus

 Mocks ajoutés pour providers externes

 Style TypeScript conforme (TS strict)

 Naming conventions respectées

Sécurité

 Aucun secret dans le code

 Aucun endpoint exposé inutilement

 Sanitization des inputs

Docs

 Mise à jour des docs si nécessaire

 Changelog / commentaire PR clair

Sans cette checklist → PR refusée.

9. 🧭 Workflow Git
9.1. Branches

main → production only

dev → intégration continue

feature branches → feature/<nom>

fix branches → fix/<nom>

Exemples :

feature/rag-local-improvements
fix/multi-tenant-conversation-bug
feature/assistant-config-ui


❌ Pas de commits directs sur main ou dev.

10. 🛑 Contributions interdites

refactor global sans demande explicite

suppression d’un module entier

ajout d’un module sans justification dans PR

modifications structurelles non validées

ajout de dépendances inutiles

contournement des queues (BullMQ)

contournement du RAG orchestrator

ajout de logique dans Gateway

modifier la DB sans migration Drizzle

11. 📦 Avant de soumettre la PR

Vous devez :

Lancer tous les tests

Réparer toutes les erreurs linter

Vérifier la cohérence avec l’architecture

Relire le code (self-review)

Remplir la checklist

12. 🦁 Posture attendue

Vous devez agir comme :

un gardien de l’architecture,

un développeur senior rigoureux,

un collaborateur respectant les normes entreprise,

et un professionnel responsable de la qualité.

Toute contribution doit être :

claire

propre

minimale

cohérente

testée

alignée avec SYLION

13. 🏁 Fin du CONTRIBUTING.md

Toute contribution non conforme sera refusée.
Merci de respecter l’exigence et la qualité du projet SYLION.
Vos efforts sont appréciés — construisons un produit solide, durable et professionnel.