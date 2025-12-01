# 🦁 SYLION_UI_DESIGN_SYSTEM.md  
**Version : 1.0**  
**Brand : SYLION**  
**Objet : Design System Officiel (UI/UX + Tokens + Patterns)**  
**Public : Designers, Développeurs Front, IA (Copilot/Cursor/Continue)**  
**Stack cible : Tailwind, shadcn/ui, React, Next.js**

---

# 1. 🎯 Vision UX & UI

SYLION a une identité forte :

- premium  
- sobre  
- technologique  
- professionnelle  
- futuriste mais élégante  
- inspirée par **Stripe**, **Linear**, **Superhuman**, **Vercel**

Le design system repose sur :

- **lisibilité**  
- **cohérence**  
- **neutralité premium**  
- **accessibilité** (AA minimum)  
- **adaptabilité** (dark mode prioritaire)  
- **scalabilité** (multi produits)

---

# 2. 🎨 Palette de couleurs (tokens)

Les couleurs doivent être strictement respectées.  
Elles représentent l’identité visuelle SYLION.

## 2.1. Nomenclature Tailwind (variables CSS)

--color-bg: #0E0F10;
--color-bg-card: #111214;
--color-bg-hover: #17181A;

--color-text: #E7E7E9;
--color-text-muted: #9A9CA0;
--color-text-dim: #6F7175;

--color-border: #2B2D31;
--color-border-muted:#1F2022;

--color-primary: #3B82F6; // Blue-500
--color-primary-dark:#1D4ED8; // Blue-700
--color-primary-light:#60A5FA;
--color-primary-muted:#93C5FD;

--color-success: #10B981;
--color-warning: #FBBF24;
--color-error: #EF4444;
--color-info: #0EA5E9;

--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

yaml
Copier le code

## 2.2. Général
| Token | Valeur |
|-------|--------|
| Primary | Bleu technologique, moderne |
| Background | Noir/gris, ambiance premium |
| Text | Gris très clair, high contrast |
| Success | Vert propre (stabilité) |
| Warning | Jaune doré |
| Error | Rouge vif élégant |
| Info | Bleu turquoise |

---

# 3. 🔤 Typography

Inspirée de **Inter** + alternatives modernes.

## 3.1. Fonts

Font family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;

scss
Copier le code

## 3.2. Text sizes (Tailwind)
text-xs: 11px
text-sm: 13px
text-base: 15px
text-lg: 17px
text-xl: 20px
text-2xl: 26px

shell
Copier le code

## 3.3. Font weights
Regular: 400
Medium: 500
Semibold: 600
Bold: 700
ExtraBold: 800

yaml
Copier le code

## 3.4. Usage guidelines

- Titres → semibold  
- Paragraphes → regular  
- UI labels → medium  
- KPI / chiffres → semibold/bold  
- Textes longs → base (15px)  

---

# 4. 🧱 Spacing & Layout

## 4.1. Tailwind spacing scale
1 → 4px
2 → 8px
3 → 12px
4 → 16px
6 → 24px
8 → 32px
10 → 40px
12 → 48px

yaml
Copier le code

## 4.2. Règles de composition

- Padding card : `p-6`  
- Gutter grid : `gap-6`  
- Page spacing top-bottom : `py-8`  
- Spacing vertical entre sections : `space-y-8`

---

# 5. 🧩 UI Components (base)

Inspiré de shadcn/ui + Linear.

## 5.1. Cards

