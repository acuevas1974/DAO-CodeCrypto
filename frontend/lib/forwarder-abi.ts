export const minimalForwarderAbi = [
  {
    inputs: [{ name: "from", type: "address" }],
    name: "getNonce",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        name: "req",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "verify",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        name: "req",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "execute",
    outputs: [
      { name: "success", type: "bool" },
      { name: "returnData", type: "bytes" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export type ForwardRequest = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  data: `0x${string}`;
};
