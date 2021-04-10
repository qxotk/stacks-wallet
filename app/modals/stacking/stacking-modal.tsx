import React, { FC, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal } from '@blockstack/ui';
import { useHistory } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { BigNumber } from 'bignumber.js';
import BN from 'bn.js';

import { RootState } from '@store/index';
import routes from '@constants/routes.json';
import { activeStackingTx, selectCoreNodeInfo, selectPoxInfo } from '@store/stacking';
import { StacksTransaction } from '@stacks/transactions';
import { selectAddressBalance } from '@store/address';
import { useDecryptWallet } from '@hooks/use-decrypt-wallet';
import { useStackingClient } from '@hooks/use-stacking-client';
import { useApi } from '@hooks/use-api';
import { useCreateLedgerContractCallTx } from '@hooks/use-create-ledger-contract-call-tx';
import { useCreateSoftwareContractCallTx } from '@hooks/use-create-software-contract-call-tx';
import { safeAwait } from '@utils/safe-await';

import {
  StackingModalHeader,
  StackingModalFooter,
  StackingModalButton,
  modalStyle,
} from '../components/stacking-modal-layout';
import { DecryptWalletForm } from '../components/decrypt-wallet-form';

import { StackingFailed } from '@modals/components/stacking-failed';
import { watchForNewTxToAppear } from '@api/watch-tx-to-appear-in-api';
import { SignTxWithLedger } from '../components/sign-tx-with-ledger';
import { LedgerConnectStep, usePrepareLedger } from '@hooks/use-prepare-ledger';
import { useWalletType } from '@hooks/use-wallet-type';
import { useBroadcastTx } from '@hooks/use-broadcast-tx';
import { useMempool } from '@hooks/use-mempool';
import { isDecryptionError } from '@crypto/key-encryption';

enum StackingModalStep {
  DecryptWalletAndSend,
  SignWithLedgerAndSend,
  FailedContractCall,
}

type StackingModalComponents = () => Record<'header' | 'body' | 'footer', JSX.Element>;

interface StackingModalProps {
  poxAddress: string;
  numCycles: number;
  amountToStack: BigNumber;
  onClose(): void;
}

