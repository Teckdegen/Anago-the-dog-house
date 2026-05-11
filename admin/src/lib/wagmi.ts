import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Stream Farm Admin",
  projectId: "d1a5a2b3c4e5f6a7b8c9d0e1f2a3b4c5", // WalletConnect project ID
  chains: [monadTestnet],
  ssr: true,
});
