"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useReadContract, usePublicClient } from "wagmi";
import { daoVotingAbi } from "@/lib/dao-abi";
import { minimalForwarderAbi } from "@/lib/forwarder-abi";
import { getNonce, buildVoteCalldata, getForwardRequestTypedData, relayVote } from "@/lib/relay-vote";

const daoAddress = process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}` | undefined;
const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS as `0x${string}` | undefined;

type VoteButtonsProps = { proposalId: bigint; currentVote: 0 | 1 | 2 | 3; onSuccess?: () => void };

export function VoteButtons({ proposalId, currentVote, onSuccess }: VoteButtonsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [useGasless, setUseGasless] = useState(false);
  const [gaslessError, setGaslessError] = useState<string | null>(null);
  const [gaslessLoading, setGaslessLoading] = useState(false);
  const [gaslessSuccess, setGaslessSuccess] = useState(false);

  // Voto normal (con gas)
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Obtener nonce para gasless (solo cuando se necesita, no automáticamente)
  const { data: nonceData, refetch: refetchNonce } = useReadContract({
    address: forwarderAddress,
    abi: minimalForwarderAbi,
    functionName: "getNonce",
    args: address ? [address] : undefined,
    query: { enabled: false }, // Deshabilitado por defecto, se obtendrá cuando se necesite
  });

  // Firma EIP-712 para gasless
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData();

  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  useEffect(() => {
    if (gaslessSuccess && onSuccess) {
      // Refrescar inmediatamente después de marcar como éxito (ya esperamos la confirmación arriba)
      console.log("🔄 Refrescando propuestas después del voto gasless...");
      // Llamar onSuccess inmediatamente y también después de un delay para asegurar actualización
      onSuccess();
      const timer1 = setTimeout(() => {
        console.log("🔄 Segundo refetch para asegurar actualización...");
        onSuccess();
      }, 1500);
      // Resetear el estado después de un delay para permitir que el usuario vea el mensaje de éxito
      const timer2 = setTimeout(() => {
        setGaslessSuccess(false);
      }, 3000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [gaslessSuccess, onSuccess]);

  const vote = async (voteType: 1 | 2 | 3) => {
    if (!daoAddress || !address) return;

    if (useGasless && forwarderAddress) {
      // Voto gasless usando relayer
      setGaslessError(null);
      setGaslessLoading(true);
      setGaslessSuccess(false);

      try {
        // 1. Obtener nonce usando publicClient de wagmi (más confiable que RPC manual)
        let currentNonce: bigint;
        if (publicClient && forwarderAddress) {
          try {
            const nonceResult = await publicClient.readContract({
              address: forwarderAddress,
              abi: minimalForwarderAbi,
              functionName: "getNonce",
              args: [address],
            });
            currentNonce = BigInt(nonceResult.toString());
          } catch (error) {
            console.warn("Error obteniendo nonce con publicClient, usando fallback:", error);
            // Fallback a función getNonce
            currentNonce = await getNonce(address);
          }
        } else {
          currentNonce = await getNonce(address);
        }
        console.log("📊 Nonce actual obtenido:", currentNonce.toString());
        
        // 2. Construir calldata para vote()
        const calldata = buildVoteCalldata(proposalId, voteType);
        
        // 3. Construir ForwardRequest con el nonce actual
        const forwardRequest = {
          from: address,
          to: daoAddress,
          value: BigInt(0),
          gas: BigInt(200000), // Gas estimado para vote()
          nonce: currentNonce,
          data: calldata,
        };
        
        console.log("📋 ForwardRequest construido:", {
          from: forwardRequest.from,
          to: forwardRequest.to,
          nonce: forwardRequest.nonce.toString(),
          dataLength: forwardRequest.data.length,
        });

        // 4. Obtener datos EIP-712 para firmar
        const typedData = getForwardRequestTypedData(
          forwardRequest.from,
          forwardRequest.to,
          forwardRequest.value,
          forwardRequest.gas,
          forwardRequest.nonce,
          forwardRequest.data
        );

        // 5. Firmar con MetaMask
        console.log("📝 Firmando meta-transacción con MetaMask...");
        const signature = await signTypedDataAsync(typedData);
        console.log("✅ Firma obtenida:", signature);

        // 6. Enviar al relayer
        console.log("📤 Enviando al relayer...");
        const result = await relayVote(forwardRequest, signature);

        if (result.success && result.txHash) {
          console.log("✅ Voto gasless exitoso:", result.txHash);
          // Esperar a que la transacción se confirme antes de marcar como éxito
          if (publicClient) {
            try {
              console.log("⏳ Esperando confirmación de la transacción...");
              await publicClient.waitForTransactionReceipt({ hash: result.txHash as `0x${string}` });
              console.log("✅ Transacción confirmada");
            } catch (error) {
              console.warn("Error esperando confirmación:", error);
            }
          }
          setGaslessSuccess(true);
          setGaslessError(null);
        } else {
          throw new Error(result.error || "Error desconocido del relayer");
        }
      } catch (err) {
        console.error("❌ Error en voto gasless:", err);
        setGaslessError(err instanceof Error ? err.message : "Error al votar sin gas");
        setGaslessSuccess(false);
      } finally {
        setGaslessLoading(false);
      }
    } else {
      // Voto normal (con gas)
      reset();
      writeContract({ 
        address: daoAddress, 
        abi: daoVotingAbi, 
        functionName: "vote", 
        args: [proposalId, voteType],
        chainId: 31337,
      });
    }
  };

  const loading = isPending || confirming || gaslessLoading || isSigning;

  if (!isConnected) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Conecta tu wallet para votar.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`gasless-${proposalId}`}
          checked={useGasless}
          onChange={(e) => {
            setUseGasless(e.target.checked);
            setGaslessError(null);
            setGaslessSuccess(false);
          }}
          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
        <label htmlFor={`gasless-${proposalId}`} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Votar sin gas (relayer paga)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button 
          type="button" 
          onClick={() => vote(1)} 
          disabled={loading} 
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${currentVote === 1 ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"} disabled:opacity-50`}
        >
          A favor
        </button>
        <button 
          type="button" 
          onClick={() => vote(2)} 
          disabled={loading} 
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${currentVote === 2 ? "bg-red-600 text-white" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"} disabled:opacity-50`}
        >
          En contra
        </button>
        <button 
          type="button" 
          onClick={() => vote(3)} 
          disabled={loading} 
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${currentVote === 3 ? "bg-zinc-600 text-white" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"} disabled:opacity-50`}
        >
          Abstención
        </button>
      </div>

      {loading && (
        <span className="text-sm text-zinc-500">
          {isSigning ? "Firmando con MetaMask…" : gaslessLoading ? "Enviando al relayer…" : "Enviando…"}
        </span>
      )}
      
      {error && !useGasless && (
        <span className="text-sm text-red-600 dark:text-red-400">{error.message}</span>
      )}
      
      {gaslessError && (
        <span className="text-sm text-red-600 dark:text-red-400">{gaslessError}</span>
      )}
      
      {gaslessSuccess && (
        <span className="text-sm text-green-600 dark:text-green-400">
          ✅ Voto enviado sin gas. El relayer pagó la transacción.
        </span>
      )}
      
      {isSuccess && !useGasless && (
        <span className="text-sm text-green-600 dark:text-green-400">✅ Voto registrado correctamente.</span>
      )}
    </div>
  );
}
