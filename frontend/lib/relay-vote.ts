import { encodeFunctionData, type Address } from "viem";
import { daoVotingAbi } from "./dao-abi";
import type { ForwardRequest } from "./forwarder-abi";

const FORWARDER_ADDRESS = (process.env.NEXT_PUBLIC_FORWARDER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const DAO_ADDRESS = (process.env.NEXT_PUBLIC_DAO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const CHAIN_ID = 31337;

/**
 * Obtiene el nonce actual del usuario desde el MinimalForwarder
 */
export async function getNonce(userAddress: Address, rpcUrl: string = "http://127.0.0.1:8545"): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: FORWARDER_ADDRESS,
          data: `0x58bbd4f8${userAddress.slice(2).padStart(64, "0")}`, // getNonce(address)
        },
        "latest",
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return BigInt(data.result);
}

/**
 * Construye el calldata para llamar a vote() en el contrato DAO
 */
export function buildVoteCalldata(proposalId: bigint, voteType: 1 | 2 | 3): `0x${string}` {
  return encodeFunctionData({
    abi: daoVotingAbi,
    functionName: "vote",
    args: [proposalId, voteType],
  });
}

/**
 * Construye los datos EIP-712 para firmar el ForwardRequest
 */
export function getForwardRequestTypedData(
  from: Address,
  to: Address,
  value: bigint,
  gas: number | bigint,
  nonce: bigint,
  data: `0x${string}`
) {
  const gasBigInt = typeof gas === "number" ? BigInt(gas) : gas;
  
  return {
    domain: {
      name: "MinimalForwarder",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: FORWARDER_ADDRESS,
    },
    types: {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    },
    primaryType: "ForwardRequest" as const,
    message: {
      from,
      to,
      value,
      gas: gasBigInt,
      nonce,
      data,
    },
  };
}

/**
 * Envía la meta-transacción firmada al relayer API
 */
export async function relayVote(
  request: ForwardRequest,
  signature: `0x${string}`
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch("/api/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request: {
          from: request.from,
          to: request.to,
          value: request.value.toString(),
          gas: request.gas.toString(),
          nonce: request.nonce.toString(),
          data: request.data,
        },
        signature,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || "Error desconocido del relayer" };
    }

    return { success: true, txHash: data.txHash };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al enviar al relayer" 
    };
  }
}
