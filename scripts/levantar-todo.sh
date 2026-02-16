#!/usr/bin/env bash
# Opcion todo en uno: Anvil + deploy + frontend y daemon en segundo plano.
# Para detener: pkill -f anvil; pkill -f "next dev"; pkill -f run-execute-daemon

set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
RPC="http://127.0.0.1:8545"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo ">>> 1/4 Anvil en segundo plano..."
anvil &
ANVIL_PID=$!
sleep 3

echo ">>> 2/4 Desplegando contratos..."
OUTPUT=$(forge script script/DeployDAO.s.sol --rpc-url "$RPC" --broadcast --private-key "$PRIVATE_KEY" 2>&1)
echo "$OUTPUT"
FORWARDER=$(echo "$OUTPUT" | grep "MinimalForwarder:" | sed 's/.*: //')
DAO=$(echo "$OUTPUT" | grep "DAOVoting:" | sed 's/.*: //')

echo ">>> 3/4 Frontend en segundo plano..."
(cd "$REPO/frontend" && npm run dev) &
sleep 5
echo ">>> 4/4 Daemon en segundo plano..."
(cd "$REPO/frontend" && npm run daemon) &

echo ">>> Listo. Frontend: http://localhost:3000"
echo ">>> Actualiza frontend/.env.local con NEXT_PUBLIC_FORWARDER_ADDRESS=$FORWARDER y NEXT_PUBLIC_DAO_ADDRESS=$DAO"
wait
