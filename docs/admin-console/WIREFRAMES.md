# 🦁 ADMIN_CONSOLE_WIREFRAMES.md  
**Version : 1.0**  
**Projet : SYLION WhatsApp AI Assistant**  
**Objet : Wireframes textuels de la Console Admin (V1)**  
**Audience : UX/UI Designers, Développeurs React, IA (Copilot/Cursor/ChatGPT)**

---

# 1. 🎨 Principes UI généraux

- Design épuré → style Stripe / Supabase / Linear
- Couleurs : noir, blanc, gris, touches de bleu électrique (accent)
- Icônes minimalistes (Lucide Icons)
- Layout responsive
- Navigation latérale fixe
- Header tenant visible partout
- Utilisation d’un Design System :
  - Cards
  - Tables
  - Badges
  - Tabs
  - Modals
  - Drawers
  - Charts (usage)

---

# 2. 🧱 Structure globale

┌─────────────────────────────────────────────────────────────┐
│ SIDEBAR │ TENANT DROPDOWN │
├───────────────────────────────────────┴───────────────────────┤
│ HEADER (breadcrumbs, actions) │
├──────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA (cards, lists, tables, forms, tabs) │
└──────────────────────────────────────────────────────────────┘

yaml
Copier le code

---

# 3. 🏠 WIREFRAME — Dashboard

[Header] SYLION Dashboard | Tenant: Ecole Al Ihssane ▼

CARDS ROW 1
[Activity Today]

Messages received: 42

Responses sent: 41

Avg response time: 1.2s

[Usage Summary]

Tokens input: 12,400

Tokens output: 9,330

RAG calls: 21

CARDS ROW 2
[Assistant Status]

Assistant: Accueil Ecole

Model: gemini-1.5-flash

RAG: enabled (local)

Status: Active (green badge)

Button: "Edit Assistant"

[WhatsApp Channel]

Number: +212 6 12 34 56 78

Provider: 360dialog

Webhook: OK

Messages last 24h: chart

Button: "Channel Settings"

yaml
Copier le code

---

# 4. 💬 WIREFRAME — Conversations

┌─────────────────────────────┬─────────────────────────────┬────────────────────────────┐
│ CONVERSATION LIST │ CONVERSATION THREAD │ INFO PANEL │
├─────────────────────────────┼─────────────────────────────┼────────────────────────────┤
│ Search bar (icon) │ User msg (bubble) │ Assistant │
│ Filter: open / closed │ Assistant msg (bubble) │ - Model │
│ │ timestamps │ - RAG: yes/no │
│ ITEM │ Divider │ Channel info │
│ - User: “Bonjour” │ │ Conversation metadata │
│ - Last reply: “Bonjour, …” │ Input box (reply as admin) │ Button: Close conv │
│ - Time: 10:42 │ │ Button: Export thread │
│ - Status: open (green) │ │ │
└─────────────────────────────┴─────────────────────────────┴────────────────────────────┘

yaml
Copier le code

Pagination en bas.  
Infinite scroll dans la liste.

---

# 5. ✉️ WIREFRAME — Messages Log (tech view)

[Header] Messages Log

TABLE
| message_id | conv_id | sender | text preview | tokens | time |
| msg_123 | conv_1 | user | "Bonjour..." | - | 10:41 |
| msg_124 | conv_1 | bot | "Bonjour..." | 102 | 10:41 |
| msg_125 | conv_1 | user | "Quels..." | - | 10:42 |
Filters:

Sender: user | assistant

RAG used: yes/no

Channel

Date range

Pagination footer

yaml
Copier le code

---

# 6. 🤖 WIREFRAME — Assistants

## 6.1. List View

[Header] Assistants

TABLE
| NAME | MODEL | RAG | CHANNELS | ACTION |
| Accueil FR | gemini-1.5-flash | ON | 1 | Edit |
| Assistant EN| gemini-1.5-pro | OFF | 2 | Edit |
Button: + Create Assistant

shell
Copier le code

## 6.2. Detail View (Tabs)

[Header] Assistant: Accueil Ecole

TABS
General | LLM Settings | Channels | Testing
TAB: GENERAL

[Card: Basic Info]

Name input

Language dropdown

Description textarea

[Card: System Prompt]

Large textarea

Button: Reset to default prompt

TAB: LLM SETTINGS

[Card: LLM]

Model: dropdown

Temperature slider

Max tokens input

[Card: RAG]

RAG Enabled: toggle

RAG Mode: [local | vertex]

Button: "View Knowledge Bases"

TAB: CHANNELS

[List of channels bound]

Bind new channel

TAB: TESTING

Text input: "Posez une question à l'assistant"

