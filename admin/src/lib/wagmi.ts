import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { DEFAULT_CHAIN_ID } from "./deployments";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
});

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://monadexplorer.com" } },
});

const activeChain = DEFAULT_CHAIN_ID === 143 ? monad : monadTestnet;

export const config = getDefaultConfig({
  appName: "Stream Farm Admin",
  projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "d1a5a2b3c4e5f6a7b8c9d0e1f2a3b4c5",
  chains: [activeChain],
  ssr: false,
});
