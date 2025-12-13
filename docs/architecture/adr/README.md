# 📐 Architecture Decision Records (ADR)

> **Objectif :** Documenter les décisions d'architecture significatives de manière traçable et justifiée.

---

## Pourquoi des ADR ?

Les ADR permettent de :
- **Tracer** les décisions importantes et leur contexte
- **Comprendre** pourquoi un choix a été fait (même dans 6 mois)
- **Éviter** de rediscuter les mêmes sujets sans nouvelle information
- **Onboarder** les nouveaux membres rapidement sur l'historique technique

---

## Comment créer un ADR ?

1. Copier le template : `cp TEMPLATE.md NNNN-titre-court.md`
2. Remplir toutes les sections
3. Soumettre en PR avec statut `Proposed`
4. Après validation équipe → passer en `Accepted`
5. Mettre à jour ce README (table des ADR)

---

## Convention de nommage

```
NNNN-titre-court-en-kebab-case.md
```

Exemples :
- `0001-nginx-on-host-loopback-backend.md`
- `0002-compose-prod-envfile-contract.md`

---

## Statuts possibles

| Statut | Signification |
|--------|---------------|
| `Proposed` | En discussion, pas encore validé |
| `Accepted` | Validé et appliqué |
| `Deprecated` | Plus pertinent, mais historique conservé |
| `Superseded by ADR-XXXX` | Remplacé par un autre ADR |

---

## Liste des ADR

| # | Titre | Statut | Date |
|---|-------|--------|------|
| [0001](0001-nginx-on-host-loopback-backend.md) | Nginx sur le host, backend en loopback | Accepted | 2025-12-13 |
| [0002](0002-compose-prod-envfile-contract.md) | Docker Compose prod + ENV_FILE comme contrat | Accepted | 2025-12-13 |

---

## Règles

- Un ADR par décision significative
- Ne pas modifier un ADR `Accepted` → créer un nouvel ADR qui le supersede
- Les ADR `Deprecated` restent dans l'historique
- Format Markdown, ton factuel, pas de marketing
