# 🌐 Network Model — Sylion Backend Production

> **Décision :** Nginx host → Backend Docker via loopback

---

## Schéma

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS HOST                            │
│                                                             │
│   ┌─────────────┐      ┌──────────────────────────────────┐ │
│   │   Nginx     │      │         Docker Network           │ │
│   │  (host)     │      │        (sylion-network)          │ │
│   │             │      │                                  │ │
│   │  :80/:443   │──────│──► 127.0.0.1:8000 ──► backend    │ │
│   │  (public)   │      │                       :3000      │ │
│   └─────────────┘      │                                  │ │
│                        │   postgres (no port)             │ │
│                        │   redis    (no port)             │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Ports exposés

| Service   | Binding               | Accessible depuis |
|-----------|-----------------------|-------------------|
| Nginx     | `0.0.0.0:80/443`      | Internet (public) |
| Backend   | `127.0.0.1:8000:3000` | Host only         |
| PostgreSQL| aucun                 | Docker network    |
| Redis     | aucun                 | Docker network    |

---

## Justification

- **Sécurité :** PostgreSQL et Redis ne sont jamais exposés sur le réseau public. Le backend n'est accessible que via loopback, donc uniquement par Nginx sur le host.
- **Simplicité :** Pas de reverse proxy Docker (Traefik), pas de réseau overlay. Nginx gère SSL/TLS et rate-limiting directement sur le host.

---

**Référence :** ADR-0001 (`docs/architecture/adr/0001-nginx-on-host-loopback-backend.md`)
