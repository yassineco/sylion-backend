# 🦁 ADMIN_CONSOLE_COMPONENTS.md
**Version : 1.0**  
**Projet : SYLION Admin Console**  
**Objet : Spécification des composants frontend (React)**  
**Stack cible : React + TypeScript + Tailwind + shadcn/ui + React Query**

---

# 1. 🎯 Objectif du document

Ce document définit :

- Les **composants UI** à construire pour l’Admin Console  
- Leur rôle, leurs props principales, et leur contexte d’utilisation  
- Les écrans où ils apparaissent (référence à `ADMIN_CONSOLE_FLOW.md` & `ADMIN_CONSOLE_WIREFRAMES.md`)  
- Les conventions de base pour leur implémentation en React

Le but est d’éviter :

- le chaos de composants ad hoc  
- la duplication (3 tables différentes, 4 loaders différents, etc.)  
- des pages non homogènes  
- une UI difficile à maintenir

---

# 2. 🧱 Architecture UI globale

Organisation suggérée :

src/
├─ components/
│ ├─ layout/
│ ├─ navigation/
│ ├─ data-display/
│ ├─ forms/
│ ├─ messaging/
│ ├─ rag/
│ ├─ charts/
│ ├─ feedback/
│ └─ modals/
└─ features/
├─ dashboard/
├─ conversations/
├─ assistants/
├─ channels/
├─ knowledge/
├─ usage/
├─ settings/
└─ logs/

yaml
Copier le code

---

# 3. 🧭 Layout & Navigation Components

## 3.1. `<AppShell />`
**Rôle :** Layout principal (sidebar + header + content)

