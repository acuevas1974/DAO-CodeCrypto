"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet, sepolia } from "wagmi/chains";

const localhost = {
  id: 31_337,
  name: "Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
} as const;

const config = createConfig({
  chains: [localhost, mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [localhost.id]: http("http://127.0.0.1:8545", { timeout: 8_000 }),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

export { config };
