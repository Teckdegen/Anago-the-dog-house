import { useEffect, useRef } from "react";

type TxHash = `0x${string}` | undefined;

type WriteLike = { data?: TxHash };
type ReceiptLike = {
  isSuccess: boolean;
  data?: { transactionHash?: TxHash };
};

/**
 * Fires once when the given write tx is confirmed on-chain.
 * Pass the final tx hook in multi-step flows (approve → action) so approval alone never triggers success.
 */
export function useTransactionSuccess(
  write: WriteLike,
  receipt: ReceiptLike,
  onSuccess: () => void,
) {
  const handledRef = useRef<TxHash>(undefined);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const txHash = write.data;
    const receiptHash = receipt.data?.transactionHash;
    if (!receipt.isSuccess || !txHash || !receiptHash) return;
    if (receiptHash !== txHash) return;
    if (handledRef.current === txHash) return;
    handledRef.current = txHash;
    onSuccessRef.current();
  }, [receipt.isSuccess, receipt.data?.transactionHash, write.data]);
}
