import React, { FC, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from 'react-query';
import { useFormik } from 'formik';
import * as yup from 'yup';
import BN from 'bn.js';
import { PostCoreNodeTransactionsError } from '@blockstack/stacks-blockchain-api-types';
import { BigNumber } from 'bignumber.js';
import { Modal } from '@blockstack/ui';
import { MEMO_MAX_LENGTH_BYTES, StacksTransaction } from '@stacks/transactions';

import { useHotkeys } from 'react-hotkeys-hook';

import { validateDecimalPrecision } from '@utils/form/validate-decimals';

import { useLatestNonce } from '@hooks/use-latest-nonce';
import { safeAwait } from '@utils/safe-await';
import { Api } from '@api/api';
import { STX_DECIMAL_PRECISION, STX_TRANSFER_TX_SIZE_BYTES } from '@constants/index';

import { validateStacksAddress } from '@utils/get-stx-transfer-direction';

import { homeActions } from '@store/home';

import { validateAddressChain } from '@crypto/validate-address-net';
import { stxToMicroStx, microStxToStx } from '@utils/unit-convert';

import { stacksNetwork } from '../../environment';
import {
  TxModalHeader,
  TxModalFooter,
  TxModalButton,
  modalStyle,
} from './transaction-modal-layout';
import { TxModalForm } from './steps/transaction-form';
import { FailedBroadcastError } from './steps/failed-broadcast-error';
import { PreviewTransaction } from './steps/preview-transaction';
import { useBalance } from '@hooks/use-balance';
import { watchForNewTxToAppear } from '@api/watch-tx-to-appear-in-api';
import { useApi } from '@hooks/use-api';
import { SignTransaction } from '@components/tx-signing/sign-transaction';
import { useBroadcastTx } from '@hooks/use-broadcast-tx';

interface TxModalProps {
  balance: string;
  address: string;
}

enum TxModalStep {
  DescribeTx,
  PreviewTx,
  SignTransaction,
  NetworkError,
}

export const TransactionModal: FC<TxModalProps> = ({ address }) => {
  const dispatch = useDispatch();
  useHotkeys('esc', () => void dispatch(homeActions.closeTxModal()));

  const queryClient = useQueryClient();
  const stacksApi = useApi();
  const [step, setStep] = useState(TxModalStep.DescribeTx);
  const [fee, setFee] = useState(new BigNumber(0));
  const [amount, setAmount] = useState(new BigNumber(0));
  const [total, setTotal] = useState(new BigNumber(0));
  const { availableBalance: balance } = useBalance();
  const { broadcastTx, isBroadcasting } = useBroadcastTx();

  const [feeEstimateError, setFeeEstimateError] = useState<string | null>(null);

  const [nodeResponseError, setNodeResponseError] = useState<PostCoreNodeTransactionsError | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const interactedWithSendAllBtn = useRef(false);
  const { nonce } = useLatestNonce();

  const sendStx = (tx: StacksTransaction) => {
    console.log(tx);
    broadcastTx({
      async onSuccess(txId: string) {
        await watchForNewTxToAppear({ txId, nodeUrl: stacksApi.baseUrl });
        await safeAwait(queryClient.refetchQueries(['mempool']));
        closeModal();
      },
      onFail: (error?: PostCoreNodeTransactionsError) => {
        if (error) setNodeResponseError(error);
        setStep(TxModalStep.NetworkError);
      },
      tx,
    });
  };

  const totalIsMoreThanBalance = total.isGreaterThan(balance);

  const exceedsMaxLengthBytes = (string: string, maxLengthBytes: number): boolean =>
    string ? Buffer.from(string).length > maxLengthBytes : false;

  const form = useFormik({
    validateOnChange: true,
    validateOnMount: !interactedWithSendAllBtn.current,
    validateOnBlur: !interactedWithSendAllBtn.current,
    initialValues: {
      recipient: '',
      amount: '',
      memo: '',
    },
    validationSchema: yup.object().shape({
      recipient: yup
        .string()
        .test('test-is-stx-address', 'Must be a valid Stacks Address', (value = '') =>
          value === null ? false : validateStacksAddress(value)
        )
        .test('test-is-for-valid-chain', 'Address is for incorrect network', (value = '') =>
          value === null ? false : validateAddressChain(value)
        )
        .test(
          'test-is-not-my-address',
          'You cannot send Stacks to yourself',
          value => value !== address
        ),
      amount: yup
        .number()
        .typeError('Amount of STX must be described as number')
        .positive('You cannot send a negative amount of STX')
        .test(
          'test-has-less-than-or-equal-to-6-decimal-places',
          'STX do not have more than 6 decimal places',
          value => validateDecimalPrecision(STX_DECIMAL_PRECISION)(value)
        )
        .test(
          'test-address-has-enough-balance',
          'Cannot send more STX than available balance',
          value => {
            if (value === null || value === undefined) return false;
            // If there's no input, pass this test,
            // otherwise it'll render the error for this test
            if (value === undefined) return true;
            const enteredAmount = stxToMicroStx(value);
            return enteredAmount.isLessThanOrEqualTo(balance);
          }
        )
        .required(),
      memo: yup
        .string()
        .test('test-max-memo-length', 'Transaction memo cannot exceed 34 bytes', (value = '') =>
          value === null ? false : !exceedsMaxLengthBytes(value, MEMO_MAX_LENGTH_BYTES)
        ),
    }),
    onSubmit: async () => {
      setLoading(true);
      setFeeEstimateError(null);
      const [error, feeRate] = await safeAwait(new Api(stacksApi.baseUrl).getFeeRate());
      if (error) {
        setFeeEstimateError('Error fetching estimate fees');
      }
      if (feeRate) {
        const fee = new BigNumber(feeRate.data).multipliedBy(STX_TRANSFER_TX_SIZE_BYTES);
        const amount = stxToMicroStx(form.values.amount);
        setFee(fee);
        setTotal(amount.plus(fee.toString()));
        setAmount(amount);
        setStep(TxModalStep.PreviewTx);
      }
      setLoading(false);
    },
  });

  const createSendTxOptions = {
    recipient: form.values.recipient,
    network: stacksNetwork,
    amount: new BN(stxToMicroStx(form.values.amount || 0).toString()),
    memo: form.values.memo,
    nonce: new BN(nonce),
  };

  const [calculatingMaxSpend, setCalculatingMaxSpend] = useState(false);

  const closeModal = () => dispatch(homeActions.closeTxModal());

  const updateAmountFieldToMaxBalance = async () => {
    interactedWithSendAllBtn.current = true;
    setCalculatingMaxSpend(true);
    const [error, feeRate] = await safeAwait(new Api(stacksApi.baseUrl).getFeeRate());
    if (error) setCalculatingMaxSpend(false);
    if (feeRate) {
      const fee = new BigNumber(feeRate.data).multipliedBy(STX_TRANSFER_TX_SIZE_BYTES);
      const balanceLessFee = new BigNumber(balance).minus(fee.toString());
      if (balanceLessFee.isLessThanOrEqualTo(0)) {
        void form.setFieldTouched('amount');
        form.setFieldError('amount', 'Your balance is not sufficient to cover the transaction fee');
        setCalculatingMaxSpend(false);
        return;
      }
      void form.setValues({
        ...form.values,
        amount: microStxToStx(balanceLessFee.toString()).toString(),
      });
      setCalculatingMaxSpend(false);
      setTimeout(() => (interactedWithSendAllBtn.current = false), 1000);
    }
  };

  const txFormStepMap: Record<TxModalStep, () => JSX.Element> = {
    [TxModalStep.DescribeTx]: () => (
      <>
        <TxModalHeader onSelectClose={closeModal}>Send STX</TxModalHeader>
        <TxModalForm
          balance={balance.toString()}
          form={form && form}
          isCalculatingMaxSpend={calculatingMaxSpend}
          onSendEntireBalance={updateAmountFieldToMaxBalance}
          feeEstimateError={feeEstimateError}
        />

        <TxModalFooter>
          <TxModalButton mode="tertiary" onClick={closeModal}>
            Cancel
          </TxModalButton>
          <TxModalButton onClick={() => form.submitForm()} isLoading={loading}>
            Preview
          </TxModalButton>
        </TxModalFooter>
      </>
    ),
    [TxModalStep.PreviewTx]: () => (
      <>
        <TxModalHeader onSelectClose={closeModal}>Preview transaction</TxModalHeader>
        <PreviewTransaction
          recipient={form.values.recipient}
          amount={amount.toString()}
          fee={fee.toString()}
          total={total.toString()}
          memo={form.values.memo}
          totalExceedsBalance={totalIsMoreThanBalance}
        />

        <TxModalFooter>
          <TxModalButton mode="tertiary" onClick={() => setStep(TxModalStep.DescribeTx)}>
            Go back
          </TxModalButton>
          <TxModalButton
            isLoading={loading}
            isDisabled={totalIsMoreThanBalance}
            onClick={() => setStep(TxModalStep.SignTransaction)}
          >
            Send
          </TxModalButton>
        </TxModalFooter>
      </>
    ),
    [TxModalStep.SignTransaction]: () => (
      <>
        <TxModalHeader onSelectClose={closeModal}>Confirm and send</TxModalHeader>
        <SignTransaction
          action="send STX"
          txOptions={createSendTxOptions}
          isBroadcasting={isBroadcasting}
          onTransactionSigned={tx => {
            console.log(tx);
            void sendStx(tx);
          }}
        />
      </>
    ),
    [TxModalStep.NetworkError]: () => (
      <>
        <TxModalHeader onSelectClose={closeModal} />
        <FailedBroadcastError error={nodeResponseError} />
        <TxModalFooter>
          <TxModalButton mode="tertiary" onClick={closeModal}>
            Close
          </TxModalButton>
          <TxModalButton onClick={() => setStep(TxModalStep.DescribeTx)}>Try again</TxModalButton>
        </TxModalFooter>
      </>
    ),
  };

  return (
    <Modal isOpen {...modalStyle}>
      {txFormStepMap[step]()}
    </Modal>
  );
};
