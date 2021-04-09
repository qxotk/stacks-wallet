import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Text, Button } from '@blockstack/ui';

import routes from '@constants/routes.json';
import { useBackButton } from '@hooks/use-back-url';
import { ResetWalletModal } from '@modals/reset-wallet/reset-wallet-modal';

import { RootState } from '@store/index';
import {
  selectStacksNodeApis,
  upsertStacksNodeApi,
  selectActiveNodeApi,
  setActiveStacksNode,
  removeStacksNodeApi,
  defaultNode,
} from '@store/stacks-node';
import { UpsertStacksNodeSettingsModal } from '@modals/upsert-stacks-node-api/upsert-stacks-node-api';
import { NodeSelect } from '@components/settings/node-select';
import { NodeSelectItem } from '@components/settings/node-select-item';
import { SettingSection } from '@components/settings/settings-section';

import { SettingsLayout, SettingDescription } from './settings-layout';
import { useWalletType } from '@hooks/use-wallet-type';

export const Settings = () => {
  const dispatch = useDispatch();
  const { nodes, selectedNodeApi } = useSelector((state: RootState) => ({
    nodes: selectStacksNodeApis(state),
    selectedNodeApi: selectActiveNodeApi(state),
  }));
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [operation, setOperation] = useState<'create' | 'update'>('create');
  const { whenWallet } = useWalletType();
  useBackButton(routes.HOME);

  return (
    <SettingsLayout>
      <SettingSection title="Node settings">
        <SettingDescription>Select the node you'd like to use</SettingDescription>
        <UpsertStacksNodeSettingsModal
          isOpen={nodeModalOpen}
          selectedNode={operation === 'update' ? selectedNodeApi : undefined}
          onUpdateNode={node => dispatch(upsertStacksNodeApi(node))}
          onClose={() => setNodeModalOpen(false)}
        />
        <NodeSelect>
          {[defaultNode, ...nodes].map((node, i) => (
            <NodeSelectItem
              key={i}
              index={i}
              node={node}
              activeNode={selectedNodeApi}
              onChange={nodeId => dispatch(setActiveStacksNode(nodeId))}
              onEdit={() => (setOperation('update'), setNodeModalOpen(true))}
              onDelete={nodeId => dispatch(removeStacksNodeApi(nodeId))}
            />
          ))}
        </NodeSelect>
        <Button mt="loose" onClick={() => (setOperation('create'), setNodeModalOpen(true))}>
          Add a node
        </Button>
      </SettingSection>
      <SettingSection title="Reset wallet">
        <SettingDescription>
          When you reset your wallet, you will need to
          {whenWallet({
            software: ' sign back in with your 24-word Secret Key.',
            ledger: ' reauthenticate with your Ledger device',
          })}
          <br />
          <Text mt="base-tight" display="block" color="ink.600" textStyle="caption">
            Your wallet data can be found in: <code>{main.getUserDataPath()}</code>
          </Text>
        </SettingDescription>
        <ResetWalletModal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} />

        <Button
          mt="loose"
          style={{ background: '#D4001A' }}
          onClick={() => setResetModalOpen(true)}
        >
          Reset wallet
        </Button>
      </SettingSection>
    </SettingsLayout>
  );
};
