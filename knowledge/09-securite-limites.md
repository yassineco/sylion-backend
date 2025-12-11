# 09 – Sécurité, Limites et Guardrails

---

# 1. Sécurité conversationnelle

## Protection contre :
- Prompt injection  
- Tentatives d'abus (spam, tests destructifs)  
- Demandes illégales  
- Contenu sensible (médical, juridique)

Mécanismes :
- Instructions système strictes  
- Règles métiers codées dans l'orchestrateur  
- Filtrage côté backend  

---

# 2. Limites fonctionnelles (v1)

- Ne remplace pas un avis médical ou juridique.  
- Ne prend pas de décision critique.  
- Pas d'intégration CRM "automatique" pour l'instant.  
- Pas d'actions WhatsApp sortantes massives (anti-spam).  

---

# 3. Sécurité technique

- Isolation stricte entre tenants  
- Aucune fuite documentaire cross-tenant  
- Rotation des clés d'accès  
- Webhooks signés  
- Logs sécurisés  
- Environnement runtime isolé  

---

# 4. Limites IA

- Possibles erreurs de compréhension  
- Hallucinations minimisées mais non nulles  
- RAG améliore la précision mais dépend de la qualité des documents  

---

# 5. Points futurs à couvrir (v2 / v3)

- Classification automatique des risques dans les messages  
- Anti-fraude conversationnelle avancée  
- Scénarios d'escalade contrôlés  
