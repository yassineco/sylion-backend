#!/bin/bash
# ============================================
# PostgreSQL Backup Script - Sylion Backend
# ============================================
# Usage: ./scripts/backup_postgres.sh
# Requires: ENV_FILE environment variable pointing to .env.prod
# Output: backups/postgres/sylion_YYYY-MM-DD_HHMMSS.sql.gz
# ============================================

set -euo pipefail

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups/postgres"
CONTAINER_NAME="sylion-postgres"
RETENTION_DAYS=7

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
# Create backup directory
# ============================================
mkdir -p "${BACKUP_DIR}"

# ============================================
# Generate backup filename
# ============================================
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sylion_${TIMESTAMP}.sql.gz"

# ============================================
# Perform backup
# ============================================
echo "🔄 Starting PostgreSQL backup..."
echo "   Database: ${POSTGRES_DB}"
echo "   Container: ${CONTAINER_NAME}"
echo "   Output: ${BACKUP_FILE}"

docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${CONTAINER_NAME}" \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists \
    | gzip > "${BACKUP_FILE}"

# ============================================
# Verify backup
# ============================================
if [[ ! -f "${BACKUP_FILE}" ]] || [[ ! -s "${BACKUP_FILE}" ]]; then
    echo "❌ ERROR: Backup file is empty or missing"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup completed successfully"
echo "   File: ${BACKUP_FILE}"
echo "   Size: ${BACKUP_SIZE}"

# ============================================
# Cleanup old backups
# ============================================
echo "🧹 Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "sylion_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "   Deleted: ${DELETED_COUNT} old backup(s)"

# ============================================
# Summary
# ============================================
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "sylion_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo ""
echo "📊 Backup Summary:"
echo "   Total backups: ${TOTAL_BACKUPS}"
echo "   Total size: ${TOTAL_SIZE}"
echo "   Retention: ${RETENTION_DAYS} days"
echo ""
echo "🎉 Done!"
