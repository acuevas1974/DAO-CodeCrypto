"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { daoVotingAbi } from "@/lib/dao-abi";
import { useDaoBalance, useDaoTotalBalance } from "@/hooks/use-dao-balance";

const daoAddress = process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}` | undefined;

function formatEth(value: bigint) {
  const eth = Number(value) / 1e18;
  if (eth === 0) return "0.0000";
  if (eth < 0.0001) return eth.toExponential(2);
  if (eth < 0.01) return "<0.01";
  return eth.toFixed(4);
}

function parseEth(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) return BigInt(0);
  const num = parseFloat(trimmed);
  if (Number.isNaN(num) || num < 0) return BigInt(0);
  return BigInt(Math.floor(num * 1e18));
}

export function FoundingPanel() {
  const { address, isConnected } = useAccount();
  const { balance, refetch: refetchBalance } = useDaoBalance(address);
  const { totalBalance, refetch: refetchTotal } = useDaoTotalBalance();
  const [amount, setAmount] = useState("");

  const value = parseEth(amount);

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => {
        refetchBalance();
        refetchTotal();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isSuccess, refetchBalance, refetchTotal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daoAddress || value <= BigInt(0)) return;
    resetWrite();
    writeContract({
      address: daoAddress,
      abi: daoVotingAbi,
      functionName: "fundDAO",
      value,
      chainId: 31337,
    });
  };

  const isLoading = isWritePending || isConfirming;
  const hasDao = Boolean(daoAddress);

  if (!hasDao) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          Panel de financiación
        </h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Configura <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_DAO_ADDRESS</code> en .env.local para usar este panel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Panel de financiación
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cantidad (ETH)
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={!isConnected || value <= BigInt(0) || isLoading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {!isConnected
            ? "Conecta tu wallet"
            : isLoading
              ? "Enviando…"
              : "Enviar al DAO"}
        </button>
      </form>

      {writeError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {writeError.message}
        </p>
      )}
      {isSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Depósito realizado correctamente.
        </p>
      )}

      <div className="mt-2 grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Tu balance en el DAO</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {formatEth(balance)} ETH
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Balance total del DAO</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {formatEth(totalBalance)} ETH
          </span>
        </div>
        <button
          type="button"
          onClick={() => { refetchBalance(); refetchTotal(); }}
          className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Actualizar balances
        </button>
      </div>
    </div>
  );
}
