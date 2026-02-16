"use client";

import { useReadContract } from "wagmi";
import { daoVotingAbi } from "@/lib/dao-abi";

const daoAddress = process.env.NEXT_PUBLIC_DAO_ADDRESS as `0x${string}` | undefined;

export function useDaoBalance(userAddress: `0x${string}` | undefined) {
  const { data: balance, ...rest } = useReadContract({
    address: daoAddress ?? "0x0000000000000000000000000000000000000000",
    abi: daoVotingAbi,
    functionName: "getUserBalance",
    args: userAddress ? [userAddress] : undefined,
  });
  return { balance: balance ?? BigInt(0), ...rest };
}

export function useDaoTotalBalance() {
  const { data: totalBalance, ...rest } = useReadContract({
    address: daoAddress ?? "0x0000000000000000000000000000000000000000",
    abi: daoVotingAbi,
    functionName: "totalBalance",
  });
  return { totalBalance: totalBalance ?? BigInt(0), ...rest };
}
