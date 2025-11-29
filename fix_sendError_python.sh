#!/bin/bash

# Fichier à corriger
file="/media/yassine/IA/Projects/SylionTech/sylion-backend/src/modules/tenant/tenant.controller.ts"

# Script de correction plus précis pour sendError
python3 << 'EOF'
import re

with open('/media/yassine/IA/Projects/SylionTech/sylion-backend/src/modules/tenant/tenant.controller.ts', 'r') as f:
    content = f.read()

# Pattern pour capturer sendError avec 6 arguments
# sendError(reply, ErrorCode, message, statusCode, details, requestId)
pattern = r'sendError\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\d+),\s*([^,]*),\s*([^)]*)\s*\)'

def replace_func(match):
    reply = match.group(1)
    error_code = match.group(2)
    message = match.group(3)
    # skip statusCode (group 4)
    details = match.group(5)
    request_id = match.group(6)
    
    return f'sendError({reply},{error_code},{message},{details},{request_id})'

# Remplacer tous les occurrences
new_content = re.sub(pattern, replace_func, content)

with open('/media/yassine/IA/Projects/SylionTech/sylion-backend/src/modules/tenant/tenant.controller.ts', 'w') as f:
    f.write(new_content)

print("Fixed sendError calls")
EOF