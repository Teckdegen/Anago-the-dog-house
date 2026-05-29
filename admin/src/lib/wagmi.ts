import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { DEFAULT_CHAIN_ID } from "./deployments";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://monadexplorer.com" } },
});

export const config = createConfig({
  chains: [monad],
  transports: { [monad.id]: http() },
});

export const wagmiConfig = config;

export const activeChain = monad;
export const activeChainId = DEFAULT_CHAIN_ID === 143 ? 143 : monad.id;
