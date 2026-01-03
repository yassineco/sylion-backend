# API Documentation - Knowledge Admin

## Overview

This document describes the Knowledge Admin API endpoints for managing RAG documents with quota enforcement.

## Base URL

```
/admin/knowledge
```

## Authentication

All endpoints require the `X-Tenant-ID` header to identify the tenant.

```
X-Tenant-ID: <uuid>
```

---

## Endpoints

### GET /admin/knowledge/documents

List knowledge documents for a tenant with pagination and filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | - | Filter by status: `uploaded`, `indexing`, `indexed`, `error` |
| `type` | string | - | Filter by document type: `txt`, `md`, `pdf`, `docx`, etc. |
| `search` | string | - | Search in document names |

**Response:**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "name": "document-name.txt",
        "originalName": "Document Name.txt",
        "type": "txt",
        "mimeType": "text/plain",
        "sizeBytes": 12345,
        "status": "indexed",
        "errorReason": null,
        "chunkCount": 5,
        "totalTokens": 1200,
        "tags": ["tag1", "tag2"],
        "uploadedBy": "admin@example.com",
        "createdAt": "2025-12-31T10:00:00Z",
        "updatedAt": "2025-12-31T10:05:00Z",
        "indexedAt": "2025-12-31T10:05:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

---

### GET /admin/knowledge/documents/:id

Get a single document by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "document-name.txt",
    "status": "indexed",
    ...
  }
}
```

**Error Responses:**

- `404 Not Found` - Document not found

---

### POST /admin/knowledge/documents

Upload one or more documents for RAG indexing.

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | Yes | One or more files to upload |
| `uploadedBy` | string | No | Email or identifier of uploader |

**Supported File Types:**

- `text/plain` (.txt)
- `text/markdown` (.md)
- `text/html` (.html)
- `application/pdf` (.pdf)
- `application/json` (.json)

**Response:**

```json
{
  "success": true,
  "data": {
    "successful": [
      {
        "id": "uuid",
        "name": "document1.txt",
        "status": "uploaded"
      }
    ],
    "failed": [
      {
        "name": "document2.pdf",
        "error": "File size 52MB exceeds maximum allowed 50MB"
      }
    ],
    "totalUploaded": 1,
    "totalFailed": 1
  }
}
```

**Error Responses:**

- `400 Bad Request` - No files provided
- `403 Forbidden` - Quota exceeded (with details)

---

### DELETE /admin/knowledge/documents/:id

Delete a document and all its chunks.

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "uuid"
  }
}
```

**Error Responses:**

- `404 Not Found` - Document not found

---

### POST /admin/knowledge/documents/:id/reindex

Trigger reindexation of a document.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "indexing",
    "message": "Reindexing started"
  }
}
```

**Error Responses:**

- `404 Not Found` - Document not found
- `403 Forbidden` - Daily indexing quota exceeded

---

### GET /admin/knowledge/stats

Get knowledge statistics and quota usage for a tenant.

**Response:**

```json
{
  "success": true,
  "data": {
    "documentsCount": 15,
    "storageMb": 45.5,
    "limits": {
      "maxDocuments": 100,
      "maxStorageMb": 500,
      "maxDocSizeMb": 25,
      "ragEnabled": true
    },
    "dailyUsage": {
      "docsIndexedCount": 5,
      "ragQueriesCount": 150,
      "messagesCount": 1200,
      "tokensIn": 50000,
      "tokensOut": 25000,
      "aiRequestsCount": 100,
      "storageBytesAdded": 5242880
    },
    "planCode": "pro"
  }
}
```

---

## Document Statuses

| Status | Description |
|--------|-------------|
| `uploaded` | Document uploaded, waiting for indexation |
| `indexing` | Document is being chunked and embeddings are being generated |
| `indexed` | Document successfully indexed and searchable |
| `error` | Indexation failed (see `errorReason` field) |

### Status Transitions

```
uploaded ──┬──> indexing ──┬──> indexed
           │               │
           │               └──> error
           │
           └──> (deleted)
```

---

## Quota Enforcement

### Atomic Daily Indexing Limit

The indexing quota is enforced **atomically** in PostgreSQL before any indexation begins.
This prevents race conditions where multiple concurrent indexation jobs could exceed the limit.

**Enforcement point:** `consumeDailyIndexingOrThrow()` in `quota.service.ts`

**Behavior:**
1. Insert or get daily counter row (upsert)
2. Atomically increment `docs_indexed_count` **only if** under limit
3. If increment fails (0 rows updated), throw `QuotaError`

**SQL pattern used:**
```sql
UPDATE usage_counters_daily
SET docs_indexed_count = docs_indexed_count + 1
WHERE tenant_id = $1 AND date = $2
  AND docs_indexed_count + 1 <= $maxDailyIndexing
RETURNING docs_indexed_count;
```

---

## Quota Error Response

When a quota is exceeded, the API returns a `403 Forbidden` response:

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily indexing limit reached: 50/50",
    "details": {
      "currentCount": 50,
      "maxDailyIndexing": 50,
      "type": "indexing"
    },
    "timestamp": "2025-12-31T23:59:59Z"
  }
}
```

---

## Plans and Limits

| Plan | Max Documents | Max Storage | Max Doc Size | Daily Indexing | Daily RAG Queries |
|------|---------------|-------------|--------------|----------------|-------------------|
| Starter | 10 | 50 MB | 5 MB | 5 | 100 |
| Pro | 100 | 500 MB | 25 MB | 50 | 1,000 |
| Business | 500 | 2 GB | 50 MB | 200 | 5,000 |
| Enterprise | ∞ | ∞ | 100 MB | ∞ | ∞ |

---

## cURL Examples

### Upload a document

```bash
curl -X POST http://localhost:3000/admin/knowledge/documents \
  -H "X-Tenant-ID: your-tenant-uuid" \
  -F "files=@/path/to/document.txt" \
  -F "uploadedBy=admin@example.com"
```

### List documents

```bash
curl http://localhost:3000/admin/knowledge/documents?status=indexed \
  -H "X-Tenant-ID: your-tenant-uuid"
```

### Delete a document

```bash
curl -X DELETE http://localhost:3000/admin/knowledge/documents/doc-uuid \
  -H "X-Tenant-ID: your-tenant-uuid"
```

### Reindex a document

```bash
curl -X POST http://localhost:3000/admin/knowledge/documents/doc-uuid/reindex \
  -H "X-Tenant-ID: your-tenant-uuid"
```

### Get statistics

```bash
curl http://localhost:3000/admin/knowledge/stats \
  -H "X-Tenant-ID: your-tenant-uuid"
```
