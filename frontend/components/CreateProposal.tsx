"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBlockNumber, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { daoVotingAbi } from "@/lib/dao-abi";
import { useDaoBalance, useDaoTotalBalance } from "@/hooks/use-dao-balance";

const daoAddress = process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}` | undefined;

function parseEth(value: string): bigint {
  const t = value.trim();
  if (!t) return BigInt(0);
  const n = parseFloat(t);
  if (Number.isNaN(n) || n < 0) return BigInt(0);
  return BigInt(Math.floor(n * 1e18));
}

function isValidAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

type CreateProposalProps = {
  onProposalCreated?: () => void;
};

export function CreateProposal({ onProposalCreated }: CreateProposalProps = {}) {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { balance } = useDaoBalance(address);
  const { totalBalance } = useDaoTotalBalance();
  const publicClient = usePublicClient();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [blockTimestamp, setBlockTimestamp] = useState<bigint | null>(null);

  // Obtener timestamp del bloque actual periódicamente
  useEffect(() => {
    if (!publicClient) return;
    
    const fetchBlockTimestamp = async () => {
      try {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        setBlockTimestamp(BigInt(block.timestamp));
      } catch (error) {
        console.error("Error obteniendo timestamp del bloque:", error);
        // Fallback a Date.now() si falla
        setBlockTimestamp(BigInt(Math.floor(Date.now() / 1000)));
      }
    };
    
    fetchBlockTimestamp();
    // Actualizar cada 5 segundos
    const interval = setInterval(fetchBlockTimestamp, 5000);
    return () => clearInterval(interval);
  }, [publicClient]);

  const amountWei = parseEth(amount);
  // Usar timestamp del bloque si está disponible, sino usar Date.now() como fallback
  const now = blockTimestamp ?? BigInt(Math.floor(Date.now() / 1000));
  // Agregar un pequeño buffer (60 segundos) para asegurar que el deadline sea futuro
  const deadlineTimestamp = deadlineDays.trim() === "" ? BigInt(0) : now + BigInt(parseInt(deadlineDays, 10) || 7) * BigInt(24 * 60 * 60) + BigInt(60);
  const tenPercent = totalBalance > BigInt(0) ? totalBalance / BigInt(10) : BigInt(0);
  // El contrato requiere: myBalance > total / 10 (estrictamente mayor)
  const canCreate = totalBalance > BigInt(0) && balance > tenPercent;
  const formValid = canCreate && isValidAddress(recipient) && amountWei > BigInt(0) && deadlineTimestamp > now && description.trim().length > 0;

  const { writeContract, data: hash, isPending: isWritePending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries();
      onProposalCreated?.();
      setRecipient("");
      setAmount("");
      setDescription("");
      setDeadlineDays("7");
    }
  }, [isSuccess, onProposalCreated, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daoAddress || !formValid) {
      console.error("Formulario inválido:", {
        daoAddress: !!daoAddress,
        formValid,
        canCreate,
        recipient: isValidAddress(recipient),
        amountWei: amountWei.toString(),
        deadlineTimestamp: deadlineTimestamp.toString(),
        now: now.toString(),
        balance: balance.toString(),
        totalBalance: totalBalance.toString(),
        tenPercent: tenPercent.toString(),
      });
      return;
    }
    resetWrite();
    console.log("Creando propuesta con:", {
      recipient,
      amountWei: amountWei.toString(),
      deadlineTimestamp: deadlineTimestamp.toString(),
      now: now.toString(),
      balance: balance.toString(),
      totalBalance: totalBalance.toString(),
    });
    writeContract({ 
      address: daoAddress, 
      abi: daoVotingAbi, 
      functionName: "createProposal", 
      args: [recipient as `0x${string}`, amountWei, deadlineTimestamp, description.trim()],
      chainId: 31337,
    });
  };

  const isLoading = isWritePending || isConfirming;

  if (!daoAddress) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Crear propuesta</h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Configura NEXT_PUBLIC_DAO_ADDRESS en .env.local.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Crear propuesta</h2>
      {!canCreate && isConnected && totalBalance > BigInt(0) && <p className="text-sm text-amber-600 dark:text-amber-400">Necesitas más del 10% del balance total del DAO para crear propuestas.</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Descripción</label>
        <textarea placeholder="De qué trata esta propuesta..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dirección del beneficiario</label>
        <input type="text" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cantidad (ETH)</label>
        <input type="text" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Días hasta el cierre de votación</label>
        <input type="number" min={1} placeholder="7" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" />
        <button type="submit" disabled={!isConnected || !formValid || isLoading} className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {!isConnected ? "Conecta tu wallet" : isLoading ? "Enviando…" : "Crear propuesta"}
        </button>
      </form>
      {writeError && (
        <div className="text-sm text-red-600 dark:text-red-400">
          <p className="font-semibold">Error al crear propuesta:</p>
          <p className="mt-1">{writeError.message}</p>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer">Detalles técnicos</summary>
            <pre className="mt-1 overflow-auto rounded bg-red-50 p-2 dark:bg-red-950/30">
              {JSON.stringify(writeError, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {isSuccess && <p className="text-sm text-green-600 dark:text-green-400">Propuesta creada correctamente.</p>}
    </div>
  );
}
