# Local Development — Source of Truth

## Principle

The backend runs on the host machine (Node.js).  
Docker is used **only** for dependencies (Postgres, Redis).

---

## Environment

| Item | Value |
|------|-------|
| Environment file | `.env.local` |
| Location | Repository root |
| Versioned | Yes |
| Manual creation required | No |

The application loads `.env.local` explicitly. No `.env.example` is used in local development.

---

## Docker (Dependencies Only)

**Compose file:** `docker-compose.dev.yml`

**Command:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**Services:**

| Service         | Host Port | Container Port | Notes              |
|-----------------|-----------|----------------|--------------------|
| PostgreSQL      | 5433      | 5432           | pgvector enabled   |
| Redis           | 6380      | 6379           | Backend + workers  |
| Redis Commander | 8081      | 8081           | Web UI             |

---

## Port Contract

| Port | Assignment | Notes |
|------|------------|-------|
| 5432 | Native Postgres | May already be in use on dev machine |
| 5433 | Docker Postgres DEV | **Use this one** |
| 6379 | Generic Redis | **Do NOT use for this project** |
| 6380 | Docker Redis DEV | **Use this one** |

---

## Backend

The backend does **not** run inside Docker in local development.

**Command:**
```bash
npm run dev
```

---

## Database Migrations

Migrations are run manually.

**Command:**
```bash
npm run db:migrate
```

---

## Common Pitfalls

- Always specify the compose file: `docker compose -f docker-compose.dev.yml ...`
- Do not run multiple Redis instances on different ports
- Ensure `REDIS_URL` is identical for backend and workers (port 6380)
- HTTP 200 on a webhook does not guarantee message processing

---

## Document Status

This document is authoritative.  
If behavior differs, the code wins and this document must be updated.
