# Cómo levantar y probar la aplicación DAO

Sigue estos pasos **en orden**. Cada bloque es una terminal distinta.

---

## Opción A: Tres terminales (recomendado para ver logs)

### Terminal 1 — Anvil

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO
./scripts/01-iniciar-anvil.sh
```

O directamente:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO
anvil
```

**Deja esta terminal abierta.** Anvil debe seguir corriendo.

---

### Terminal 2 — Desplegar contratos

Solo cuando Anvil esté corriendo:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO
./scripts/02-desplegar-contratos.sh
```

O directamente:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO
forge script script/DeployDAO.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Copia las direcciones que imprima y actualiza `frontend/.env.local`:

- `NEXT_PUBLIC_FORWARDER_ADDRESS`
- `NEXT_PUBLIC_DAO_ADDRESS`
- `FORWARDER_ADDRESS`
- `DAO_ADDRESS`

---

### Terminal 3 — Frontend

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend
./scripts/03-iniciar-frontend.sh
```

O:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend
npm run dev
```

Abre **http://localhost:3000** en el navegador.

---

### Terminal 4 (opcional) — Daemon

Para que se ejecuten solas las propuestas aprobadas:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend
./scripts/04-iniciar-daemon.sh
```

O:

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend
npm run daemon
```

---

## Opción B: Un solo script (todo en segundo plano)

```bash
cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO
chmod +x scripts/*.sh
./scripts/levantar-todo.sh
```

Levanta Anvil, despliega, frontend y daemon. La primera vez revisa/actualiza `frontend/.env.local` con las direcciones que imprime el script.

**Para detener todo:**

```bash
pkill -f anvil
pkill -f "next dev"
pkill -f run-execute-daemon
```

---

## Resumen de comandos (copiar y pegar)

| Orden | Terminal | Comando |
|-------|----------|--------|
| 1 | 1 | `cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO && anvil` |
| 2 | 2 | `cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO && forge script script/DeployDAO.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 3 | 3 | `cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend && npm run dev` |
| 4 | 4 (opcional) | `cd /home/acuevas/Documentos/ProyectosDev/CodeCrypto/DAO/frontend && npm run daemon` |

---

## Probar la app

1. En el navegador: http://localhost:3000
2. Conectar MetaMask a **Localhost 8545** (chainId 31337).
3. Usar una cuenta de Anvil (p. ej. cuenta 0) con ETH.
4. Depositar ETH en el DAO, crear propuesta, votar (normal o gasless).
5. Para probar el daemon: avanzar tiempo con `cast rpc anvil_increaseTime 86401 --rpc-url http://127.0.0.1:8545` y `cast rpc anvil_mine --rpc-url http://127.0.0.1:8545`; el daemon ejecutará propuestas elegibles.
