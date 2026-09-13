import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { theme } from '@/theme';

/** One breath, in milliseconds — the same beat the type hint uses. */
const BEAT_MS = 1100;

/**
 * How many times it breathes before resting.
 *
 * ⚠️ FINITE, for the reason {@link TypeHintDot} records in full: an endless
 * animation never lets Maestro settle, and it cost the Play promo tour
 * TWENTY-THREE SECONDS against a 180-second recording ceiling. It is also the
 * better design — something that pulses at you indefinitely has stopped being
 * a hint and become a nag.
 */
const BEATS = 4;

/** How far the ring grows past the thing it is pointing at. */
const GROWTH = 1.22;

/**
 * A ring that breathes around whatever it is placed in, saying "press this".
 *
 * ⚠️ ABSOLUTE, and deliberately so. It points at a letter chip, which sits in
 * a wrapping row beside its neighbours — anything that took up space would
 * move every chip after it on the beat, and re-wrap the row on a narrow
 * phone. It borrows its parent's size instead and paints behind the marks.
 *
 * ⚠️ `pointerEvents="none"`: the chip underneath is the whole point. A ring
 * that swallowed the press would teach the opposite of what it is inviting.
 */
export function TapHalo({
  testID = 'tap-halo',
}: Readonly<{ testID?: string }> = {}): React.JSX.Element {
  // Lazy `useState` rather than a ref read during render — see TypeHintDot.
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: BEAT_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(beat, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: BEATS },
    );
    loop.start();
    // Stopped on unmount: a loop on a detached node keeps a native animation
    // alive for the rest of the session.
    return () => {
      loop.stop();
    };
  }, [beat]);

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        {
          opacity: beat.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [
            { scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, GROWTH] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // An outline rather than a fill: the chip already has a background, and a
  // second one behind it would read as the selected state the playhead uses.
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.control,
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
});
