# ✅ Secrets Checklist — Pré-déploiement Production

> **Objectif :** Préparer tous les secrets avant le provisionnement VPS.  
> **Durée estimée :** 15-20 minutes  
> **Prérequis :** Accès au password manager, accès au portail 360dialog

---

## 🔑 Génération des secrets

| # | Tâche | Commande / Action | Fait |
|---|-------|-------------------|------|
| 1 | Générer `POSTGRES_PASSWORD` | `openssl rand -base64 32` | [ ] |
| 2 | Générer `REDIS_PASSWORD` | `openssl rand -base64 32` | [ ] |
| 3 | Générer `JWT_SECRET` | `openssl rand -base64 64` | [ ] |
| 4 | Choisir `WHATSAPP_VERIFY_TOKEN` | Alphanum, 32+ chars recommandé | [ ] |
| 5 | Récupérer `WHATSAPP_API_KEY` | Portail 360dialog → API Keys | [ ] |
| 6 | Récupérer `WHATSAPP_PHONE_NUMBER_ID` | Portail 360dialog → Numbers | [ ] |

---

## 📦 Stockage sécurisé

| # | Tâche | Fait |
|---|-------|------|
| 7 | Stocker tous les secrets dans le password manager (1Password/Bitwarden) | [ ] |
| 8 | Créer une entrée dédiée "Sylion Backend Prod" | [ ] |
| 9 | Activer 2FA sur le password manager (si pas déjà fait) | [ ] |

---

## 📄 Fichier .env.prod

| # | Tâche | Commande / Action | Fait |
|---|-------|-------------------|------|
| 10 | Copier le template | `cp .env.prod.example .env.prod` | [ ] |
| 11 | Remplir les valeurs réelles | Éditer `.env.prod` | [ ] |
| 12 | Sécuriser les permissions | `chmod 600 .env.prod` | [ ] |
| 13 | Vérifier le propriétaire | `chown $USER:$USER .env.prod` | [ ] |

---

## ✅ Validation

| # | Tâche | Commande / Action | Fait |
|---|-------|-------------------|------|
| 14 | Vérifier que `.env.prod` n'est pas suivi par Git | `git status .env.prod` → doit être "untracked" ou absent | [ ] |
| 15 | Valider le format (fail-fast) | `docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet && echo "OK"` | [ ] |

---

## 🔒 Vérification finale

```bash
# Script de validation rapide (à exécuter localement)
echo "=== Secrets Checklist Validation ==="
echo -n ".env.prod exists: " && [ -f .env.prod ] && echo "✅" || echo "❌"
echo -n ".env.prod permissions (600): " && [ "$(stat -c %a .env.prod 2>/dev/null)" = "600" ] && echo "✅" || echo "❌"
echo -n ".env.prod not in git: " && ! git ls-files --error-unmatch .env.prod 2>/dev/null && echo "✅" || echo "❌"
echo -n "POSTGRES_PASSWORD set: " && grep -q "^POSTGRES_PASSWORD=.\{10,\}" .env.prod && echo "✅" || echo "❌"
echo -n "REDIS_PASSWORD set: " && grep -q "^REDIS_PASSWORD=.\{10,\}" .env.prod && echo "✅" || echo "❌"
echo -n "JWT_SECRET set: " && grep -q "^JWT_SECRET=.\{32,\}" .env.prod && echo "✅" || echo "❌"
echo -n "WHATSAPP_API_KEY set: " && grep -q "^WHATSAPP_API_KEY=.\{10,\}" .env.prod && echo "✅" || echo "❌"
echo -n "WHATSAPP_VERIFY_TOKEN set: " && grep -q "^WHATSAPP_VERIFY_TOKEN=.\{8,\}" .env.prod && echo "✅" || echo "❌"
echo -n "WHATSAPP_PHONE_NUMBER_ID set: " && grep -q "^WHATSAPP_PHONE_NUMBER_ID=.\{5,\}" .env.prod && echo "✅" || echo "❌"
echo "====================================="
```

---

## ⏭️ Prochaine étape

Une fois cette checklist complétée :
1. Transférer `.env.prod` sur le VPS (`scp` ou copie sécurisée)
2. Continuer avec `VPS_BOOTSTRAP.md`
3. Puis `GO_LIVE_CHECKLIST.md`

---

**Document maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-15