export const StackingModal: FC<StackingModalProps> = props => {
  const { onClose, numCycles, poxAddress, amountToStack } = props;

  const dispatch = useDispatch();
  const history = useHistory();
  useHotkeys('esc', () => onClose());

  const [password, setPassword] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  const { stackingClient } = useStackingClient();
  const { decryptWallet, isDecrypting } = useDecryptWallet();
  const { broadcastTx, isBroadcasting } = useBroadcastTx();
  const { walletType, whenWallet } = useWalletType();
  const { createLedgerContractCallTx } = useCreateLedgerContractCallTx();
  const { createSoftwareContractCallTx } = useCreateSoftwareContractCallTx();
  const { refetch } = useMempool();
  const api = useApi();

  const { poxInfo, coreNodeInfo, balance } = useSelector((state: RootState) => ({
    poxInfo: selectPoxInfo(state),
    coreNodeInfo: selectCoreNodeInfo(state),
    balance: selectAddressBalance(state),
  }));

  const initialStep = whenWallet({
    software: StackingModalStep.DecryptWalletAndSend,
    ledger: StackingModalStep.SignWithLedgerAndSend,
  });

  const [step, setStep] = useState(initialStep);

  const createStackingTxOptions = useCallback(() => {
    if (!poxInfo) throw new Error('poxInfo not defined');
    if (!coreNodeInfo) throw new Error('Stacking requires coreNodeInfo');
    return stackingClient.getStackOptions({
      amountMicroStx: new BN(amountToStack.toString()),
      poxAddress,
      cycles: numCycles,
      contract: poxInfo.contract_id,
      burnBlockHeight: coreNodeInfo.burn_block_height,
    });
  }, [amountToStack, coreNodeInfo, numCycles, poxAddress, poxInfo, stackingClient]);

  const createSoftwareWalletTx = useCallback(async (): Promise<StacksTransaction> => {
    if (!password || !poxInfo || !balance) {
      throw new Error('One of `password`, `encryptedMnemonic` or `salt` is missing');
    }
    if (coreNodeInfo === null) throw new Error('Stacking requires coreNodeInfo');
    const { privateKey } = await decryptWallet(password);
    const txOptions = createStackingTxOptions();
    return createSoftwareContractCallTx({ txOptions, privateKey });
  }, [
    balance,
    coreNodeInfo,
    createSoftwareContractCallTx,
    createStackingTxOptions,
    decryptWallet,
    password,
    poxInfo,
  ]);

  const createLedgerWalletTx = useCallback(async (): Promise<StacksTransaction> => {
    if (coreNodeInfo === null) throw new Error('Stacking requires coreNodeInfo');
    return createLedgerContractCallTx({ txOptions: createStackingTxOptions() });
  }, [coreNodeInfo, createLedgerContractCallTx, createStackingTxOptions]);

  const createStackingTx = useCallback(async () => {
    setHasSubmitted(true);
    return whenWallet<() => Promise<StacksTransaction | undefined>>({
      software: async () => {
        const [error, transaction] = await safeAwait(createSoftwareWalletTx());
        if (error) {
          setDecryptionError(
            isDecryptionError(error) ? 'Unable to decrypt wallet' : 'Something went wrong'
          );
          return;
        }
        return transaction;
      },
      ledger: async () => {
        const [error, transaction] = await safeAwait(createLedgerWalletTx());
        if (error) {
          setHasSubmitted(false);
          setStep(StackingModalStep.FailedContractCall);
          return;
        }
        return transaction;
      },
    })();
  }, [createLedgerWalletTx, createSoftwareWalletTx, whenWallet]);

  const stackStx = () =>
    broadcastTx({
      async onSuccess(txId) {
        dispatch(activeStackingTx({ txId }));
        await safeAwait(watchForNewTxToAppear({ txId, nodeUrl: api.baseUrl }));
        await refetch();
        history.push(routes.HOME);
      },
      onFail: () => setStep(StackingModalStep.FailedContractCall),
      txCreator: createStackingTx as any,
    });

  const { step: ledgerConnectStep, isLocked } = usePrepareLedger();

  const txFormStepMap: Record<StackingModalStep, StackingModalComponents> = {
    [StackingModalStep.DecryptWalletAndSend]: () => ({
      header: <StackingModalHeader onSelectClose={onClose}>Confirm and lock</StackingModalHeader>,
      body: (
        <DecryptWalletForm
          description="Enter your password to initiate Stacking"
          onSetPassword={password => setPassword(password)}
          onForgottenPassword={() => {
            onClose();
            history.push(routes.SETTINGS);
          }}
          hasSubmitted={hasSubmitted}
          decryptionError={decryptionError}
        />
      ),
      footer: (
        <StackingModalFooter>
          <StackingModalButton mode="tertiary" onClick={onClose}>
            Close
          </StackingModalButton>
          <StackingModalButton
            isLoading={isDecrypting || isBroadcasting}
            isDisabled={isDecrypting || isBroadcasting}
            onClick={() => stackStx()}
          >
            Initiate Stacking
          </StackingModalButton>
        </StackingModalFooter>
      ),
    }),
    [StackingModalStep.SignWithLedgerAndSend]: () => ({
      header: (
        <StackingModalHeader onSelectClose={onClose}>Confirm on your Ledger</StackingModalHeader>
      ),
      body: <SignTxWithLedger step={ledgerConnectStep} isLocked={isLocked} ledgerError={null} />,
      footer: (
        <StackingModalFooter>
          <StackingModalButton
            mode="tertiary"
            onClick={() => {
              setHasSubmitted(false);
              onClose();
            }}
          >
            Close
          </StackingModalButton>
          <StackingModalButton
            isDisabled={
              hasSubmitted || ledgerConnectStep !== LedgerConnectStep.ConnectedAppOpen || isLocked
            }
            isLoading={hasSubmitted}
            onClick={() => void stackStx()}
          >
            Sign transaction
          </StackingModalButton>
        </StackingModalFooter>
      ),
    }),

    [StackingModalStep.FailedContractCall]: () => ({
      header: <StackingModalHeader onSelectClose={onClose} />,
      body: (
        <StackingFailed walletType={walletType}>Failed to call stacking contract</StackingFailed>
      ),
      footer: (
        <StackingModalFooter>
          <StackingModalButton mode="tertiary" onClick={onClose}>
            Close
          </StackingModalButton>
          <StackingModalButton onClick={() => setStep(initialStep)}>Try again</StackingModalButton>
        </StackingModalFooter>
      ),
    }),
  };

  const { header, body, footer } = txFormStepMap[step]();

  return (
    <Modal isOpen headerComponent={header} footerComponent={footer} {...modalStyle}>
      {body}
    </Modal>
  );
};
