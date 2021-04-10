import React, { FC, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal } from '@blockstack/ui';
import { ContractCallOptions, StacksTransaction } from '@stacks/transactions';
import BN from 'bn.js';
import { useHotkeys } from 'react-hotkeys-hook';

import { selectPoxInfo } from '@store/stacking';

import { useWalletType } from '@hooks/use-wallet-type';
import { safeAwait } from '@utils/safe-await';
import { homeActions } from '@store/home';
import { useStackingClient } from '@hooks/use-stacking-client';
import { useApi } from '@hooks/use-api';

import { StackingFailed } from '@modals/components/stacking-failed';
import { watchForNewTxToAppear } from '@api/watch-tx-to-appear-in-api';

import { useBroadcastTx } from '@hooks/use-broadcast-tx';
import { useMempool } from '@hooks/use-mempool';
import { SignTransaction } from '@modals/components/sign-transaction';
import { useLatestNonce } from '@hooks/use-latest-nonce';

import {
  StackingModalHeader as Header,
  StackingModalFooter as Footer,
  StackingModalButton as Button,
  modalStyle,
} from '../components/stacking-modal-layout';

enum RevokeDelegationModalStep {
  SignTransaction,
  FailedContractCall,
}

export const RevokeDelegationModal: FC = () => {
  const dispatch = useDispatch();

  useHotkeys('esc', () => void dispatch(homeActions.closeRevokeDelegationModal()));
  const closeModal = () => dispatch(homeActions.closeRevokeDelegationModal());

  const api = useApi();
  const { walletType } = useWalletType();
  const { stackingClient } = useStackingClient();
  const { nonce } = useLatestNonce();
  const { broadcastTx, isBroadcasting } = useBroadcastTx();
  const { refetch: refetchMempool } = useMempool();
  const poxInfo = useSelector(selectPoxInfo);

  const initialStep = RevokeDelegationModalStep.SignTransaction;

  const [step, setStep] = useState(initialStep);

  const getRevocationTxOptions = useCallback((): ContractCallOptions => {
    if (!poxInfo) throw new Error('`poxInfo` undefined');
    return {
      ...stackingClient.getRevokeDelegateStxOptions(poxInfo.contract_id),
      nonce: new BN(nonce),
    };
  }, [poxInfo, nonce, stackingClient]);

  const revokeDelegation = useCallback(
    (signedTx: StacksTransaction) =>
      broadcastTx({
        onSuccess: async txId => {
          await safeAwait(watchForNewTxToAppear({ txId, nodeUrl: api.baseUrl }));
          await refetchMempool();
          dispatch(homeActions.closeRevokeDelegationModal());
        },
        onFail: () => setStep(RevokeDelegationModalStep.FailedContractCall),
        tx: signedTx,
      }),
    [api.baseUrl, broadcastTx, dispatch, refetchMempool]
  );

  const txFormStepMap: Record<RevokeDelegationModalStep, () => JSX.Element> = {
    [RevokeDelegationModalStep.SignTransaction]: () => (
      <>
        <Header onSelectClose={closeModal}>Confirm and revoke delegation</Header>
        <SignTransaction
          action="revoke delegation"
          txOptions={getRevocationTxOptions()}
          isBroadcasting={isBroadcasting}
          onTransactionSigned={tx => {
            console.log('transaction signed', tx);
            void revokeDelegation(tx);
          }}
        />
      </>
    ),
    [RevokeDelegationModalStep.FailedContractCall]: () => (
      <>
        <Header onSelectClose={closeModal} />
        <StackingFailed walletType={walletType}>Failed to call stacking contract</StackingFailed>
        <Footer>
          <Button mode="tertiary" onClick={closeModal}>
            Close
          </Button>
          <Button onClick={() => setStep(initialStep)}>Try again</Button>
        </Footer>
      </>
    ),
  };

  return (
    <Modal isOpen {...modalStyle}>
      {txFormStepMap[step]()}
    </Modal>
  );
};
