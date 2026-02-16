"use client";

import { useProposals } from "@/hooks/use-proposals";
import { ProposalCard } from "@/components/ProposalCard";

export function ProposalList() {
  const { proposals, count, isLoading, refetch } = useProposals();

  if (!process.env.NEXT_PUBLIC_DAO_ADDRESS) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Listado de propuestas</h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Configura NEXT_PUBLIC_DAO_ADDRESS en .env.local.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Propuestas ({count})</h2>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {isLoading ? "Cargando…" : "Actualizar"}
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay propuestas aún.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {proposals.map((p) => (
            <ProposalCard key={p.id.toString()} proposal={p} onVoteSuccess={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
