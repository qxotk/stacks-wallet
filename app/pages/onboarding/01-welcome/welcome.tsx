import React from 'react';
import { useHistory } from 'react-router-dom';

import routes from '@constants/routes.json';
import {
  Onboarding,
  OnboardingTitle,
  OnboardingButton,
  OnboardingText,
} from '@components/onboarding';
import { useBackButton } from '@hooks/use-back-url';
import { WalletWarning } from '@components/wallet-warning';

export const Welcome: React.FC = () => {
  const history = useHistory();
  useBackButton(routes.TERMS);

  return (
    <Onboarding>
      <OnboardingTitle>Stacks Wallet</OnboardingTitle>
      <OnboardingText>
        Manage your STX holdings, and earn Bitcoin by participating in Stacking
      </OnboardingText>
      <OnboardingButton
        mt="extra-loose"
        onClick={() => history.push(routes.CREATE)}
        data-test="create-new-wallet-btn"
      >
        Create a new wallet
      </OnboardingButton>
      <OnboardingButton
        onClick={() => history.push(routes.RESTORE)}
        mt="base"
        mode="secondary"
        data-test="btn-restore-wallet"
      >
        I already have a wallet
      </OnboardingButton>
      <WalletWarning mt="extra-loose" />
    </Onboarding>
  );
};
