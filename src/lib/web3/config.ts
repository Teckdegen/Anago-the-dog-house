import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";

// Reown Cloud project ID — create one at https://cloud.reown.com
// then put it in .env.local as VITE_REOWN_PROJECT_ID
export const projectId =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string) || "REPLACE_ME";

if (projectId === "REPLACE_ME" && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[web3] VITE_REOWN_PROJECT_ID is not set — wallet connect will fail. " +
      "Get one from https://cloud.reown.com",
  );
}

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const networks = [monadTestnet] as const;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [...networks],
  ssr: false,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

createAppKit({
  adapters: [wagmiAdapter],
  networks: [...networks],
  projectId,
  defaultNetwork: monadTestnet,
  metadata: {
    name: "The Dog House",
    description: "Vesting, Locks, CLMM & Yield Farming on Monad",
    url: typeof window !== "undefined" ? window.location.origin : "https://thedoghouse.xyz",
    icons: ["/logo.png"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#9B7FD4",
    "--w3m-color-mix": "#06040F",
    "--w3m-color-mix-strength": 20,
    "--w3m-border-radius-master": "2px",
  },
});
