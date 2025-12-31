/**
 * ================================
 * Knowledge Admin Page - React Example
 * ================================
 * 
 * Example React component for the admin knowledge page.
 * Includes upload (drag & drop), document list, status badges, and actions.
 * 
 * Dependencies:
 * - React 18+
 * - TypeScript
 * - TailwindCSS (for styling)
 * - Lucide React (for icons)
 * 
 * Usage:
 * Copy this file to your frontend project and adjust the API_BASE_URL and TENANT_ID.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';

// ================================
// Types
// ================================

type DocumentStatus = 'uploaded' | 'indexing' | 'indexed' | 'error';

interface KnowledgeDocument {
  id: string;
  tenantId: string;
  name: string;
  originalName: string | null;
  type: string;
  mimeType: string | null;
  sizeBytes: number;
  status: DocumentStatus;
  errorReason: string | null;
  chunkCount: number;
  totalTokens: number;
  tags: string[];
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
}

interface DocumentListResponse {
  documents: KnowledgeDocument[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Stats {
  documentsCount: number;
  storageMb: number;
  limits: {
    maxDocuments: number;
    maxStorageMb: number;
    maxDocSizeMb: number;
    ragEnabled: boolean;
  };
  dailyUsage: {
    docsIndexedCount: number;
    ragQueriesCount: number;
    messagesCount: number;
  };
  planCode: string;
}

// ================================
// Configuration
// ================================

const API_BASE_URL = 'http://localhost:3000/admin/knowledge';
const TENANT_ID = 'your-tenant-uuid'; // Replace with actual tenant ID

// ================================
// API Client
// ================================

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-Tenant-ID': TENANT_ID,
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'API Error');
  }
  
  return data.data;
}

// ================================
// Status Badge Component
// ================================

function StatusBadge({ status, errorReason }: { status: DocumentStatus; errorReason?: string | null }) {
  const statusConfig = {
    uploaded: { color: 'bg-yellow-100 text-yellow-800', label: 'Uploaded' },
    indexing: { color: 'bg-blue-100 text-blue-800', label: 'Indexing...' },
    indexed: { color: 'bg-green-100 text-green-800', label: 'Indexed' },
    error: { color: 'bg-red-100 text-red-800', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {status === 'indexing' && (
          <span className="inline-block animate-spin mr-1">⟳</span>
        )}
        {config.label}
      </span>
      {errorReason && (
        <span className="text-xs text-red-600 truncate max-w-48" title={errorReason}>
          {errorReason}
        </span>
      )}
    </div>
  );
}

// ================================
// File Size Formatter
// ================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ================================
// Upload Zone Component
// ================================

function UploadZone({ 
  onUpload, 
  isUploading 
}: { 
  onUpload: (files: File[]) => void; 
  isUploading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onUpload(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onUpload(Array.from(e.target.files));
    }
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-8 text-center
        transition-colors cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        multiple
        className="hidden"
        accept=".txt,.md,.pdf,.html,.json,.docx"
        onChange={handleFileSelect}
      />
      
      <div className="text-4xl mb-2">📄</div>
      
      {isUploading ? (
        <p className="text-gray-600">Uploading...</p>
      ) : (
        <>
          <p className="text-gray-700 font-medium">
            Drag & drop files here, or click to select
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Supports: TXT, MD, PDF, HTML, JSON, DOCX
          </p>
        </>
      )}
    </div>
  );
}

// ================================
// Document Table Component
// ================================

function DocumentTable({
  documents,
  onDelete,
  onReindex,
  isLoading,
}: {
  documents: KnowledgeDocument[];
  onDelete: (id: string) => void;
  onReindex: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No documents yet. Upload some files to get started!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Chunks
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <span className="text-lg mr-2">
                    {doc.type === 'pdf' ? '📕' : doc.type === 'md' ? '📝' : '📄'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">{doc.name}</div>
                    {doc.originalName && doc.originalName !== doc.name && (
                      <div className="text-xs text-gray-500">{doc.originalName}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {doc.type.toUpperCase()}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {formatBytes(doc.sizeBytes)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={doc.status} errorReason={doc.errorReason} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {doc.chunkCount > 0 ? (
                  <span>{doc.chunkCount} chunks</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <div className="flex gap-2">
                  <button
                    onClick={() => onReindex(doc.id)}
                    disabled={doc.status === 'indexing'}
                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Reindex"
                  >
                    🔄
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this document?')) {
                        onDelete(doc.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ================================
// Stats Card Component
// ================================

function StatsCard({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  const documentsPercent = stats.limits.maxDocuments > 0
    ? (stats.documentsCount / stats.limits.maxDocuments) * 100
    : 0;
  
  const storagePercent = stats.limits.maxStorageMb > 0
    ? (stats.storageMb / stats.limits.maxStorageMb) * 100
    : 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">Usage</h3>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
          {stats.planCode.toUpperCase()}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Documents</span>
            <span>{stats.documentsCount} / {stats.limits.maxDocuments === -1 ? '∞' : stats.limits.maxDocuments}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(documentsPercent, 100)}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Storage</span>
            <span>{stats.storageMb.toFixed(1)} / {stats.limits.maxStorageMb === -1 ? '∞' : stats.limits.maxStorageMb} MB</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        Today: {stats.dailyUsage.docsIndexedCount} indexed • {stats.dailyUsage.ragQueriesCount} RAG queries
      </div>
    </div>
  );
}

// ================================
// Main Page Component
// ================================

export default function KnowledgeAdminPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling for status updates when documents are indexing
  const hasIndexingDocs = documents.some(d => d.status === 'indexing');

  // Load documents and stats
  const loadData = useCallback(async () => {
    try {
      const [docsData, statsData] = await Promise.all([
        fetchApi<DocumentListResponse>('/documents?limit=100'),
        fetchApi<Stats>('/stats'),
      ]);
      setDocuments(docsData.documents);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling when indexing
  useEffect(() => {
    if (hasIndexingDocs) {
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }
  }, [hasIndexingDocs, loadData]);

  // Upload handler
  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('uploadedBy', 'admin');

      await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: { 'X-Tenant-ID': TENANT_ID },
        body: formData,
      });

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      await fetchApi(`/documents/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Reindex handler
  const handleReindex = async (id: string) => {
    try {
      await fetchApi(`/documents/${id}/reindex`, { method: 'POST' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        📚 Knowledge Base
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <StatsCard stats={stats} />

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <UploadZone onUpload={handleUpload} isUploading={isUploading} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Documents</h2>
        </div>
        <DocumentTable
          documents={documents}
          onDelete={handleDelete}
          onReindex={handleReindex}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
