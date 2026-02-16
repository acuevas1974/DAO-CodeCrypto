#!/usr/bin/env bash
# Terminal 2: Despliega los contratos en Anvil.
# Ejecutar SOLO cuando Anvil ya esté corriendo (Terminal 1).

set -e
cd "$(dirname "$0")/.."

RPC="http://127.0.0.1:8545"
# Clave privada de la cuenta 0 de Anvil (solo desarrollo)
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo ">>> Desplegando MinimalForwarder y DAOVoting en Anvil..."
OUTPUT=$(forge script script/DeployDAO.s.sol --rpc-url "$RPC" --broadcast --private-key "$PRIVATE_KEY" 2>&1)
echo "$OUTPUT"

FORWARDER=$(echo "$OUTPUT" | grep "MinimalForwarder:" | sed 's/.*: //')
DAO=$(echo "$OUTPUT" | grep "DAOVoting:" | sed 's/.*: //')

echo ""
echo ">>> Direcciones (cópialas a frontend/.env.local):"
echo "NEXT_PUBLIC_FORWARDER_ADDRESS=$FORWARDER"
echo "NEXT_PUBLIC_DAO_ADDRESS=$DAO"
echo "FORWARDER_ADDRESS=$FORWARDER"
echo "DAO_ADDRESS=$DAO"
echo ""
echo ">>> Si cambiaste las direcciones en .env.local, reinicia el frontend (Terminal 3)."
