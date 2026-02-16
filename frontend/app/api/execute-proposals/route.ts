import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { daoVotingAbi, type Proposal } from "@/lib/dao-abi";

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

const DAO_ADDRESS = (process.env.NEXT_PUBLIC_DAO_ADDRESS ?? process.env.DAO_ADDRESS) as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

const ACTIVE_STATUS = 0; // ProposalStatus.Active
const SECURITY_PERIOD_SECONDS = 86400; // 1 day

export async function GET() {
  try {
    if (!DAO_ADDRESS || !RELAYER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Configuración incompleta. Verifica las variables de entorno." },
        { status: 500 }
      );
    }

    // Crear clients
    const publicClient = createPublicClient({
      chain: localhostChain,
      transport: http(RPC_URL),
    });

    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: localhostChain,
      transport: http(RPC_URL),
    });

    // Obtener número de propuestas
    const count = (await publicClient.readContract({
      address: DAO_ADDRESS,
      abi: daoVotingAbi,
      functionName: "proposalCount",
    })) as bigint;

    if (count === BigInt(0)) {
      return NextResponse.json({ executed: 0, message: "No hay propuestas" });
    }

    // Obtener SECURITY_PERIOD del contrato
    const securityPeriod = (await publicClient.readContract({
      address: DAO_ADDRESS,
      abi: daoVotingAbi,
      functionName: "SECURITY_PERIOD",
    })) as bigint;

    const now = BigInt(Math.floor(Date.now() / 1000));
    const executed: string[] = [];
    const errors: string[] = [];

    // Revisar cada propuesta
    for (let id = 1; id <= Number(count); id++) {
      try {
        const proposal = (await publicClient.readContract({
          address: DAO_ADDRESS,
          abi: daoVotingAbi,
          functionName: "getProposal",
          args: [BigInt(id)],
        })) as Proposal;

        // Verificar si es elegible para ejecución
        if (proposal.status !== ACTIVE_STATUS) {
          continue; // Ya ejecutada o rechazada
        }

        const deadline = proposal.deadline;
        const deadlinePlusSecurity = deadline + securityPeriod;

        if (now < deadlinePlusSecurity) {
          continue; // Aún no puede ejecutarse
        }

        // Ejecutar propuesta
        console.log(`🚀 Ejecutando propuesta ${id}...`);
        const hash = await walletClient.writeContract({
          address: DAO_ADDRESS,
          abi: daoVotingAbi,
          functionName: "executeProposal",
          args: [BigInt(id)],
        });

        executed.push(hash);
        console.log(`✅ Propuesta ${id} ejecutada: ${hash}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        errors.push(`Propuesta ${id}: ${message}`);
        console.error(`❌ Error ejecutando propuesta ${id}:`, message);
      }
    }

    return NextResponse.json({
      executed: executed.length,
      txHashes: executed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Error en execute-proposals:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
