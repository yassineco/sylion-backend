# Frontend Examples — Knowledge Admin

This directory contains reference implementations for frontend integration with the Knowledge Admin API.

## Files

| File | Description |
|------|-------------|
| `KnowledgeAdminPage.tsx` | Full React component example |

---

## API Response Handling

### Document Statuses

The frontend must handle these document statuses:

| Status | UI Treatment | Polling |
|--------|--------------|---------|
| `uploaded` | Show "Pending" badge (yellow) | Poll every 2s |
| `indexing` | Show "Indexing" badge (blue) + spinner | Poll every 2s |
| `indexed` | Show "Ready" badge (green) | Stop polling |
| `error` | Show "Error" badge (red) + tooltip with reason | Stop polling |

### Polling Strategy

```typescript
// Poll while documents are in transitional states
const hasProcessing = documents.some(
  d => d.status === 'uploaded' || d.status === 'indexing'
);

if (hasProcessing) {
  pollInterval = setInterval(fetchDocuments, 2000);
}
```

---

## Quota Error Handling

### Error Response Structure

When a quota is exceeded, the API returns HTTP 403:

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily indexing limit reached: 5/5",
    "details": {
      "currentCount": 5,
      "maxDailyIndexing": 5,
      "type": "indexing"
    }
  }
}
```

### Error Codes Reference

| Code | When | User Message |
|------|------|--------------|
| `QUOTA_EXCEEDED` | Any quota limit reached | Show limit details from `error.details` |
| `DOCUMENTS_LIMIT_REACHED` | Max documents per tenant | "You've reached your plan's document limit" |
| `STORAGE_LIMIT_REACHED` | Max storage exceeded | "Storage limit exceeded" |
| `DOCUMENT_TOO_LARGE` | Single file too big | "File exceeds maximum size of X MB" |
| `DAILY_LIMIT_REACHED` | Daily indexing/query limit | "Daily limit reached. Resets at midnight." |
| `RAG_DISABLED` | RAG not in plan | "Upgrade your plan to use document search" |

### Frontend Error Handler Example

```typescript
async function handleApiError(response: Response) {
  const data = await response.json();
  
  if (data.error?.code === 'QUOTA_EXCEEDED') {
    const { type, currentCount, maxDailyIndexing } = data.error.details || {};
    
    if (type === 'indexing') {
      showToast({
        type: 'warning',
        title: 'Daily Limit Reached',
        message: `You've indexed ${currentCount}/${maxDailyIndexing} documents today. Limit resets at midnight.`,
        action: {
          label: 'Upgrade Plan',
          onClick: () => navigate('/billing')
        }
      });
    }
    return;
  }
  
  // Generic error
  showToast({
    type: 'error',
    title: 'Error',
    message: data.error?.message || 'An unexpected error occurred'
  });
}
```

---

## Stats Endpoint

Use `GET /admin/knowledge/stats` to display quota usage:

```typescript
interface StatsResponse {
  documentsCount: number;
  storageMb: number;
  limits: {
    maxDocuments: number;
    maxStorageMb: number;
    maxDocSizeMb: number;
    maxDailyIndexing: number;
    ragEnabled: boolean;
  };
  dailyUsage: {
    docsIndexedCount: number;
    ragQueriesCount: number;
  };
  planCode: string;
}
```

### Usage Bar Component

```typescript
function UsageBar({ current, max, label }: Props) {
  const percentage = max === -1 ? 0 : (current / max) * 100;
  const isUnlimited = max === -1;
  
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>{isUnlimited ? '∞' : `${current}/${max}`}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded">
        <div 
          className={`h-2 rounded ${percentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

---

## Required Headers

All requests must include:

```typescript
const headers = {
  'X-Tenant-ID': tenantId,
  'Content-Type': 'application/json' // except for multipart uploads
};
```

For file uploads, use `multipart/form-data` without explicit Content-Type (browser sets boundary).
