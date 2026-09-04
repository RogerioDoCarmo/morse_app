import React, { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { theme } from '@/theme';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 26;

type Props = Readonly<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Spoken name — the row's own label, since the control shows no text. */
  accessibilityLabel: string;
  testID?: string;
}>;

/**
 * A range control, built here rather than pulled in.
 *
 * React Native ships no slider, and the community package is a native module:
 * it would mean another pod in a project where the pod graph has already cost
 * a day. The behaviour needed is small and entirely in JS.
 *
 * The thumb takes no touches, so every gesture lands on the track and
 * `locationX` is track-relative without measuring anything in the window.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  testID,
}: Props): React.JSX.Element {
  const [width, setWidth] = useState(0);

  const clamp = useCallback(
    (raw: number): number => {
      // Snap to the step, then hold the result in range: rounding at the top
      // of the track can otherwise land one step past `max`.
      const snapped = Math.round(raw / step) * step;
      return Math.min(max, Math.max(min, snapped));
    },
    [max, min, step],
  );

  const emit = useCallback(
    (event: GestureResponderEvent): void => {
      // Nothing to map onto until the track has been laid out.
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
      onChange(clamp(min + ratio * (max - min)));
    },
    [clamp, max, min, onChange, width],
  );

  // Rebuilt whenever `emit` changes rather than created once: the handlers are
  // spread fresh every render, so a stale closure over the width would be a
  // slider that stops responding after the first layout.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: emit,
        onPanResponderMove: emit,
      }),
    [emit],
  );

  const nudge = useCallback(
    (by: number): void => {
      onChange(clamp(value + by * step));
    },
    [clamp, onChange, step, value],
  );

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const filled = Math.round(ratio * Math.max(0, width - THUMB_SIZE));

  return (
    <View
      testID={testID}
      style={styles.hit}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1);
      }}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      {...responder.panHandlers}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: filled + THUMB_SIZE / 2 }]} />
      </View>
      <View style={[styles.thumb, { left: filled }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Taller than the track it draws: a 6pt line is not a touch target.
  hit: { height: 34, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  fill: { height: TRACK_HEIGHT, backgroundColor: theme.color.accent },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.color.surface,
    boxShadow: theme.shadow.card,
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
});
