"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { FoundingPanel } from "@/components/FoundingPanel";
import { CreateProposal } from "@/components/CreateProposal";
import { ProposalList } from "@/components/ProposalList";
import { useProposals } from "@/hooks/use-proposals";

export default function Home() {
  const { refetch } = useProposals();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            DAO Voting
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <section className="mb-8">
          <ConnectWallet />
        </section>
        <section className="mb-8">
          <FoundingPanel />
        </section>
        <section className="mb-8">
          <CreateProposal onProposalCreated={refetch} />
        </section>
        <section>
          <ProposalList />
        </section>
      </main>
    </div>
  );
}
