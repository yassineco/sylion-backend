#!/bin/bash

# Script de correction automatique des erreurs TypeScript Sylion Backend

cd /media/yassine/IA/Projects/SylionTech/sylion-backend

echo "🔧 Correction automatique des erreurs TypeScript..."

# 1. Corriger les ErrorCodes dans tous les fichiers
echo "📝 Correction des ErrorCodes..."

# Remplacer toutes les utilisations incorrectes d'ErrorCodes
find src -name "*.ts" -not -path "src/db/*" -exec sed -i "
s/throw new SylionError('Tenant non trouvé'/throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé'/g
s/throw new SylionError('Channel non trouvé'/throw new SylionError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel non trouvé'/g
s/throw new SylionError('Assistant non trouvé'/throw new SylionError(ErrorCodes.ASSISTANT_NOT_FOUND, 'Assistant non trouvé'/g
s/throw new SylionError('Conversation non trouvée'/throw new SylionError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Conversation non trouvée'/g
s/throw new SylionError('Message non trouvé'/throw new SylionError(ErrorCodes.MESSAGE_NOT_FOUND, 'Message non trouvé'/g
s/code: ErrorCodes\.INTERNAL_ERROR//g
s/code: ErrorCodes\.NOT_FOUND//g
s/code: ErrorCodes\.CONFLICT//g
" {} \;

# 2. Corriger la notation par crochets pour updateData
echo "🔧 Correction de la notation updateData..."

find src -name "*.service.ts" -exec sed -i "
s/updateData\.\([a-zA-Z][a-zA-Z0-9]*\) =/updateData['\1'] =/g
" {} \;

echo "✅ Corrections automatiques appliquées."
echo "🧪 Test de compilation..."

npx tsc --noEmit --pretty 2>&1 | head -20