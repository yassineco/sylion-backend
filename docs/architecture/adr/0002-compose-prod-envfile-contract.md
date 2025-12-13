# ADR 0002 — Docker Compose prod + ENV_FILE comme contrat

## Status

`Accepted`

## Date

2025-12-13

---

## Context

Le backend Sylion utilise Docker Compose pour le déploiement production. Plusieurs secrets sont nécessaires :
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `WHATSAPP_API_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

Problèmes rencontrés :
- Docker Compose charge `.env` implicitement, ce qui peut créer des comportements non déterministes
- L'interpolation `${VAR}` dans le fichier compose et l'injection `env_file:` dans les containers sont deux mécanismes séparés
- Un secret manquant doit faire échouer le démarrage immédiatement (fail-fast)

---

## Decision

**Utiliser `ENV_FILE` comme variable obligatoire, servant à la fois pour l'interpolation et l'injection.**

Implémentation :
```yaml
# docker-compose.prod.yml
services:
  backend:
    env_file:
      - ${ENV_FILE:?ENV_FILE must be set}
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      # ... autres secrets avec :?
```

Commande de démarrage :
```bash
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Contrat :
- `ENV_FILE` est **obligatoire** (pas de valeur par défaut)
- `--env-file` fournit les variables pour l'interpolation du fichier compose
- `env_file:` injecte les mêmes variables dans les containers
- Les deux pointent vers le même fichier

---

## Consequences

### Positives
- **Fail-fast** : si un secret manque, `docker compose` refuse de démarrer avec un message clair
- **Reproductible** : pas de comportement implicite, tout est explicite
- **Testable** : `ENV_FILE=.env.tmp docker compose --env-file .env.tmp ... config` valide la syntaxe sans vrais secrets
- **Documentable** : une seule source de vérité (`ENV_FILE`)

### Negatives
- **Verbosité** : la commande est plus longue (`ENV_FILE=... --env-file ...`)
- **Discipline requise** : l'équipe doit suivre la convention
- **Pas de fallback** : si `ENV_FILE` n'est pas défini, rien ne démarre (voulu)

---

## Alternatives Considered

| Alternative | Pourquoi rejetée |
|-------------|------------------|
| `.env` implicite | Non déterministe, risque de confusion entre fichiers |
| `export` des variables shell | Fragile, pas traçable, dépend du contexte shell |
| Docker secrets (Swarm) | Pas de Swarm, overkill pour un VPS simple |
| HashiCorp Vault | Complexité excessive pour le stade actuel |

---

## References

- Documentation : [README.md - Déploiement VPS Production](../../../README.md)
- Configuration : [docker-compose.prod.yml](../../../docker-compose.prod.yml)
- Template : [.env.prod.example](../../../.env.prod.example)
- Checklist : [operations/GO_LIVE_CHECKLIST.md](../../operations/GO_LIVE_CHECKLIST.md)
