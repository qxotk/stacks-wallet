import React from 'react';
import { ContractCallOptions, StacksTransaction } from '@stacks/transactions';

import { useWalletType } from '@hooks/use-wallet-type';

import { SignTransactionSoftware } from './sign-transaction-software';
import { SignTransactionLedger } from './sign-transaction-ledger';

interface SignTransactionProps {
  action: string;
  txOptions: ContractCallOptions;
  isBroadcasting: boolean;
  onTransactionSigned(tx: StacksTransaction): void;
}
export const SignTransaction = (props: SignTransactionProps) => {
  const { whenWallet } = useWalletType();

  return whenWallet({
    software: <SignTransactionSoftware {...props} />,
    ledger: <SignTransactionLedger {...props} />,
  });
};
