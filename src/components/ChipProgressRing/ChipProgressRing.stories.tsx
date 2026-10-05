import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChipProgressRing } from './ChipProgressRing';

const meta: Meta<typeof ChipProgressRing> = {
  title: 'Components/ChipProgressRing',
  component: ChipProgressRing,
  parameters: {
    // ⚠️ NOT SNAPSHOTTED, AND THIS IS NOT LAZINESS.
    //
    // The mark travels the border continuously for 20 revolutions of 1100 ms.
    // Chromatic captures one frame, and which frame it gets is a race — so
    // every build would diff against the last and report a change that is the
    // animation doing its job. That is paid noise, and noise is how a visual
    // suite gets ignored.
    //
    // ⚠️ React Native's Animated runs in JS under react-native-web, not as CSS,
    // so Chromatic's `pauseAnimationAtEnd` cannot freeze it, and `delay` caps
    // well below the 22 s this takes to finish.
    //
    // To make this snapshot-able the component needs a way to render a FIXED
    // progress — a `progress?: number` prop the animation drives and a story
    // can set. That is a change to the component, not to this file, and it is
    // worth doing: this is the component that shipped inverted, with its own
    // unit tests asserting the inversion.
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

/** On a white card, which is where the inversion was visible. */
export const OnACard: StoryObj = {
  render: () => (
    <View style={styles.chip}>
      <Text>E</Text>
      <ChipProgressRing />
    </View>
  ),
};

const styles = StyleSheet.create({
  // A chip, as the Translator draws one: white, 14pt radius — the surface the
  // inverted ring was visible against.
  chip: {
    width: 56,
    height: 56,
    margin: 24,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
