# 13 – Glossaire & Terminologie Officiels SylionAI

Ce document définit le vocabulaire officiel utilisé dans SylionAI pour garantir une cohérence absolue entre les équipes techniques, commerciales et produit.

---

# 🟦 1. Terminologie Produit & Business

## Assistant
Entité IA configurée pour un tenant.  
Possède :
- un rôle (commercial, support, qualification…)
- un prompt système
- un comportement paramétrable
- une base de connaissance associée (optionnel)

## Lead
Personne qui contacte le client via WhatsApp et qui peut devenir un prospect qualifié.

## Qualification
Processus consistant à poser des questions structurées pour filtrer un lead (budget, zone, symptômes, disponibilité…).

## Script de qualification
Suite de questions prédéfinies propres au secteur (clinique, école, immobilier…).

## RAG (Retrieval Augmented Generation)
Mécanisme permettant à l'assistant d'utiliser :
- les documents du client
- les PDFs
- les pages web  
pour répondre avec précision.

---

# 🟦 2. Terminologie WhatsApp & Canal

## Channel
Un numéro WhatsApp Business relié à un tenant.

## End User
L'utilisateur final qui envoie un message WhatsApp (prospect ou client final).

## Conversation
Ensemble de messages échangés entre un end_user et un assistant.  
Identifié par :
- channel_id  
- end_user_id  
- tenant_id  

## Interaction
Un message unique échangé (texte, image, fichier).  
Les interactions sont liées à une conversation.

## Provider
Service externe gérant l'accès WhatsApp :
- 360dialog  
- Meta Cloud API  

---

# 🟦 3. Terminologie Technique (Backend)

## Gateway
Service qui :
- reçoit les webhooks WhatsApp  
- valide les signatures  
- normalise les messages  
- publie dans la queue pour traitement  

## Queue
Mécanisme BullMQ permettant d'absorber de gros volumes sans bloquer le système (traitement asynchrone).

## Worker
Processus chargé d'exécuter un travail spécifique.  
Exemples :
- message processor  
- RAG indexer  
- documents importer  

## Message Processor
Worker principal.  
Pipeline complet :

1. Récupère message de la queue  
2. Charge contexte conversation  
3. Vérifie quotas & droits  
4. RAG (si activé)  
5. Appel LLM  
6. Génération réponse  
7. Logs & usage  
8. Retour à Gateway  

## Orchestrator
Logique qui assemble :
- prompts système  
- contexte conversationnel  
- RAG  
- règles métiers  
pour construire la requête finale au LLM.

---

# 🟦 4. Terminologie Données / RAG

## Knowledge Base (KB)
Ensemble structuré de documents attachés à un tenant.

## Knowledge Document
Document brut (PDF, DOCX, MD…) fourni par le client.

## Chunk
Fragment textuel extrait d'un document, vectorisé pour RAG.

## Embedding
Représentation vectorielle d'un texte, utilisée pour calcul de similarité.

## Vector Store
Base de données spécialisée (pgvector) stockant les embeddings.

## Relevance Score
Score indiquant la pertinence d'un chunk pour une requête donnée.

---

# 🟦 5. Terminologie Sécurité

## Guardrails
Ensemble de règles, prompts et filtres empêchant :
- abus
- prompt injection
- demandes illégales
- erreurs critiques

## Rate Limiting
Restriction du nombre d'appels pour :
- éviter abus  
- protéger usage LLM  
- sécuriser WhatsApp  

## Isolation Tenant
Principe garantissant qu'aucune donnée d'un tenant ne peut être utilisée par un autre (y compris RAG).

---

# 🟦 6. Terminologie Monitoring & Usage

## Usage Record
Trace de consommation :
- tokens LLM  
- appels RAG  
- messages traités  

## Quota
Limite définie par offre ou tenant pour contrôler consommation.

## Metric
Indicateur de performance (latence, taux d'erreur, nombre de messages…).

---

# 🟦 7. Terminologie Roadmap / Releases

## Release
Version d'une fonctionnalité documentée, publiée en production.

## Versioning
Méthodologie de suivi des changements (Semantic Versioning).

## Incident
Problème impactant une partie de la plateforme (WhatsApp, LLM, DB).

## Hotfix
Correctif rapide appliqué en production pour restaurer un fonctionnement critique.

---

# 🟩 Fin du Glossaire
Ce glossaire doit évoluer à mesure que SylionAI grandit. Tout ajout doit être consigné dans le `CHANGELOG_KB.md`.
