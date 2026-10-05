import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { TypeHintDot } from './TypeHintDot';

const meta: Meta<typeof TypeHintDot> = {
  title: 'Components/TypeHintDot',
  component: TypeHintDot,
  parameters: {
    // ⚠️ Not snapshotted — it beats 6 times at 1100 ms. See
    // ChipProgressRing.stories.tsx.
    //
    // ⚠️ Worth noting what that costs here: both defects reported from a real
    // device were about this dot's SIZE and its VERTICAL ALIGNMENT with the
    // label — neither of which is animated, and both of which a snapshot would
    // have caught. The halo's opacity is the only moving part. A frozen-state
    // prop would make this one genuinely worth snapshotting.
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

/** Beside a label, which is the alignment that was reported wrong twice. */
export const BesideItsLabel: StoryObj = {
  render: () => (
    <View style={styles.surface}>
      <TypeHintDot label="English" />
    </View>
  ),
};

const styles = StyleSheet.create({
  // The white card the dot actually sits on.
  surface: { padding: 24, backgroundColor: '#ffffff' },
});
