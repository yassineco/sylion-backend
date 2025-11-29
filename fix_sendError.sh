#!/bin/bash

# Fichier à corriger
file="/media/yassine/IA/Projects/SylionTech/sylion-backend/src/modules/tenant/tenant.controller.ts"

# Chercher et remplacer les patterns sendError avec 6 arguments par 5 arguments
# Pattern: sendError(reply, ErrorCode, message, statusCode, details, requestId)
# Vers: sendError(reply, ErrorCode, message, details, requestId)

# Pattern 1: sendError avec 6 arguments où le 4e est un nombre (statusCode)
sed -i 's/sendError(\([^,]*\),\([^,]*\),\([^,]*\),[ ]*[0-9][0-9]*,\([^,]*\),\([^)]*\))/sendError(\1,\2,\3,\4,\5)/g' "$file"

# Pattern 2: sendError avec 6 arguments multilignes
perl -i -pe 'BEGIN{undef $/;} s/sendError\(\s*([^,\n]*),\s*([^,\n]*),\s*([^,\n]*),\s*[0-9]+,\s*([^,\n]*),\s*([^)\n]*)\s*\)/sendError(\1,\2,\3,\4,\5)/gs' "$file"

echo "Correction des appels sendError terminée"