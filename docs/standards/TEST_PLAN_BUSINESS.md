# Sylion – Plan de Tests Fonctionnels (Vue Business)

## 1. Contexte

Produit : Assistant Sylion relié à WhatsApp, multi-tenant (plusieurs clients isolés).  
Objectif : Garantir que chaque client utilise l’assistant en toute sécurité (données isolées), avec un traitement fiable des messages WhatsApp et une normalisation cohérente des numéros de téléphone.

Ce document décrit ce qui est actuellement vérifié automatiquement par les tests, en langage métier.

---

## 2. Axes de tests

1. **Communication WhatsApp (flux client final)**
2. **Isolation multi-tenant (sécurité inter-clients)**
3. **Qualité & normalisation des données (numéros de téléphone)**
4. **Résilience vis-à-vis des systèmes externes (Redis, DB)**

---

## 3. Communication WhatsApp

### 3.1. Réception d’un premier message

**Scénario :** un prospect envoie “Hello” sur le WhatsApp d’un client.

Vérifications automatisées :

- Création d’une **nouvelle conversation** pour ce numéro s’il n’en existe pas.
- Création d’un **message entrant** lié à cette conversation.
- Stockage du numéro de téléphone :
  - propre, international, préfixé par `+`
  - adapté pour la réutilisation ultérieure (relance, historique).

### 3.2. Messages pour un tenant spécifique

**Scénario :** deux entreprises utilisent Sylion, chacune avec son numéro WhatsApp.

Vérifications automatisées :

- Un message envoyé au numéro A crée une conversation **uniquement** chez l’entreprise A.
- Aucun message reçu sur A ne peut apparaître dans les données de B.
- Les jobs de traitement (queue) contiennent le bon `channelPhoneNumber` pour router le message vers le bon tenant.

---

## 4. Isolation multi-tenant (sécurité)

### 4.1. Accès aux données

Vérifications automatisées :

- Un tenant ne peut voir que :
  - ses propres **tenants infos** (profil)
  - ses **assistants**
  - ses **channels WhatsApp**
  - ses **conversations**
  - ses **messages**
- Tout accès croisé (A qui essaie de lire/mettre à jour/supprimer une ressource B) est :
  - soit **bloqué** (null / erreur contrôlée),
  - soit renvoyé vide.

### 4.2. Base de données (niveau SQL)

Vérifications automatisées :

- Les requêtes directes sur la DB filtrées par `tenantId` ne retournent que les lignes du tenant concerné.
- Cohérence des liens :
  - `conversation.tenantId == channel.tenantId`
  - `assistant.tenantId == tenant.id`  
- Aucun enregistrement ne “fuit” vers un autre tenant dans les SELECT scellés par `tenantId`.

### 4.3. Couche service

Vérifications automatisées :

- Les services métiers refusent :
  - mise à jour d’un channel d’un autre tenant,
  - suppression d’une conversation d’un autre tenant, etc.
- Les opérations de liste (list channels / assistants / conversations) ne retournent **jamais** de données hors tenant.

---

## 5. Normalisation des numéros (data quality)

### 5.1. Numéros valides

Vérifications automatisées :

- Numéro brut : `212612345678` → `+212612345678`
- Numéro déjà normalisé : `+212612345678` → inchangé
- Numéro formaté : `" +212 6 12 34 56 78 "` → `+212612345678`
- Formats internationaux variés : `+33 6 12 34 56 78`, etc.

### 5.2. Correction des bugs historiques

Vérifications automatisées :

- `++1234567890` → `+1234567890`
- `+++1234567890` → `+1234567890`
- `123+456789` → `+123456789`

Ces tests garantissent que les anciennes régressions (double `+`, `+` au milieu) ne peuvent plus revenir.

### 5.3. Entrées invalides

Vérifications automatisées :

- Chaîne vide `""` → `""`
- `"+"`, `"   "`, `"()-  "` (aucun chiffre) → `""`  
- Chaînes avec lettres → suppression des lettres, conservation des chiffres (`abc123def` → `+123`)

**Règle métier :**  
> Toute entrée sans chiffre est considérée comme invalide et transformée en chaîne vide.

---

## 6. Résilience & cache

### 6.1. Cache Redis

Vérifications automatisées :

- Après création/suppression d’un assistant, les clés de cache liées au tenant sont invalidées correctement.
- Le comportement métier reste cohérent même lorsque le cache est mocké (tests d’intégration).

---

## 7. Gaps & prochaines étapes (TODO)

À ajouter dans une prochaine itération :

- ✅ Tests d’intégration pour le **flux sortant** (réponse envoyée par l’assistant → envoi WhatsApp sortant).
- ✅ Tests d’erreur :
  - échec de l’API WhatsApp,
  - indisponibilité de Redis,
  - timeouts DB.
- ✅ Tests de charge (volume de messages / multi-tenants en parallèle).
- ✅ Tests E2E “black box” avec un environnement de staging (simulateur WhatsApp).

Ce document est une photo de ce qui est déjà verrouillé par les tests automatiques, et des zones encore à couvrir.