**Props (indicatives) :**
```ts
type AppShellProps = {
  children: React.ReactNode;
  currentTenant: TenantSummary;
  onTenantChange?: (tenantId: string) => void;
};
Contient :

<SidebarNav />

<TopBar />

<main>{children}</main>

3.2. <SidebarNav />
Rôle : Navigation principale (Dashboard, Conversations, Assistants, etc.)

Props :

ts
Copier le code
type SidebarNavProps = {
  items: {
    label: string;
    icon: React.ReactNode;
    href: string;
    active?: boolean;
  }[];
};
3.3. <TopBar />
Rôle : Header avec tenant + actions globales

Props :

ts
Copier le code
type TopBarProps = {
  currentTenant: TenantSummary;
  onTenantChange?: (tenantId: string) => void;
  rightActions?: React.ReactNode;
};
Inclut :

Dropdown Tenant

Avatar / Menu user (future)

Breadcrumbs (optionnel)

4. 📊 Generic Data Components
4.1. <DataCard />
Rôle : Wrap de base pour toutes les cartes Dashboard / Stats.

Props :

ts
Copier le code
type DataCardProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};
Used in :

Dashboard

Usage

Assistant Status

Channel Status

4.2. <DataTable />
Rôle : Table générique réutilisable (conversations, assistants, channels…)

Props (simplifiées) :

ts
Copier le code
type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onSortChange?: (columnId: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  emptyState?: React.ReactNode;
};
Used in :

Conversations list

Messages log

Assistants

Channels

Knowledge bases

Usage (monthly)

4.3. <StatusBadge />
Rôle : Badge de statut standardisé.

Props :

ts
Copier le code
type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

type StatusBadgeProps = {
  label: string;
  variant: StatusBadgeVariant;
};
Exemples :

“Active”, “Closed”

“Ready”, “Indexing”, “Error”

“OK”, “Degraded”, “Down”

5. ✏️ Form & Input Components
5.1. <FormSection />
Rôle : Groupement de champs avec titre + description.

Props :

ts
Copier le code
type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};
Used in :

Assistant settings

Channel settings

Tenant settings

5.2. <LabeledField />
Rôle : Label + description + champ enfant.

Props :

ts
Copier le code
type LabeledFieldProps = {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
};
5.3. <ConfirmButton />
Rôle : Bouton avec confirmation (danger zone).

Props :

ts
Copier le code
type ConfirmButtonProps = {
  label: string;
  confirmMessage: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'default' | 'danger';
};
Used in :

Delete tenant

Delete KB

Delete document

6. 💬 Messaging & Conversations Components
6.1. <ConversationList />
Rôle : Liste de conversations dans la vue 3 colonnes.

Props :

ts
Copier le code
type ConversationListItem = {
  id: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  status: 'open' | 'closed';
  channelName?: string;
};

type ConversationListProps = {
  items: ConversationListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filters?: React.ReactNode;
  isLoading?: boolean;
};
6.2. <MessageThread />
Rôle : Affichage des messages d’une conversation (timeline).

Props :

ts
Copier le code
type ThreadMessage = {
  id: string;
  senderType: 'user' | 'assistant' | 'agent';
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type MessageThreadProps = {
  messages: ThreadMessage[];
  isLoading?: boolean;
};
6.3. <MessageBubble />
Rôle : Composant atomique du thread.

Props :

ts
Copier le code
type MessageBubbleProps = {
  senderType: 'user' | 'assistant' | 'agent';
  text: string;
  timestamp: string;
};
User vs Assistant vs Agent → style différent.

6.4. <ConversationInfoPanel />
Rôle : Colonne droite : infos conversation.

Props :

ts
Copier le code
type ConversationInfoPanelProps = {
  conversation: {
    id: string;
    channelName: string;
    assistantName?: string;
    createdAt: string;
    status: 'open' | 'closed';
  };
  onCloseConversation?: () => void;
  onExportConversation?: () => void;
};
7. 🤖 Assistants Components
7.1. <AssistantList />
Wrapper de <DataTable /> spécialisé.

Props :

ts
Copier le code
type AssistantListProps = {
  assistants: AssistantSummary[];
  isLoading?: boolean;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
};
7.2. <AssistantGeneralForm />
Rôle : Formulaire “General” de l’assistant.

Props :

ts
Copier le code
type AssistantGeneralFormValues = {
  name: string;
  language: string;
  description?: string;
  systemPrompt: string;
};

type AssistantGeneralFormProps = {
  initialValues: AssistantGeneralFormValues;
  onSubmit: (values: AssistantGeneralFormValues) => Promise<void>;
};
7.3. <AssistantLLMSettingsForm />
Rôle : Réglage modèle / température / RAG.

Props :

ts
Copier le code
type AssistantLLMSettings = {
  model: string;
  temperature: number;
  maxTokens: number;
  ragEnabled: boolean;
  ragMode: 'local' | 'vertex';
};

type AssistantLLMSettingsFormProps = {
  initialValues: AssistantLLMSettings;
  onSubmit: (values: AssistantLLMSettings) => Promise<void>;
};
7.4. <AssistantChannelBindings />
Rôle : Liaison Assistant ↔ Channels.

Props :

ts
Copier le code
type AssistantChannelBindingsProps = {
  channels: {
    id: string;
    name: string;
    number: string;
    bound: boolean;
  }[];
  onToggleBinding: (channelId: string, bound: boolean) => Promise<void>;
};
7.5. <AssistantTester />
Rôle : Tester un assistant avec un prompt.

Props :

ts
Copier le code
type AssistantTesterProps = {
  assistantId: string;
};
Interne :

champ input “question”

affiche la réponse (appel à backend POST /api/admin/assistants/:id/test ou équivalent, plus tard).

8. 📱 Channels Components
8.1. <ChannelList />
Basé sur <DataTable />.

Props :

ts
Copier le code
type ChannelListProps = {
  channels: ChannelSummary[];
  isLoading?: boolean;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
};
8.2. <ChannelForm />
Rôle : Création / édition d’un channel WhatsApp.

Props :

ts
Copier le code
type ChannelFormValues = {
  type: 'whatsapp';
  provider: '360dialog' | 'meta' | 'twilio';
  whatsappNumber: string;
  apiKey: string;
  phoneNumberId?: string;
};

type ChannelFormProps = {
  initialValues?: Partial<ChannelFormValues>;
  onSubmit: (values: ChannelFormValues) => Promise<void>;
};
8.3. <ChannelStatusCard />
Rôle : Carte simple pour status channel.

Props :

ts
Copier le code
type ChannelStatusCardProps = {
  number: string;
  provider: string;
  status: 'ok' | 'degraded' | 'down';
  lastMessageAt?: string;
};
9. 📚 Knowledge / RAG Components
9.1. <KnowledgeBaseList />
Liste des KB.

Props :

ts
Copier le code
type KnowledgeBaseListProps = {
  bases: KnowledgeBaseSummary[];
  isLoading?: boolean;
  onCreate?: () => void;
  onOpen?: (id: string) => void;
};
9.2. <KnowledgeBaseDetailLayout />
Rôle : Layout 2 colonnes (liste documents / prévisualisation).

Props :

ts
Copier le code
type KnowledgeBaseDetailLayoutProps = {
  left: React.ReactNode;   // docs + upload
  right: React.ReactNode;  // preview + status + test
};
9.3. <DocumentList />
Rôle : Liste de documents RAG.

Props :

ts
Copier le code
type DocumentListItem = {
  id: string;
  name: string;
  status: 'uploaded' | 'indexing' | 'ready' | 'error';
  sizeMb?: number;
  updatedAt: string;
};

type DocumentListProps = {
  items: DocumentListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUploadFile?: (file: File) => Promise<void>;
};
9.4. <DocumentStatusBadge />
Simple wrapper de <StatusBadge /> avec mapping pour RAG.

9.5. <RAGTester />
Rôle : Champ pour tester le RAG sur une KB ou un assistant.

Props :

ts
Copier le code
type RAGTesterProps = {
  target: { type: 'kb' | 'assistant'; id: string };
};
9.6. <PDFPreview />
Rôle : prévisualisation PDF (via react-pdf ou iframe).

Props :

ts
Copier le code
type PDFPreviewProps = {
  url: string;
  title?: string;
  isLoading?: boolean;
};
10. 📊 Usage & Charts Components
10.1. <UsageSummaryCards />
Rôle : Ensemble de DataCard pour Usage.

Props :

ts
Copier le code
type UsageSummary = {
  messages: number;
  tokensIn: number;
  tokensOut: number;
  ragCalls: number;
  storageMb: number;
};

type UsageSummaryCardsProps = {
  data: UsageSummary;
  isLoading?: boolean;
};
10.2. <UsageCharts />
Groupement de charts.

Props :

ts
Copier le code
type UsageTimeSeriesPoint = {
  date: string;
  messages: number;
  tokensIn: number;
  tokensOut: number;
  ragCalls: number;
};

type UsageChartsProps = {
  series: UsageTimeSeriesPoint[];
  isLoading?: boolean;
};
11. ⚙️ Tenant Settings Components
11.1. <TenantInfoCard />
Tenant + plan.

Props :

ts
Copier le code
type TenantInfoCardProps = {
  name: string;
  plan: string;
  createdAt: string;
};
11.2. <ApiKeysCard />
Rôle : Affichage + régénération clés API.

Props :

ts
Copier le code
type ApiKeysCardProps = {
  keys: { label: string; value: string }[];
  onRegenerate: (keyLabel: string) => Promise<void>;
};
11.3. <DangerZoneCard />
Rôle : Zone critique (delete tenant, reset data).

Props :

ts
Copier le code
type DangerZoneCardProps = {
  onDeleteTenant?: () => Promise<void>;
};
12. 🧼 Feedback & Utils Components
12.1. <LoadingState />
Rôle : Indicateur de chargement.

Props :

ts
Copier le code
type LoadingStateProps = {
  message?: string;
};
12.2. <EmptyState />
Rôle : Affichage lorsqu’il n’y a pas de données.

Props :

ts
Copier le code
type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};
12.3. <ErrorBanner />
Rôle : Erreurs globales.

Props :

ts
Copier le code
type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
};
13. 🔐 Notes importantes (UX + Architecture)
Tous les composants doivent rester purs (pas de logique métier backend dedans).
→ data fetching = dans les features/* via React Query.

Pas de logique IA dans le frontend.
→ le front appelle seulement le backend.

Multi-tenant :
→ le tenant actif est géré côté frontend (context / hook), passé aux hooks d’API.

Pas de duplication inutile de composants :
→ DataTable sert de base à toutes les tables.
→ StatusBadge pour tous les statuts.

14. 🦁 Conclusion
Ce document définit la boîte à outils UI de la Console Admin SYLION :

Layout

Navigation

Tables

Conversations

Assistants

Channels

RAG

Usage

Settings

Feedback

Il sert de référence pour :

la génération de code React (Copilot / Cursor / ChatGPT)

la conception Figma

la structuration des features/*

la cohérence long terme du SaaS Admin.