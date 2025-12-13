# 🦁 ADMIN_CONSOLE_ROADMAP.md  
**Version : 1.0**  
**Projet : SYLION AI Assistant — Admin Console**  
**Objectif : Livrer une Console Admin complète en ~30 jours (MVP → V1)**  
**Audience : Product, Dev Frontend, Dev Backend, IA (Copilot/Cursor/Continue)**

---

# 1. 🎯 Vision

La Console Admin SYLION permet aux entreprises de :

- Configurer leur assistant IA  
- Gérer leurs channels WhatsApp  
- Uploader & gérer leurs documents RAG  
- Suivre leurs conversations  
- Monitorer leur consommation  
- Gérer leurs paramètres de tenant  
- Se préparer au billing  

Cette Roadmap vise à livrer **un produit utilisable commercialement**, sans compromis sur :

- sécurité  
- multi-tenant  
- UX professionnelle  
- cohérence design system  
- stabilité backend  

---

# 2. 🗺️ Vue d’ensemble des phases (30 jours)

| Phase | Durée | Objectif |
|------|--------|----------|
| Phase 0 | 1 jour | Setup & bootstrap du front |
| Phase 1 | 6 jours | Layout + Navigation + Tenants |
| Phase 2 | 6 jours | Conversations + Messages |
| Phase 3 | 6 jours | Assistants (General, LLM, Channels, Test) |
| Phase 4 | 5 jours | Channels (WhatsApp) |
| Phase 5 | 4 jours | Knowledge Base (RAG) |
| Phase 6 | 2 jours | Usage + Quotas |
| Phase 7 | 2 jours | Settings |
| Phase 8 | 2 jours | Stabilisation + Tests + Polish |

Total : **30 jours**

---

# 3. 🧱 Phase 0 — Bootstrap (jour 1)

### Objectifs :
- Initialiser projet frontend  
- Configurer Stack  
- Intégrer Design System  

### Tâches :
- Créer projet Next.js 14 (App Router)
- Installer Tailwind
- Installer shadcn/ui (+ init components)
- Ajouter tokens design system (SYLION_UI_DESIGN_SYSTEM.md)
- Ajouter structure dossiers (`components/`, `features/`, etc.)
- Intégration React Query
- Setup API client tenant-aware
- Setup auth (admin API key) → dev only
- Créer layout global + dark mode only

### Livrables :
- Repo frontend avec structure validée
- Theme dark SYLION opérationnel
- Layout minimal fonctionnel

### Critères d'acceptation :
- Page `/` affiche “Hello Sylion”
- Sidebar & Topbar skeleton OK

---

# 4. 🧭 Phase 1 — Layout, Navigation, Dashboard (jours 2 → 7)

### Objectifs :
- Avoir structure stable et ergonomique
- Avoir un Dashboard utilisable

### Fonctionnalités :
- Sidebar (menu complet)
- TopBar (tenant switcher)
- Pages vides des sections
- Dashboard (cards + mini charts)

### Dépendances :
- API usage
- API tenant

### Livrables :
- `<AppShell />`
- `<SidebarNav />`
- `<TopBar />`
- Page “Dashboard” (avec données réelles)

### Critères d'acceptation :
- Navigation fluide entre sections
- Dashboard montre :
  - messages du jour  
  - tokens utilisés  
  - statut assistant  
  - statut channel  

---

# 5. 💬 Phase 2 — Conversations + Messages (jours 8 → 13)

### Objectifs :
- Offrir une vue CRM-like de conversations
- Outil central pour l’entreprise cliente

### Fonctionnalités :
- Liste des conversations  
- Recherche + filtres  
- Thread complet (user ↔ IA)  
- Info panel à droite  
- Actions :
  - Close conversation  
  - Export thread  
- Messages Log technique

### Composants principaux :
- `<ConversationList />`
- `<MessageThread />`
- `<MessageBubble />`
- `<ConversationInfoPanel />`
- `<DataTable />` (pour logs)

### Dépendances API :
- `/api/admin/conversations`
- `/api/admin/messages`

### Livrables :
- Pages entièrement fonctionnelles
- Pagination + loading states + empty states

### Critères d'acceptation :
- Conversation s’affiche en < 200ms côté front
- Aucun mélange cross-tenant
- Logs accessibles & filtrables

---

# 6. 🤖 Phase 3 — Assistants (jours 14 → 19)

### Objectifs :
- Gérer configuration complète assistant IA

### Fonctionnalités :
- Liste assistants
- Détail assistant avec tabs :
  - General
  - LLM Settings
  - Channels
  - Tester (UI + preview)
- Update settings
- Bind/débind channel

### Composants :
- `<AssistantGeneralForm />`
- `<AssistantLLMSettingsForm />`
- `<AssistantChannelBindings />`
- `<AssistantTester />`

