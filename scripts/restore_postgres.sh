#!/bin/bash
# ============================================
# PostgreSQL Restore Script - Sylion Backend
# ============================================
# Usage: ./scripts/restore_postgres.sh <backup_file.sql.gz>
# Requires: ENV_FILE environment variable pointing to .env.prod
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="sylion-postgres"

# ============================================
# Validate arguments
# ============================================
if [[ $# -lt 1 ]]; then
    echo "❌ ERROR: Backup file required"
    echo ""
    echo "Usage: ENV_FILE=.env.prod $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "${PROJECT_DIR}/backups/postgres/"*.sql.gz 2>/dev/null || echo "  (none)"
    exit 1
fi

BACKUP_FILE="$1"

# Handle relative paths
if [[ ! "${BACKUP_FILE}" = /* ]]; then
    BACKUP_FILE="${PROJECT_DIR}/${BACKUP_FILE}"
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "❌ ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# ============================================
# Load environment
# ============================================
if [[ -z "${ENV_FILE:-}" ]]; then
    echo "❌ ERROR: ENV_FILE must be set (e.g., ENV_FILE=.env.prod)"
    exit 1
fi

if [[ ! -f "${PROJECT_DIR}/${ENV_FILE}" ]]; then
    echo "❌ ERROR: Environment file not found: ${PROJECT_DIR}/${ENV_FILE}"
    exit 1
fi

# Source environment variables
set -a
source "${PROJECT_DIR}/${ENV_FILE}"
set +a

# ============================================
# Validate required variables
# ============================================
REQUIRED_VARS=("POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "❌ ERROR: Required variable $var is not set"
        exit 1
    fi
done

# ============================================
# Check container is running
# ============================================
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ ERROR: Container ${CONTAINER_NAME} is not running"
    exit 1
fi

# ============================================
# Warning and confirmation
# ============================================
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
BACKUP_DATE=$(stat -c %y "${BACKUP_FILE}" | cut -d' ' -f1,2 | cut -d'.' -f1)

echo ""
echo "⚠️  WARNING: DATABASE RESTORE OPERATION"
echo "============================================"
echo "This will OVERWRITE the current database!"
echo ""
echo "   Database:    ${POSTGRES_DB}"
echo "   Container:   ${CONTAINER_NAME}"
echo "   Backup file: ${BACKUP_FILE}"
echo "   Backup size: ${BACKUP_SIZE}"
echo "   Backup date: ${BACKUP_DATE}"
echo ""
echo "============================================"
echo ""

read -p "Are you sure you want to proceed? Type 'YES' to confirm: " CONFIRM

if [[ "${CONFIRM}" != "YES" ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# ============================================
# Stop backend to prevent connections
# ============================================
echo ""
echo "🔄 Stopping backend to prevent active connections..."
docker stop sylion-backend 2>/dev/null || true

# ============================================
# Perform restore
# ============================================
echo "🔄 Restoring database from backup..."
echo "   This may take a few minutes..."

gunzip -c "${BACKUP_FILE}" | docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${CONTAINER_NAME}" \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --quiet

# ============================================
# Restart backend
# ============================================
echo "🔄 Restarting backend..."
docker start sylion-backend

# Wait for backend to be healthy
echo "🔄 Waiting for backend to be healthy..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health | grep -q "200"; then
        echo "✅ Backend is healthy"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "⚠️  Backend health check timed out (may still be starting)"
    fi
    sleep 2
done

# ============================================
# Summary
# ============================================
echo ""
echo "✅ Database restore completed successfully"
echo ""
echo "📋 Post-restore checklist:"
echo "   [ ] Verify application functionality"
echo "   [ ] Check backend logs: docker logs sylion-backend --tail=50"
echo "   [ ] Test critical endpoints"
echo ""
echo "🎉 Done!"
