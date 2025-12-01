# 🤖 SYLION Assistant - Prompt Système

Ce document explique l'implémentation du prompt système SYLION dans le backend.

## 📋 Vue d'ensemble

Le système intègre maintenant le comportement spécifique défini dans `docs/assistant.system_prompt.md` :

- **Assistant professionnel** pour entreprises marocaines
- **Multilingue** : FR, Darija, Arabe, Anglais
- **Détection de secteur** automatique
- **Adaptation contextuelle** selon le métier
- **Prise d'informations** structurée

## 🔧 Implémentation

### Fichiers concernés

1. **`src/lib/sylion-default-prompt.ts`** - Prompt système par défaut
2. **`src/lib/llm.ts`** - Logique de génération de réponses améliorée
3. **`src/modules/assistant/assistant.service.ts`** - Utilisation du prompt par défaut
4. **`src/modules/assistant/assistant.types.ts`** - Prompt système optionnel
5. **`scripts/create-demo-assistant.ts`** - Script de création d'assistant démo

### Fonctionnalités implémentées

#### ✅ Détection de langue automatique
```typescript
// Détecte automatiquement : FR, Darija, Arabe, Anglais
const language = detectLanguage(userMessage);
```

#### ✅ Détection de secteur d'activité
```typescript
// Détecte : education, healthcare, restaurant, real_estate, ecommerce
const businessSector = detectBusinessSector(userMessage);
```

#### ✅ Détection d'intentions
```typescript
// Détecte : greeting, goodbye, demo_inquiry, appointment_request, etc.
const intent = detectIntent(userMessage);
```

#### ✅ Réponses contextuelles par secteur
- **Écoles** : inscription, niveaux, frais de scolarité
- **Cliniques** : consultations, spécialités, rendez-vous
- **Restaurants** : menus, réservations, livraisons
- **Immobilier** : visites, biens disponibles
- **E-commerce** : commandes, livraisons, retours

## 🚀 Utilisation

### Créer un assistant avec prompt par défaut

```typescript
import { assistantService } from '@/modules/assistant/assistant.service';

// Le prompt système est optionnel - utilise le prompt SYLION par défaut
const assistant = await assistantService.createAssistant(tenantId, {
  name: 'Mon Assistant SYLION',
  description: 'Assistant pour mon entreprise',
  // systemPrompt: '...', // Optionnel
});
```

### Script de création d'assistant démo

```bash
npm run create-demo-assistant <tenantId>
```

### Exemple d'usage dans le message processor

```typescript
import { generateAssistantReply } from '@/lib/llm';

const reply = await generateAssistantReply({
  tenantId: 'uuid-tenant',
  assistantId: 'uuid-assistant', 
  messages: [
    { role: 'user', content: 'Bonjour, je veux inscrire mon fils' }
  ]
});

// Réponse attendue : "Très bien. Pour l'inscription, j'aurai besoin du niveau souhaité..."
```

## 🧪 Tests

### Tests unitaires
```bash
npm run test test/unit/sylion-prompt.unit.test.ts
```

Tests couverts :
- ✅ Détection de langue (FR, EN, Darija)
- ✅ Détection de secteur (éducation, santé, restaurant)
- ✅ Détection d'intentions (démo, prix, RDV)
- ✅ Respect des règles (pas de mention Google/OpenAI)
- ✅ Adaptation culturelle marocaine

## 📊 Exemples de comportement

### 🔹 Salutation multilingue

**Français :**
- Input: "Bonjour"
- Output: "Bonjour 👋 Je suis SYLION, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ?"

**Darija :**
- Input: "Salam"  
- Output: "Salam! Ana SYLION, l'assistant dyalek. Kifash ymken naawen?"

### 🔹 Détection secteur éducation

**Input :** "Je veux inscrire mon fils"
**Output :** "Très bien. Pour l'inscription, j'aurai besoin du niveau souhaité, de l'âge de votre enfant et de vos coordonnées. Souhaitez-vous une école maternelle, primaire ou collège ?"

### 🔹 Demande de démo

**Input :** "Comment ça marche votre système ?"
**Output :** "Je suis un assistant intelligent qui répond automatiquement aux messages WhatsApp : informations, prise de contact, rendez-vous, et réponses basées sur vos documents. Quel type d'entreprise souhaitez-vous simuler dans cette démo ?"

## 🔮 Migration vers Vertex AI

Le système actuel utilise des règles intelligentes (stub). La migration vers Vertex AI se fera en :

1. **Gardant la même interface** `generateAssistantReply()`
2. **Injectant le prompt système** dans les appels Vertex AI
3. **Conservant la logique de détection** pour enrichir le contexte

```typescript
// Future implémentation Vertex AI
const vertexMessages = [
  { role: 'system', content: getDefaultSystemPrompt() },
  ...conversationHistory,
  { role: 'user', content: userMessage }
];

const response = await vertexAI.generateContent({
  model: 'gemini-1.5-pro',
  messages: vertexMessages,
  temperature: 0.7
});
```

## 🔒 Sécurité et Compliance

### Règles respectées
- ✅ **Jamais mentionner** Google/OpenAI/Anthropic
- ✅ **Répondre "SYLION"** si demande sur créateur
- ✅ **Pas d'informations inventées**
- ✅ **Adaptation culturelle** marocaine
- ✅ **Isolation multi-tenant** respectée

### Monitoring
- Logs structurés pour chaque génération
- Métriques d'utilisation par tenant
- Validation des prompts avant utilisation

---

✨ **Le système SYLION Assistant est maintenant opérationnel et prêt pour la migration vers Vertex AI !**