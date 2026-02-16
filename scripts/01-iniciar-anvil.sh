#!/usr/bin/env bash
# Terminal 1: Inicia Anvil (red local Ethereum).
# Deja esta terminal abierta mientras trabajas.

set -e
cd "$(dirname "$0")/.."
echo ">>> Iniciando Anvil en http://127.0.0.1:8545 (chainId 31337)..."
exec anvil
