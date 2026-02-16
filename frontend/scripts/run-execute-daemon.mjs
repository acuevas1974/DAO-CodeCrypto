#!/usr/bin/env node

/**
 * Daemon para ejecutar propuestas del DAO automáticamente
 * Corre cada 5 segundos verificando propuestas elegibles
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), ".env.local") });

// Definir cadena localhost con chainId 31337 (Anvil)
const localhostChain = defineChain({
  id: 31_337,
  name: "Localhost",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
});

const DAO_ABI = [
  { inputs: [], name: "proposalCount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint256" }], name: "getProposal", outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }, { name: "description", type: "string" }, { name: "forVotes", type: "uint256" }, { name: "againstVotes", type: "uint256" }, { name: "abstainVotes", type: "uint256" }, { name: "status", type: "uint8" }] }], stateMutability: "view", type: "function" },
  { inputs: [], name: "SECURITY_PERIOD", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "proposalId", type: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
];

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS ?? process.env.DAO_ADDRESS;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const INTERVAL_MS = 5000; // 5 segundos

const ACTIVE_STATUS = 0; // ProposalStatus.Active

if (!DAO_ADDRESS || !RELAYER_PRIVATE_KEY) {
  console.error("❌ Faltan variables de entorno:");
  console.error(`   DAO_ADDRESS: ${DAO_ADDRESS ? "✅" : "❌"}`);
  console.error(`   RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY ? "✅" : "❌"}`);
  console.error(`   Ruta actual: ${process.cwd()}`);
  console.error(`   Archivo .env.local esperado en: ${resolve(process.cwd(), ".env.local")}`);
  process.exit(1);
}

// Crear clients
const publicClient = createPublicClient({
  chain: localhostChain,
  transport: http(RPC_URL),
});

const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: localhostChain,
  transport: http(RPC_URL),
});

async function executeEligibleProposals() {
  try {
    // Obtener número de propuestas
    const count = await publicClient.readContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: "proposalCount",
    });

    if (count === BigInt(0)) {
      return; // No hay propuestas
    }

    // Obtener SECURITY_PERIOD
    const securityPeriod = await publicClient.readContract({
      address: DAO_ADDRESS,
      abi: DAO_ABI,
      functionName: "SECURITY_PERIOD",
    });

    const now = BigInt(Math.floor(Date.now() / 1000));

    // Revisar cada propuesta
    for (let id = 1; id <= Number(count); id++) {
      try {
        const proposal = await publicClient.readContract({
          address: DAO_ADDRESS,
          abi: DAO_ABI,
          functionName: "getProposal",
          args: [BigInt(id)],
        });

        // Verificar si es elegible
        if (proposal.status !== ACTIVE_STATUS) {
          continue; // Ya ejecutada o rechazada
        }

        const deadline = proposal.deadline;
        const deadlinePlusSecurity = deadline + securityPeriod;

        if (now < deadlinePlusSecurity) {
          continue; // Aún no puede ejecutarse
        }

        // Ejecutar propuesta
        console.log(`[${new Date().toISOString()}] 🚀 Ejecutando propuesta ${id}...`);
        const hash = await walletClient.writeContract({
          address: DAO_ADDRESS,
          abi: DAO_ABI,
          functionName: "executeProposal",
          args: [BigInt(id)],
        });

        console.log(`[${new Date().toISOString()}] ✅ Propuesta ${id} ejecutada: ${hash}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error(`[${new Date().toISOString()}] ❌ Error ejecutando propuesta ${id}:`, message);
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error en daemon:`, error);
  }
}

// Ejecutar inmediatamente y luego cada 5 segundos
console.log(`[${new Date().toISOString()}] 🟢 Daemon iniciado. Verificando cada ${INTERVAL_MS / 1000} segundos...`);
console.log(`[${new Date().toISOString()}] 📍 DAO: ${DAO_ADDRESS}`);
console.log(`[${new Date().toISOString()}] 🔗 RPC: ${RPC_URL}`);

executeEligibleProposals();
setInterval(executeEligibleProposals, INTERVAL_MS);
