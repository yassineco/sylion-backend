# 🔌 WhatsApp Smoke Test — Procédure de validation

> **Objectif :** Valider que le webhook WhatsApp est fonctionnel avant go-live.  
> **Prérequis :** Backend déployé, Nginx configuré, HTTPS actif.

---

## 1. URL Webhook attendue

```
https://api.sylion.tech/api/v1/whatsapp/webhook
```

Cette URL doit être configurée dans le portail 360dialog (ou Meta Business).

---

## 2. Test de validation (Webhook Verification)

Lors de la configuration du webhook, Meta/360dialog envoie une requête GET de vérification :

### Requête entrante (simulée)

```
GET /api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<WHATSAPP_VERIFY_TOKEN>&hub.challenge=CHALLENGE_CODE
```

### Réponse attendue

| Condition | Code HTTP | Body |
|-----------|-----------|------|
| Token valide | `200` | `CHALLENGE_CODE` (echo du challenge) |
| Token invalide | `403` | Erreur |

---

## 3. Procédure de test manuel

### Étape 1 : Vérifier que le backend répond

```bash
curl -s https://api.sylion.tech/health | jq .
# Attendu: {"status":"healthy",...}
```

### Étape 2 : Simuler le challenge webhook

```bash
curl -s "https://api.sylion.tech/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<VOTRE_TOKEN>&hub.challenge=test123"
# Attendu: test123
```

### Étape 3 : Vérifier les logs backend

```bash
docker logs sylion-backend --tail=50 | grep -i webhook
# Attendu: log de réception de la requête webhook
```

---

## 4. Résultats attendus

| Test | Résultat OK | Résultat KO |
|------|-------------|-------------|
| Health check | HTTP 200 + JSON | Timeout ou 502 |
| Webhook challenge | HTTP 200 + echo challenge | HTTP 403 ou 500 |
| Logs backend | Entrée webhook visible | Aucun log ou erreur |

---

## 5. Checklist pré-go-live WhatsApp

- [ ] `WHATSAPP_API_KEY` défini dans `.env.prod`
- [ ] `WHATSAPP_VERIFY_TOKEN` défini dans `.env.prod` (≥ 8 caractères)
- [ ] Webhook URL configurée dans portail 360dialog
- [ ] Test challenge réussi (étape 2)
- [ ] Premier message test reçu (post go-live)

---

## 6. Troubleshooting

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| 502 Bad Gateway | Backend down ou mauvais port | Vérifier `docker ps` et port 8000 |
| 403 Forbidden | `WHATSAPP_VERIFY_TOKEN` incorrect | Comparer token `.env.prod` vs portail |
| Timeout | Firewall ou DNS | Vérifier UFW et résolution DNS |
| Pas de logs | Route webhook non implémentée | Vérifier route dans `src/modules/whatsapp/` |

---

**Document maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-15
