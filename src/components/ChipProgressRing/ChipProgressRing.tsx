import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { theme } from '@/theme';

/** One full revolution, in milliseconds. Slow enough to read as deliberate. */
const REVOLUTION_MS = 1100;

/**
 * How many revolutions before it rests.
 *
 * ⚠️ FINITE, and 20 is a deliberate number rather than a large one. The four
 * beats {@link TapHalo} uses were not enough — a TestFlight tester finished
 * 0.3.4 never discovering the chips are pressable — so this runs long enough to
 * still be turning while someone decides what to touch.
 *
 * ⚠️ It must NOT be infinite. Maestro waits for the UI to settle after every
 * command, and 12 flows traverse this carousel through `dismiss-first-run.yaml`.
 * An endless animation also cost the Play promo tour TWENTY-THREE SECONDS
 * against a 180-second `screenrecord` ceiling, truncating it and losing Speak,
 * Tap and Learn — and `video/tour.yaml` swipes THROUGH these slides rather than
 * skipping them, so it would pay that cost in full.
 */
const REVOLUTIONS = 20;

/** How much thicker than a resting chip edge, so it reads as active. */
const BORDER_WIDTH = 3;

/**
 * A ring whose lit segment travels around a chip, like a progress indicator.
 *
 * Used ONLY by the first-run guide's letter slide. In the app proper the chips
 * wear {@link TapHalo}, which breathes four times — a nudge, not a summons.
 * This is the summons, and it is confined to the one screen whose whole job is
 * teaching that the chips can be pressed.
 *
 * ⚠️ ABSOLUTE, for the reason TapHalo records: a chip sits in a wrapping row,
 * and anything occupying space would move its neighbours on every frame and
 * re-wrap the row on a narrow screen.
 *
 * The travelling segment is one border side in a brighter colour, rotated. A
 * single rotating view costs one animated transform, where animating a segment
 * along a path would cost a frame-by-frame redraw of the whole ring.
 */
export function ChipProgressRing({
  testID = 'chip-progress-ring',
}: Readonly<{ testID?: string }>): React.JSX.Element {
  // Lazy `useState` rather than a ref read during render — see TypeHintDot.
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const turn = Animated.timing(spin, {
      toValue: 1,
      duration: REVOLUTION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    // `sequence` of a reset + turn rather than `loop({iterations})`: the reset
    // has to happen on the JS side between revolutions, and a loop with a
    // native driver would carry the value past 1 instead.
    const animation = Animated.loop(turn, { iterations: REVOLUTIONS });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { transform: [{ rotate }] }]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: BORDER_WIDTH,
    borderRadius: theme.radius.chip,
    borderColor: theme.color.accent,
    // The travelling portion. One side lighter than the rest reads as a
    // segment moving around the edge once the whole ring turns.
    borderTopColor: theme.color.onInk,
  },
});
