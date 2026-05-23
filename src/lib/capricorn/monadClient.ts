import { createPublicClient, http, type PublicClient } from "viem";
import { monad } from "@/lib/web3/config";

let client: PublicClient | null = null;

/** Always reads Monad mainnet (143) — independent of wallet chain. */
export function getMonadPublicClient(): PublicClient {
  if (!client) {
    const rpc =
      (import.meta.env.VITE_MONAD_RPC_URL as string | undefined)?.trim() ||
      monad.rpcUrls.default.http[0];
    client = createPublicClient({
      chain: monad,
      transport: http(rpc),
    });
  }
  return client;
}
