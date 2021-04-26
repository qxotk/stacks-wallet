import React, { FC, useState } from 'react';

import { StackingStep, StackingStepAction } from '../../components/stacking-form-step';
import { StackingUserConfirm } from '../../components/stacking-user-confirm';
import { DelegatedStackingTerms } from './delegated-stacking-terms';

interface ConfirmAndLockStepProps {
  id: string;
  formComplete: boolean;
  step?: number;
  onConfirmAndDelegate(): void;
}
export const ConfirmAndDelegateStep: FC<ConfirmAndLockStepProps> = props => {
  const { step, id, formComplete, onConfirmAndDelegate } = props;
  const [hasUserConfirmed, setHasUserConfirmed] = useState(false);
  return (
    <StackingStep title={id} step={step} isComplete={false} state="open" mb="300px">
      <DelegatedStackingTerms mt="loose" />
      <StackingUserConfirm
        onChange={useConfirmed => setHasUserConfirmed(useConfirmed)}
        mt="extra-loose"
      />
      <StackingStepAction
        onClick={onConfirmAndDelegate}
        isDisabled={!formComplete || !hasUserConfirmed}
      >
        Confirm and start pooling
      </StackingStepAction>
    </StackingStep>
  );
};
