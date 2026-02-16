#!/usr/bin/env bash
# Terminal 3: Inicia el frontend Next.js.
# Anvil debe estar corriendo. .env.local debe tener las direcciones del paso 02.

set -e
cd "$(dirname "$0")/../frontend"
echo ">>> Iniciando frontend en http://localhost:3000 ..."
exec npm run dev