Response preview component

yaml
Copier le code

---

# 7. 📱 WIREFRAME — Channels

[Header] WhatsApp Channels

TABLE
| Number | Provider | Status | Assistant | ACTION |
| +212612345678 | 360dialog | OK | Accueil | Edit |
Button: + Add Channel

shell
Copier le code

### Channel Detail

[Card: Basic Info]

WhatsApp number

Provider type

Webhook status (green/orange/red)

[Card: Credentials]

API Key (hidden)

Phone Number ID

Button: Regenerate token

[Card: Linked Assistant]

Dropdown: select assistant

Button: Bind

[Card: Tests]

Input: “Send test message”

Button: Send

yaml
Copier le code

---

# 8. 📚 WIREFRAME — Knowledge Base

## 8.1. Knowledge Base List

[Header] Knowledge Bases

TABLE
| Name | Documents | Last Updated | ACTION |
| Documents RH | 3 | 2025-01-20 | Open |
Button: + Create Knowledge Base

shell
Copier le code

## 8.2. Knowledge Base Detail

[Header] KB: Documents RH

LAYOUT: LIST (left) | PREVIEW (right)
LEFT SIDE
[Upload Button]
[Search documents]

[Document List]

doc1.pdf (status: ready)

doc2.pdf (status: indexing)

doc3.pdf (status: error)

RIGHT SIDE
PDF Viewer (iframe or react-pdf)
Status card:

uploaded / indexing / ready
Button: Force Reindex
Button: Delete Document

Bottom: Test RAG
[Input] "Posez une question"
[Button] Ask
[Response preview]

yaml
Copier le code

---

# 9. 📊 WIREFRAME — Usage & Quotas

[Header] Usage & Quotas

CARDS
Daily Messages | Tokens In/Out | RAG Calls | Storage Used
Charts | Charts | Charts | Gauge
[Table: Monthly Usage]
| Date | Messages | Tokens In | Tokens Out | RAG Calls |

Bottom:

Plan limits comparison

Alert banners (approaching quota)

yaml
Copier le code

---

# 10. ⚙️ WIREFRAME — Settings (Tenant)

[Header] Tenant Settings

[Card: Tenant Info]

Name

Plan (Starter | Pro | Business)

Created at

[Card: API Keys]

Admin API Key (hidden)

Regenerate button

[Card: Allowed Domains]

List + add domain

[Card: Danger Zone]

Delete Tenant (modal confirmation)

yaml
Copier le code

---

# 11. 🪵 WIREFRAME — Logs (future)

[Header] Logs

Tabs:

Webhook Logs

Worker Logs

Error Logs

RAG Logs

Each tab:
TABLE
| timestamp | level | message | metadata |
yaml
Copier le code

---

# 12. 💳 WIREFRAME — Billing (future)

[Header] Billing

[Plan Overview]

Current plan

Next invoice date

Upgrade/Downgrade

[Invoices]
| date | amount | status | PDF |

[Payment Methods]

Add payment method

Remove

markdown
Copier le code

---

# 13. 🧩 Components à générer (React / shadcn/ui)

### **Cards**
- `Card`
- `CardHeader`
- `CardContent`
- `CardFooter`

### **Table**
- `DataTable`
- `SortableColumn`
- `Pagination`

### **Inputs**
- TextInput
- TextArea
- Select
- Toggle
- FileUpload (RAG)

### **Messaging UI**
- BubbleUser  
- BubbleAssistant  
- MetadataRow  
- ThreadPanel  

### **RAG UI**
- DocumentTile  
- PDFPreview  
- StatusBadge  
- RAGTester  

### **Charts**
- LineChart  
- BarChart  
- Gauge  

### **Modals**
- ConfirmDelete  
- EditAssistant  
- BindChannel  
- UploadDocument  

---

# 14. 🧠 Notes pour IA (Copilot / Cursor)

Pour générer la console :

- Utiliser React + shadcn/ui + tailwind  
- Ne jamais modifier l’architecture backend  
- Suivre strictement les endpoints `API_REFERENCE.md`  
- Ne pas inventer de nouvelles routes  
- Reproduire la structure des wireframes  
- Respecter le multi-tenant (header must always show current tenant)  
- Ne jamais inclure d’IA dans l’UI locale (frontend ne fait pas d’appel LLM)  
- Tous les appels IA passent par le backend  

---

# 15. 🦁 Conclusion

Ce document fournit les **wireframes textuels complets** de la Console Admin SYLION.  
Il sert :

- à guider le design Figma  
- à générer du code frontend cohérent  
- à aligner backend ↔ frontend  
- à fournir une UX solide pour ton SaaS  