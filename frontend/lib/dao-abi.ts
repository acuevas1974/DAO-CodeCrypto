export const daoVotingAbi = [
  { inputs: [], name: "fundDAO", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ name: "user", type: "address", internalType: "address" }], name: "getUserBalance", outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalBalance", outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "recipient", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }, { name: "deadline", type: "uint256", internalType: "uint256" }, { name: "description", type: "string", internalType: "string" }], name: "createProposal", outputs: [{ name: "proposalId", type: "uint256", internalType: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "proposalId", type: "uint256", internalType: "uint256" }], name: "getProposal", outputs: [{ name: "", type: "tuple", internalType: "struct DAOVoting.Proposal", components: [{ name: "id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }, { name: "description", type: "string" }, { name: "forVotes", type: "uint256" }, { name: "againstVotes", type: "uint256" }, { name: "abstainVotes", type: "uint256" }, { name: "status", type: "uint8" }] }], stateMutability: "view", type: "function" },
  { inputs: [], name: "proposalCount", outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "proposalId", type: "uint256", internalType: "uint256" }, { name: "voteType", type: "uint8", internalType: "enum DAOVoting.VoteType" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "proposalId", type: "uint256", internalType: "uint256" }, { name: "voter", type: "address", internalType: "address" }], name: "getVote", outputs: [{ name: "", type: "uint8", internalType: "enum DAOVoting.VoteType" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "proposalId", type: "uint256", internalType: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "SECURITY_PERIOD", outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view", type: "function" },
] as const;
export type Proposal = { id: bigint; amount: bigint; recipient: `0x${string}`; deadline: bigint; description: string; forVotes: bigint; againstVotes: bigint; abstainVotes: bigint; status: 0 | 1 | 2 | 3 };
export const ProposalStatus = { Active: 0, Approved: 1, Rejected: 2, Executed: 3 } as const;
export const VoteType = { None: 0, For: 1, Against: 2, Abstain: 3 } as const;
