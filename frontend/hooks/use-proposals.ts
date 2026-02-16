"use client";

import { useEffect, useCallback } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { daoVotingAbi, type Proposal } from "@/lib/dao-abi";

const daoAddress = (process.env.NEXT_PUBLIC_DAO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export function useProposals() {
  const queryClient = useQueryClient();
  const { data: count, isLoading: countLoading, refetch: refetchCount } = useReadContract({ 
    address: daoAddress, 
    abi: daoVotingAbi, 
    functionName: "proposalCount",
    query: {
      refetchInterval: 3000,
    },
  });
  const num = count !== undefined ? Number(count) : 0;
  
  const contracts = num > 0 
    ? Array.from({ length: num }, (_, i) => ({ 
        address: daoAddress, 
        abi: daoVotingAbi, 
        functionName: "getProposal" as const, 
        args: [BigInt(i + 1)] as const 
      }))
    : [];
  
  const { data: results, isLoading: listLoading, refetch: refetchList } = useReadContracts({ 
    contracts,
    query: {
      enabled: num > 0 && contracts.length > 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      staleTime: 0, // Los datos siempre se consideran stale para forzar refetch
    },
  });
  
  const proposals: Proposal[] = (results ?? [])
    .map((r) => (r.status === "success" ? (r.result as Proposal) : null))
    .filter((p): p is Proposal => p != null);
  
  useEffect(() => {
    if (num > 0 && contracts.length > 0) {
      refetchList();
    }
  }, [num, refetchList]);
  
  const refetch = useCallback(async () => {
    console.log("🔄 Refetching propuestas...");
    try {
      // Invalidar TODAS las queries de wagmi relacionadas con este contrato
      await queryClient.invalidateQueries();
      // Esperar un poco para que las queries se invaliden
      await new Promise(resolve => setTimeout(resolve, 200));
      // Refetch manual con await para asegurar que se complete
      const [countResult, listResult] = await Promise.all([
        refetchCount(),
        num > 0 ? refetchList() : Promise.resolve(null),
      ]);
      console.log("✅ Propuestas refetched", { countResult, listResult });
      // Forzar otro refetch después de un delay para asegurar actualización
      setTimeout(async () => {
        await refetchList();
      }, 500);
    } catch (error) {
      console.error("Error refetching propuestas:", error);
    }
  }, [queryClient, refetchCount, refetchList, num]);
  
  return { proposals, count: num, isLoading: countLoading || listLoading, refetch };
}
