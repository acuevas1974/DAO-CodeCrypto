"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { daoVotingAbi, type Proposal, ProposalStatus } from "@/lib/dao-abi";
import { VoteButtons } from "./VoteButtons";

const daoAddress = process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}` | undefined;

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatEth(value: bigint) {
  const n = Number(value) / 1e18;
  return n < 0.01 && n > 0 ? "<0.01" : n.toFixed(4);
}

const STATUS_LABELS: Record<number, string> = {
  [ProposalStatus.Active]: "Activa",
  [ProposalStatus.Approved]: "Aprobada",
  [ProposalStatus.Rejected]: "Rechazada",
  [ProposalStatus.Executed]: "Ejecutada",
};

type ProposalCardProps = { proposal: Proposal; onVoteSuccess?: () => void };

export function ProposalCard({ proposal, onVoteSuccess }: ProposalCardProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [blockTimestamp, setBlockTimestamp] = useState<number | null>(null);

  const { data: userVote, refetch: refetchUserVote } = useReadContract({
    address: daoAddress ?? "0x0000000000000000000000000000000000000000",
    abi: daoVotingAbi,
    functionName: "getVote",
    args: [proposal.id, address ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: !!address && !!daoAddress,
    },
  });
  const currentVote = (userVote ?? 0) as 0 | 1 | 2 | 3;
  const isActive = proposal.status === ProposalStatus.Active;
  const deadlineSec = Number(proposal.deadline);
  const deadlineDate = new Date(deadlineSec * 1000);

  // Usar timestamp del BLOQUE (igual que el contrato), no la hora del navegador
  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    const fetchBlock = async () => {
      try {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        if (!cancelled) setBlockTimestamp(Number(block.timestamp));
      } catch {
        if (!cancelled) setBlockTimestamp(Math.floor(Date.now() / 1000)); // fallback
      }
    };
    fetchBlock();
    const interval = setInterval(fetchBlock, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicClient]);

  // Votable solo si está Activa Y el deadline no ha pasado (según la blockchain)
  const isVotable = isActive && blockTimestamp !== null && blockTimestamp < deadlineSec;
  // Deadline pasó pero el contrato sigue en Active (aún no se ha llamado executeProposal)
  const isClosedPendingExecution = isActive && blockTimestamp !== null && blockTimestamp >= deadlineSec;

  // Refetch user vote cuando se ejecuta onVoteSuccess
  useEffect(() => {
    if (onVoteSuccess) {
      const timeout = setTimeout(() => {
        refetchUserVote();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [onVoteSuccess, refetchUserVote]);

  const statusLabel = isClosedPendingExecution
    ? "Cerrada (pend. ejecución)"
    : (STATUS_LABELS[proposal.status] ?? "Desconocido");
  const statusBadgeClass = isClosedPendingExecution
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    : isActive
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Propuesta #{proposal.id.toString()}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="grid gap-1 text-sm">
        <div className="col-span-full rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <span className="text-zinc-500 dark:text-zinc-400">Descripción</span>
          <p className="mt-1 text-zinc-800 dark:text-zinc-200">{proposal.description?.trim() || "—"}</p>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Beneficiario</span>
          <span className="font-mono">{formatAddress(proposal.recipient)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Monto</span>
          <span className="font-mono">{formatEth(proposal.amount)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Cierre</span>
          <span>{deadlineDate.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 dark:text-zinc-400">A favor</span>
          <span className="font-mono text-green-600 dark:text-green-400">{proposal.forVotes.toString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 dark:text-zinc-400">En contra</span>
          <span className="font-mono text-red-600 dark:text-red-400">{proposal.againstVotes.toString()}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 dark:text-zinc-400">Abstenciones</span>
          <span className="font-mono">{proposal.abstainVotes.toString()}</span>
        </div>
      </div>
      {isVotable && (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Tu voto actual</p>
          <VoteButtons proposalId={proposal.id} currentVote={currentVote} onSuccess={onVoteSuccess} />
        </div>
      )}
      {isClosedPendingExecution && (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Votación cerrada. Esta propuesta ya no admite votos. El daemon o un usuario puede ejecutarla cuando pase el período de seguridad.
          </p>
        </div>
      )}
    </div>
  );
}
