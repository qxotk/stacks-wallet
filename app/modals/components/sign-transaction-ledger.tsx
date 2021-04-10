import React from 'react';
import { ContractCallOptions, StacksTransaction } from '@stacks/transactions';

import { useCreateLedgerContractCallTx } from '@hooks/use-create-ledger-contract-call-tx';

interface SignTransactionLedgerProps {
  action: string;
  txOptions: ContractCallOptions;
  onTransactionSigned(tx: StacksTransaction): void;
}
export const SignTransactionLedger = (props: SignTransactionLedgerProps) => {
  const { action } = props;

  // const history = useHistory();

  const { createLedgerContractCallTx } = useCreateLedgerContractCallTx();
  console.log(createLedgerContractCallTx);
  console.log(action);
  // return <SignTxWithLedger step={ledgerStep} isLocked={isLocked} ledgerError={null} />;
  return <></>;
};
