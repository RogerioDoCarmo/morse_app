import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React, { useState } from 'react';

import { SegmentedControl, type Segment } from './SegmentedControl';

const SEGMENTS: readonly Segment<'text' | 'morse'>[] = [
  { value: 'text', label: 'Text → Morse' },
  { value: 'morse', label: 'Morse → Text' },
];

/**
 * ⚠️ One story per VISUAL STATE, not per prop. Chromatic bills one snapshot
 * per story per build, so each story here is a standing monthly cost.
 */
const meta: Meta<typeof SegmentedControl> = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
};

export default meta;

/**
 * Both states in one snapshot. The selected and unselected segments differ
 * only in background and weight, and that contrast is the thing worth
 * watching — so they belong in the same image rather than two.
 */
export const BothStates: StoryObj = {
  render: function Render() {
    const [value, setValue] = useState<'text' | 'morse'>('text');
    return <SegmentedControl segments={SEGMENTS} value={value} onChange={setValue} />;
  },
};