### APIs :
- `/api/admin/assistants`
- `/api/admin/assistants/:id`
- `/api/admin/assistants/:id/bind`

### Livrables :
- Assistant modifiable 100% via UI

### Critères d'acceptation :
- Modifier model/température/ RAG mode fonctionne
- Liaison channel ok
- Tester assistant renvoie une réponse

---

# 7. 📱 Phase 4 — Channels (jours 20 → 24)

### Objectifs :
- Permettre de configurer WhatsApp Business API

### Fonctionnalités :
- Liste des channels
- Création channel
- Édition channel
- Voir statut webhook
- Tester message sortant

### Composants :
- `<ChannelList />`
- `<ChannelForm />`
- `<ChannelStatusCard />`

### Dépendances API :
- `/api/admin/channels`
- `/api/admin/channels/:id`

### Livrables :
- Une entreprise peut configurer WhatsApp toute seule.

### Critères d'acceptation :
- Channel opérationnel → Dashboard affiche trafic ↑

---

# 8. 📚 Phase 5 — Knowledge Base / RAG (jours 25 → 28)

### Objectifs :
- Interface complète pour documents RAG

### Fonctionnalités :
- Liste KB
- CRUD Knowledge Base
- Upload document PDF
- Voir statut indexation
- Preview PDF
- Delete document
- RAG Tester

### Composants :
- `<KnowledgeBaseList />`
- `<KnowledgeBaseDetailLayout />`
- `<DocumentList />`
- `<PDFPreview />`
- `<RAGTester />`

### APIs :
- `/api/admin/knowledge/bases`
- `/api/admin/knowledge/documents`

### Livrables :
- Un client peut structurer toute sa base documentaire

### Critères d’acceptation :
- Document uploadé → indexation visible en temps réel
- RAG tester renvoie résultats corrects

---

# 9. 📊 Phase 6 — Usage & Quotas (jours 29 → 30)

### Objectifs :
- Ajouter une page monitoring usage

### Fonctionnalités :
- KPIs
- Charts tokens/messages
- Comparaison plan
- Alertes limites

### Composants :
- `<UsageSummaryCards />`
- `<UsageCharts />`

### APIs :
- `/api/admin/usage`

---

# 10. ⚙️ Phase 7 — Settings (jours 31 → 32)

### Objectifs :
- Gestion paramètres tenant

### Fonctionnalités :
- Nom tenant
- API Keys (regen)
- Allowed domains
- Danger Zone (delete tenant)

### Composants :
- `<TenantInfoCard />`
- `<ApiKeysCard />`
- `<DangerZoneCard />`

### APIs :
- `/api/admin/tenants/:tenantId`

---

# 11. 🧽 Phase 8 — Stabilisation, Tests, Polish (jours 33 → 34)

### Objectifs :
- Performance  
- UI polish  
- Tests e2e  
- Corrections  
- UX final touches  

### Actions :
- Optimisation React Query  
- Recherche debounce  
- Skeleton states  
- Vérification multi-tenant
- Tests manuels WhatsApp

### Livrables :
- Console prête à démo client  
- Console prête à onboarding réel  
- Zéro bug bloquant

---

# 12. 🧠 Risks & Mitigation

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Complexité multi-tenant | Élevé | Vérifier header tenant à chaque requête |
| Masses de données messages | Moyen | Pagination + infinite scroll |
| Mélange RAG / Vertex | Moyen | Flag de configuration assistant |
| Mauvaise UI performance | Moyen | Cache React Query |
| API instables | Moyen | Vérifier API_REFERENCE.md à chaque étape |
| Dérive architecture front | Élevé | Respect strict du Design System + Components.md |

---

# 13. 🤖 Guides pour IA (Copilot/Cursor)

### Avant de générer du code :
Follow strictly:

ADMIN_CONSOLE_FLOW.md

ADMIN_CONSOLE_WIREFRAMES.md

ADMIN_CONSOLE_COMPONENTS.md

SYLION_UI_DESIGN_SYSTEM.md

PROJECT_CONTEXT.md

markdown
Copier le code

### Règles :
- Ne jamais inventer un composant hors design system  
- Ne jamais modifier structure backend  
- Toujours utiliser React Query  
- Toujours passer tenantId  

---

# 14. 🦁 Conclusion

Cette roadmap permet de livrer une **Console Admin professionnelle**, cohérente, élégante, performante et parfaitement alignée avec :

- l’architecture backend SYLION  
- les besoins des clients WhatsApp  
- un vrai SaaS multi-tenant  
- les standards UI modernes  

La Console est livrable en **30 jours**, avec un focus fort sur :

- UX  
- stabilité  
- performance  
- RAG  
- WhatsApp  
- modularité  
