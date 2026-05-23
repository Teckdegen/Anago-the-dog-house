import { createPublicClient, http, type PublicClient } from "viem";
import { monad } from "@/lib/web3/config";

let client: PublicClient | null = null;

/** Always reads Monad mainnet (143) — independent of wallet chain. */
export function getMonadPublicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: monad,
      transport: http(monad.rpcUrls.default.http[0]),
    });
  }
  return client;
}
