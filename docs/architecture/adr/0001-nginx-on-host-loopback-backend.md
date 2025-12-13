# ADR 0001 — Nginx sur le host du VPS, backend exposé en loopback

## Status

`Accepted`

## Date

2025-12-13

---

## Context

Le backend Sylion tourne dans Docker sur un VPS. Il doit être accessible via HTTPS depuis Internet pour recevoir les webhooks WhatsApp et servir l'API.

Plusieurs options existent pour exposer le backend :
- Nginx dans Docker (même réseau que le backend)
- Nginx sur le host du VPS (hors Docker)
- Exposer le backend directement sur Internet

Contraintes :
- Certificats TLS gérés par Let's Encrypt (Certbot)
- PostgreSQL et Redis ne doivent jamais être exposés
- Simplicité opérationnelle (un seul VPS, pas de Kubernetes)
- Sécurité : minimiser la surface d'attaque

---

## Decision

**Nginx est installé sur le host du VPS (hors Docker) et proxifie vers le backend Docker exposé uniquement en loopback (`127.0.0.1:8000`).**

Configuration :
- Le backend Docker utilise `ports: "127.0.0.1:8000:8000"` (pas `expose:`)
- Nginx sur le host écoute sur 80/443 et proxifie vers `http://127.0.0.1:8000`
- PostgreSQL et Redis restent internes au réseau Docker (`sylion-network`)
- Les certificats TLS sont gérés par Certbot sur le host

---

## Consequences

### Positives
- **Sécurité** : le backend n'est pas accessible depuis Internet, uniquement via Nginx
- **TLS simple** : Certbot fonctionne nativement sur le host, pas besoin de volume Docker
- **Séparation des responsabilités** : Nginx gère TLS/routing, Docker gère l'application
- **Debugging facile** : `curl http://127.0.0.1:8000/health` depuis le VPS
- **Pas de réseau Docker externe** : architecture plus simple

### Negatives
- **Dépendance Nginx host** : nécessite maintenance OS (apt upgrade, etc.)
- **Mapping ports explicite** : `ports:` au lieu de `expose:` dans docker-compose
- **Pas de failover Nginx** : single point of failure (acceptable pour un VPS)

---

## Alternatives Considered

| Alternative | Pourquoi rejetée |
|-------------|------------------|
| Nginx dans Docker (même network) | Complexifie la gestion TLS (volumes, renouvellement Certbot) |
| Exposer backend sur `0.0.0.0:8000` | Dangereux : expose l'API directement sur Internet |
| Traefik dans Docker | Overkill pour un seul backend, courbe d'apprentissage |
| Caddy | Moins répandu, équipe familière avec Nginx |

---

## References

- Documentation : [README.md - Déploiement VPS Production](../../../README.md)
- Configuration : [docker-compose.prod.yml](../../../docker-compose.prod.yml)
- Checklist : [operations/GO_LIVE_CHECKLIST.md](../../operations/GO_LIVE_CHECKLIST.md)