<Card> <CardHeader>Title</CardHeader> <CardContent>...</CardContent> </Card> ```
Règles :
bordure fine → border-border

fond : bg-bg-card

radius : rounded-xl

5.2. Buttons
Variants
primary

secondary

subtle

danger

ghost

Tailwind tokens
vbnet
Copier le code
Primary: bg-primary text-white hover:bg-primary-dark
Secondary: bg-bg-hover border border-border text-text
Ghost: text-text-muted hover:text-text
Danger: bg-error text-white hover:bg-red-700
Sizes
vbnet
Copier le code
sm: h-8 px-3 text-sm  
md: h-9 px-4 text-sm  
lg: h-10 px-5 text-base  
5.3. Inputs
Styles
pgsql
Copier le code
bg-bg hover:bg-bg-hover border-border-muted 
rounded-md px-3 py-2 text-base focus:ring-primary
Variants
input

textarea

number

select

5.4. Tables
Style
lignes discrètes

header semi-transparent

hover row légère

Exemple design :
cpp
Copier le code
<th class="text-text-muted bg-bg-hover">
<td class="border-b border-border py-3 px-4">
<tr class="hover:bg-bg-hover/40">
6. 🧭 Navigation Components
6.1. Sidebar
Couleurs :

scss
Copier le code
bg-bg-card
border-r border-border
text-text-muted
Hover :

vbnet
Copier le code
hover:bg-bg-hover
hover:text-text
Item actif :

scss
Copier le code
bg-bg-hover text-text
border-l-2 border-primary
6.2. Top Bar
fond : bg-bg-card

bordure bas : border-b border-border

hauteur : 56px

items centrés verticalement

7. 💬 Messaging Components (Conversations)
7.1. Bubbles
User bubble :
arduino
Copier le code
bg-primary text-white rounded-xl px-4 py-2 max-w-[70%]
Assistant bubble :
arduino
Copier le code
bg-bg-hover text-text rounded-xl px-4 py-2 max-w-[70%]
Agent bubble (optional future) :
pgsql
Copier le code
bg-info/20 text-info border border-info/40
Thread rules :
spacing vertical : space-y-4

timestamp : text-xs text-text-dim

8. 📚 RAG Components
8.1. Document List
list-items → hover:bg-bg-hover rounded-md p-3

badge statut → couleurs statut système

preview PDF → grande carte sombre

8.2. Status badges (RAG)
Statut	Badge
uploaded	bg-info/10 text-info
indexing	bg-warning/10 text-warning
ready	bg-success/10 text-success
error	bg-error/10 text-error

9. 📊 Charts (Usage)
Design minimal :

lignes fines

couleurs : primary + muted

axes gris subtil

points doux (radius 3px)

tooltips neutres (bg-bg-card, border-border)

10. 🧱 Icons
Utiliser Lucide Icons.

Style :

outline

taille : 20px par défaut

couleur : text-text-muted

Icons suggérés :

pgsql
Copier le code
layout-dashboard
message-square
bot
database
server
book
file-text
settings
activity
bar-chart-2
11. 🔐 Modals & Overlays
Style
css
Copier le code
bg-bg-card border border-border rounded-xl p-6
shadow-xl shadow-black/40
Animations
fade-in

slide-up léger

12. 🏗️ Component Tokens (Bonne pratique)
Créer un fichier <project>/src/styles/tokens.css :

css
Copier le code
:root {
  --bg: #0E0F10;
  --card: #111214;
  --hover: #17181A;

  --text: #E7E7E9;
  --muted: #9A9CA0;
  --dim: #6F7175;

  --primary: #3B82F6;
  --primary-dark: #1D4ED8;
  --primary-light: #60A5FA;

  --success: #10B981;
  --warning: #FBBF24;
  --error: #EF4444;
  --info: #0EA5E9;

  --radius: 12px;
}
13. 📦 Tailwind Config Extension
Ajouter dans tailwind.config.js :

js
Copier le code
extend: {
  colors: {
    bg: "var(--bg)",
    card: "var(--card)",
    hover: "var(--hover)",

    text: "var(--text)",
    muted: "var(--muted)",
    dim: "var(--dim)",

    primary: "var(--primary)",
    "primary-dark": "var(--primary-dark)",
    "primary-light": "var(--primary-light)",

    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--error)",
    info: "var(--info)"
  },
  borderRadius: {
    xl: "var(--radius)"
  }
}
14. 🧠 UX Principles
14.1. Clarté absolue
L’utilisateur doit comprendre sans réfléchir

Informations hiérarchisées

14.2. Silence visuel
Ne rien surcharger

Pas trop de couleurs

14.3. Focus sur les actions
Gros call-to-action bleu

Actions secondaires grises

14.4. Cohérence obligatoire
Toujours les mêmes espacements

Les mêmes composants

Les mêmes patterns

14.5. Mode sombre natif
Premier design → DARK

Mode clair → optionnel plus tard

15. 🧩 Patterns & Templates
15.1. Card grid standard
php-template
Copier le code
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  <DataCard>...</DataCard>
  <DataCard>...</DataCard>
  <DataCard>...</DataCard>
</div>
15.2. Two-column layout
cpp
Copier le code
<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
15.3. Page wrapper
php-template
Copier le code
<section class="p-8 space-y-8">
  <Header />
  <Content />
</section>
16. 🔥 Guidelines pour Copilot / Cursor
Avant de générer un composant :

bash
Copier le code
Follow SYLION_UI_DESIGN_SYSTEM.md strictly.
Use Tailwind + shadcn/ui.
Do not change spacing, colors or tokens.
Ensure dark mode first.
Avant de générer une page :

vbnet
Copier le code
Use the wireframe in ADMIN_CONSOLE_WIREFRAMES.md.
Use components defined in ADMIN_CONSOLE_COMPONENTS.md.
Respect design tokens from SYLION_UI_DESIGN_SYSTEM.md.
Do not invent new UI patterns.
17. 🦁 Conclusion
SYLION_UI_DESIGN_SYSTEM est la fondation visuelle de toute l’interface SYLION :

couleurs

typographies

radius

composants standards

patterns

guidelines IA

Il garantit :

cohérence

professionnalisme

identité forte

rapidité de développement

respect du style premium Sylion