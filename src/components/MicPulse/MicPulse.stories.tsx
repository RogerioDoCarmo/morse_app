import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MicPulse } from './MicPulse';

const meta: Meta<typeof MicPulse> = {
  title: 'Components/MicPulse',
  component: MicPulse,
  parameters: {
    // ⚠️ Not snapshotted — a halo that grows and fades for 30 pulses of
    // 1400 ms. See ChipProgressRing.stories.tsx for the full reasoning; the
    // short version is that Chromatic would photograph a different frame every
    // build and charge for the difference.
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

/** Active. Inactive renders null, which is nothing to look at. */
export const Listening: StoryObj = {
  render: () => (
    <View style={styles.frame}>
      <MicPulse active />
    </View>
  ),
};

const styles = StyleSheet.create({
  frame: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
});
