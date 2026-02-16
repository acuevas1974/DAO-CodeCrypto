#!/usr/bin/env bash
# Terminal 4 (opcional): Inicia el daemon que ejecuta propuestas elegibles cada 5 s.
# Requiere Anvil y .env.local con RELAYER_PRIVATE_KEY y direcciones.

set -e
cd "$(dirname "$0")/../frontend"
echo ">>> Iniciando daemon de ejecución de propuestas..."
exec npm run daemon
