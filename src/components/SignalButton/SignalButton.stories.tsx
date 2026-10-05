import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SignalButton } from './SignalButton';

const meta: Meta<typeof SignalButton> = {
  title: 'Components/SignalButton',
  component: SignalButton,
};

export default meta;

const noop = (): void => {};

/**
 * All three states in one snapshot.
 *
 * ⚠️ `canPlay: false` is the one that matters and the one nobody looks at: it
 * is what a user sees when there is nothing to send, or nothing to send it on.
 * A disabled control that looks enabled is the exact defect this app has
 * already shipped twice — the Speak screen said "Tap to speak" while tapping
 * did nothing, and the Light chip stayed dark with no explanation.
 */
export const States: StoryObj = {
  render: () => (
    <View style={styles.stack}>
      <SignalButton playing={false} canPlay label="Emit" onPress={noop} />
      <SignalButton playing canPlay label="Stop" onPress={noop} />
      <SignalButton playing={false} canPlay={false} label="Emit" onPress={noop} />
    </View>
  ),
};

const styles = StyleSheet.create({ stack: { gap: 12, padding: 16, width: 320 } });
