import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { Text } from 'react-native';

import { Card } from './Card';

/**
 * ⚠️ One story per visual state, not one per prop. Chromatic bills per
 * snapshot, so a story is a decision to spend on every future build.
 */
const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};

export default meta;

export const Default: StoryObj<typeof Card> = {
  render: () => (
    <Card>
      <Text>Card contents</Text>
    </Card>
  ),
};
