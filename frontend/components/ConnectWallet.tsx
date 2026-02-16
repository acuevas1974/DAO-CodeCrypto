"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useDaoBalance, useDaoTotalBalance } from "@/hooks/use-dao-balance";

const DAO_ADDRESS = process.env.NEXT_PUBLIC_DAO_ADDRESS;
const CHAIN_ID_LOCALHOST = 31337;

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatEth(value: bigint) {
  const eth = Number(value) / 1e18;
  return eth < 0.01 && eth > 0 ? "<0.01" : eth.toFixed(4);
}

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export function ConnectWallet() {
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();
  const { balance, isLoading: balanceLoading } = useDaoBalance(address);
  const { totalBalance, isLoading: totalLoading } = useDaoTotalBalance();

  useEffect(() => {
    setHasProvider(typeof window !== "undefined" && typeof window.ethereum !== "undefined");
  }, []);

  const connector = connectors[0] ?? connectors.find((c) => c.id === "injected" || c.name.toLowerCase().includes("metamask"));

  const handleConnect = () => {
    resetConnect();
    if (connector) connect({ connector, chainId: CHAIN_ID_LOCALHOST });
  };

  const showProviderHelp = hasProvider === false || (error?.message?.toLowerCase().includes("provider not found") ?? false);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Wallet</h2>
      {!isConnected ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={handleConnect} disabled={!connector || isPending} className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "Conectando…" : "Conectar con MetaMask"}
          </button>
          {!connector && <p className="text-sm text-amber-600 dark:text-amber-400">Instala MetaMask y recarga.</p>}
          {showProviderHelp && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <p className="font-medium">No se detectó MetaMask</p>
              <p className="mt-1">Abre la app en http://localhost:3000 e instala MetaMask.</p>
            </div>
          )}
          {error && !showProviderHelp && <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Dirección</span>
            <span className="font-mono text-sm">{address && formatAddress(address)}</span>
          </div>
          {DAO_ADDRESS && (
            <>
              <div className="flex justify-between gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Tu balance en el DAO</span>
                <span className="font-mono text-sm">{balanceLoading ? "…" : `${formatEth(balance)} ETH`}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Balance total DAO</span>
                <span className="font-mono text-sm">{totalLoading ? "…" : `${formatEth(totalBalance)} ETH`}</span>
              </div>
            </>
          )}
          <button type="button" onClick={() => disconnect()} className="mt-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">Desconectar</button>
        </div>
      )}
    </div>
  );
}
