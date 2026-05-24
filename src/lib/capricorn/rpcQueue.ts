const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type MapInBatchesOptions = {
  /** Max items processed at once (default 2). */
  concurrency?: number;
  /** Pause after each batch (default 250ms). */
  delayMs?: number;
};

/**
 * Run async work in small batches so public RPC endpoints (e.g. rpc.monad.xyz) are not rate-limited.
 */
export async function mapInBatches<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options?: MapInBatchesOptions,
): Promise<R[]> {
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  const delayMs = options?.delayMs ?? 250;
  const out: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const chunk = await Promise.all(slice.map((item, j) => fn(item, i + j)));
    out.push(...chunk);
    if (i + concurrency < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return out;
}
