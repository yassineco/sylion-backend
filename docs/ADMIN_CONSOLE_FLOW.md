# 🦁 ADMIN_CONSOLE_FLOW.md — SYLION ADMIN CONSOLE UX FLOW
**Version : 1.0**  
**Objectif : Décrire le parcours complet de la Console Admin SYLION**  
**Projet : SYLION WhatsApp AI Assistant (multi-tenant)**  
**Audience : Designers, Développeurs React, IA (Copilot/Cursor), Product Owner**

---

# 1. 🎯 Vision de la Console Admin

La **SYLION Admin Console** est l’interface SaaS permettant à chaque entreprise (tenant) de :

- Configurer son assistant WhatsApp  
- Gérer ses documents RAG  
- Suivre ses conversations  
- Visualiser son usage & quotas  
- Gérer ses channels WhatsApp  
- Gérer ses assistants IA  
- Monitorer les messages entrants  
- Accéder au debug (logs tenant isolés)  
- Mettre à jour les paramètres de leur plan  

**Principes UX clés :**
- Simple  
- Rapide  
- Mobile-friendly  
- Zero confusion  
- Pro-level, inspirée de : Stripe Dashboard, Supabase, Intercom  

---

# 2. 🧱 Structure globale de la Console

## Layout général
┌─────────────────────────────┐
│ Sidebar │
├─────────────────────────────┤
│ Header (tenant switch) │
├─────────────────────────────┤
│ Content │
└─────────────────────────────┘

markdown
Copier le code

## Sidebar (menus)
- Dashboard  
- Conversations  
- Messages  
- Assistants  
- Channels  
- Knowledge Base  
- Usage  
- Settings  
- Logs (future)  
- Billing (future)

---

# 3. 🏠 SCREEN 1 — Dashboard (Home)

**Objectif : Vue d'ensemble du tenant**

### Contenu :
- Carte “Activity Today”
  - # messages reçus  
  - # réponses envoyées  
  - # intents détectés  
- Carte “Usage Summary”
  - tokens input/output  
  - messages/mois  
  - RAG calls  
- Carte “Assistant Status”
  - actif / inactif  
  - modèle LLM  
  - provider  
- Carte “WhatsApp Channel”
  - numéro  
  - statut provider  
  - trafic des 24 dernières heures  

### Actions rapides :
- “Voir Conversations”
- “Gérer Assistant”
- “Uploader Document RAG”
- “Configurer WhatsApp”

---

# 4. 💬 SCREEN 2 — Conversations

**Objectif : gérer les discussions WhatsApp en temps réel**

### Layout :
Sidebar conversation list | Conversation thread | Assistant info panel

markdown
Copier le code

### Liste des conversations :
- dernière réponse  
- statut : open / closed  
- channel  
- timestamp  
- recherche + filtre

### Thread :
- messages user & assistant  
- timestamps  
- icônes (user/IA)  
- tags intents (optionnel)

### Actions :
- “Close Conversation”
- “Export Thread”
- “View Metadata”

### API utilisées :
GET /api/admin/conversations
GET /api/admin/conversations/:id
POST /api/admin/conversations/:id/close
GET /api/admin/messages?conversation_id=...

yaml
Copier le code

---

# 5. ✉️ SCREEN 3 — Messages (log brut)

**Objectif : monitoring technique**

Affiche tous les messages entrants/sortants triables :

- message_id  
- conversation_id  
- sender (user / assistant)  
- token usage  
- response_time  
- rag_used: true/false  
- model: gemini-1.5-flash | etc.

### API :
GET /api/admin/messages

markdown
Copier le code

---

# 6. 🤖 SCREEN 4 — Assistants

### Vue liste
- nom  
- langue  
- modèle  
- rag_enabled  
- rag_mode  
- channels liés  

### Vue détail
Onglets :

#### 1. **General**
- Nom  
- Description  
- Langue  
- Prompt système (editable textarea)  
- Bouton : “Test Assistant”

#### 2. **LLM Settings**
- modèle LLM  
- température  
- max tokens  
- rag_enabled toggle  
- rag_mode : local / vertex  

#### 3. **Channels**
- Liste de channels connectés  
- Bouton : “Lier un channel”

### Actions API :
GET /api/admin/assistants
POST /api/admin/assistants
PATCH /api/admin/assistants/:id
POST /api/admin/assistants/:id/bind

yaml
Copier le code

---

# 7. 📱 SCREEN 5 — Channels (WhatsApp)

### Liste des channels :
- Numéro WhatsApp  
- Provider (360dialog / Meta)  
- Webhook status  
- Assistant lié  
- Date de dernière synchronisation  

### Vue détail :
- Paramètres provider  
- Credentials chiffrés  
- Bouton “Tester envoi WhatsApp”  
- Bouton “Regénérer tokens provider”

