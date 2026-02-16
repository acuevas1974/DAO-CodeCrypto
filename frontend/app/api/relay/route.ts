import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, type Address, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { minimalForwarderAbi, type ForwardRequest } from "@/lib/forwarder-abi";

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

const FORWARDER_ADDRESS = (process.env.NEXT_PUBLIC_FORWARDER_ADDRESS ?? process.env.FORWARDER_ADDRESS) as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

if (!FORWARDER_ADDRESS || !RELAYER_PRIVATE_KEY) {
  console.error("❌ Faltan variables de entorno: FORWARDER_ADDRESS o RELAYER_PRIVATE_KEY");
}

function parseRelayBody(body: any): { request: ForwardRequest; signature: `0x${string}` } {
  if (!body.request || !body.signature) {
    throw new Error("Body debe contener 'request' y 'signature'");
  }

  const req = body.request;
  if (!req.from || !req.to || req.value === undefined || req.gas === undefined || req.nonce === undefined || !req.data) {
    throw new Error("Request incompleto: faltan campos requeridos");
  }

  return {
    request: {
      from: req.from as `0x${string}`,
      to: req.to as `0x${string}`,
      value: BigInt(req.value),
      gas: BigInt(req.gas),
      nonce: BigInt(req.nonce),
      data: req.data as `0x${string}`,
    },
    signature: body.signature as `0x${string}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!FORWARDER_ADDRESS || !RELAYER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Configuración del relayer incompleta. Verifica las variables de entorno." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { request: req, signature } = parseRelayBody(body);

    console.log("📨 Relayer recibió meta-transacción:", {
      from: req.from,
      to: req.to,
      value: req.value.toString(),
      gas: req.gas.toString(),
      nonce: req.nonce.toString(),
      dataLength: req.data.length,
    });

    // Crear wallet client del relayer
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: localhostChain,
      transport: http(RPC_URL),
    });

    // Ejecutar la meta-transacción
    console.log("⛽ Relayer ejecutando meta-transacción...");
    const hash = await walletClient.writeContract({
      address: FORWARDER_ADDRESS,
      abi: minimalForwarderAbi,
      functionName: "execute",
      args: [req, signature],
      value: req.value,
    });

    console.log("✅ Meta-transacción ejecutada:", hash);

    return NextResponse.json({ success: true, txHash: hash });
  } catch (error) {
    console.error("❌ Error en relayer:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
