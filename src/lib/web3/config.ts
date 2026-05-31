import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";
import { QueryClient } from "@tanstack/react-query";

// Reown Cloud project ID — create one at https://cloud.reown.com
// then put it in .env.local as VITE_REOWN_PROJECT_ID
export const projectId =
  (import.meta.env.VITE_REOWN_PROJECT_ID as string) || "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";

if (projectId === "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[web3] VITE_REOWN_PROJECT_ID is not set — using dummy ID. " +
      "Get a real one from https://cloud.reown.com for production",
  );
}

/** Monad mainnet — Dog House + Capricorn CL (chainId 143) */
export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
});

export const networks = [monad] as const;

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [...networks],
  ssr: false,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

/**
 * Global QueryClient — all contract reads auto-refetch every 10 s.
 * keepPreviousData: true means stale data stays visible while the
 * background refresh is in flight (no flash-to-empty on reload).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
      staleTime: 8_000,
      gcTime: 60_000,
      retry: 1,
    },
  },
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [...networks],
  projectId,
  defaultNetwork: monad,
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
    "--w3m-accent": "#8B5CF6",
    "--w3m-color-mix": "#000000",
    "--w3m-color-mix-strength": 20,
    "--w3m-border-radius-master": "2px",
  },
});
