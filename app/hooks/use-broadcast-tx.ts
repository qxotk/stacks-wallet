import { useCallback, useState } from 'react';
import { StacksTransaction } from '@stacks/transactions';

import { broadcastTransaction, BroadcastTransactionArgs } from '@store/transaction';

import { useDispatch } from 'react-redux';

interface UseBroadcastTxArgs {
  onSuccess(txId: string): Promise<void>;
  onFail(): any;
  tx: StacksTransaction;
}

export function useBroadcastTx() {
  const dispatch = useDispatch();
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const broadcastTx = useCallback(
    (args: UseBroadcastTxArgs) => {
      const { onSuccess, onFail, tx } = args;
      const broadcastActions: Omit<BroadcastTransactionArgs, 'transaction'> = {
        onBroadcastSuccess(txid) {
          setIsBroadcasting(false);
          void onSuccess(txid);
        },
        onBroadcastFail() {
          setIsBroadcasting(false);
          onFail();
        },
      };

      console.log('inbroadcast', { tx });
      setIsBroadcasting(true);
      dispatch(broadcastTransaction({ ...broadcastActions, transaction: tx }));
    },
    [dispatch]
  );

  return { broadcastTx, isBroadcasting };
}