### APIs :
GET /api/admin/channels
POST /api/admin/channels
PATCH /api/admin/channels/:id

yaml
Copier le code

---

# 8. 📚 SCREEN 6 — Knowledge Base (RAG)

### Vue liste KB :
- Nom  
- # documents  
- Dernière indexation  
- Taille cumulative  

### Vue détail KB :
Documents list | Document preview (PDF) | Status RAG

markdown
Copier le code

### Actions possibles :
- Upload document (PDF, Word)  
- Voir le statut :
  - uploaded  
  - indexing  
  - ready  
- Supprimer document  
- Forcer ré-indexation  
- Test RAG (petit champ input question)

### APIs :
GET /api/admin/knowledge/bases
POST /api/admin/knowledge/bases
POST /api/admin/knowledge/documents
GET /api/admin/knowledge/documents
GET /api/admin/knowledge/documents/:id

markdown
Copier le code

### Flow de l’indexation :
1. Upload → “uploaded”  
2. Worker `rag-indexing` → “indexing”  
3. Embeddings + insertion chunks → “ready”  

---

# 9. 📊 SCREEN 7 — Usage & Quotas

### Graphiques :
- Tokens (input/output) → courbe  
- Messages → histogramme  
- RAG calls → courbe  
- Storage → jauge  
- Comparaison plan → limites

### Détails :
- usage mensuel  
- limites du plan  
- projection mensuelle  
- alertes (approche limite)

### API :
GET /api/admin/usage

yaml
Copier le code

---

# 10. ⚙️ SCREEN 8 — Settings (Tenant)

### Informations tenant :
- Nom  
- Type de plan  
- Date de création  
- Domaines autorisés  
- Clés API internes  

### Actions :
- “Regénérer API Key”  
- “Supprimer tenant” (danger zone)  
- “Mettre à jour plan (future billing)”

### API :
GET /api/admin/tenants/:tenantId
PATCH /api/admin/tenants/:tenantId

yaml
Copier le code

---

# 11. 📜 SCREEN 9 — Logs (future)

### Logs par tenant :
- filtres : error / warn / info  
- worker logs  
- webhook logs  
- ratelimit logs  
- rag logs  
- usage logs  

### Source :  
via Grafana Cloud ou stockage interne (optionnel)

---

# 12. 💳 SCREEN 10 — Billing (future)

### Fonctionnalités prévues :
- Paiements Maroc (CIH Pay / Wafacash / Stripe EU)  
- Visualisation du plan  
- Factures PDF  
- Crédit tokens  
- Consommation quasi temps réel

---

# 13. 🧩 Flux techniques Admin Console

### 13.1. Authentification
L’Admin Console utilise :

- un JWT Admin  
- + header obligatoire `X-Tenant-Id`

### 13.2. Interaction avec le backend
Frontend Next.js ↔ Backend SYLION (Fastify)

### 13.3. Data fetching
- React Query  
- cache intelligent par tenant  
- invalidations lors des actions (upload, bind, create)

---

# 14. 🧠 Flow complet “Créer un client SYLION” (Admin)

1. Admin crée un tenant  
2. Ajoute channel WhatsApp  
3. Crée assistant  
4. Lie assistant au channel  
5. Crée Knowledge Base  
6. Upload documents RAG  
7. Test WhatsApp  
8. Suivi via Dashboard  
9. Monitoring via Usage  
10. Ajustements assistant (prompt, modèle, réglages)

---

# 15. 🦁 Règles UX

- Aucun écran ne doit exposer plusieurs tenants simultanément  
- Le tenant actuel doit être visible en permanence (header)  
- Les actions critiques doivent avoir double confirmation  
- Les zones “danger” doivent être dans une section séparée  
- Le RAG doit montrer statut clair (uploaded, indexing, ready)  
- Toute erreur doit être claire et actionable  
- Toutes les données doivent être paginées (sécurité & performance)  

---

# 16. 📎 Liens utiles pour dev frontend

- `API_REFERENCE.md` → routes + payloads  
- `API_USE_CASES_EXAMPLES.md` → scénarios réels  
- `BACKEND_ONBOARDING.md` → architecture backend  
- `SYLION_CODING_PROMPT.md` → prompt IA pour générer du code cohérent  

---

# 17. 🏁 Conclusion

Cette documentation définit **le parcours complet** de l’Admin Console SYLION :

- écrans  
- flux  
- interactions  
- contraintes  
- API utilisées  
- UX rules  

Elle sert à :
- développer la console  
- concevoir son design / wireframes  
- guider les IA génératrices (Copilot, Cursor, ChatGPT)  
- onboarder les développeurs frontend

Fin du ADMIN_CONSOLE_FLOW.md