import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

/**
 * The dot itself, in points.
 *
 * ⚠️ 10, not 7. At 7 it was reported from a device as not catching the eye —
 * which is the ONLY job it has, since it replaced the input's auto-focus. It
 * is still a dot and not a badge: the accent colour, not red, because it
 * points at a field rather than reporting a problem.
 */
const SIZE = 10;

/** How far the halo grows past the dot at the top of each pulse. */
const HALO = 3.2;

/**
 * How solid the halo is at the start of a beat.
 *
 * Raised with {@link SIZE} for the same reason. Past about 0.7 the halo stops
 * reading as a ring of light around the dot and starts reading as a second,
 * blurrier dot.
 */
const HALO_OPACITY = 0.6;

/** One breath, in milliseconds. Slow enough to read as alive, not as an alarm. */
const BEAT_MS = 1100;

/**
 * How many times it breathes before resting as a plain dot.
 *
 * ⚠️ FINITE, and measured rather than chosen. An endless loop cost the Play
 * promo tour TWENTY-THREE SECONDS — 148s to 171s for the identical flow, the
 * only difference being this animation — because Maestro waits for the UI to
 * settle after every command and a perpetual animation never settles.
 * `screenrecord` stops dead at 180s, and the tour had already been truncated
 * once that way, losing Speak, Tap and Learn entirely.
 *
 * It is the better design regardless: the dot has one job, which is to catch
 * the eye once. Something that pulses at you indefinitely has stopped being a
 * hint and become a nag.
 */
const BEATS = 6;

/**
 * A small pulsing dot that points at the text field.
 *
 * ⚠️ It replaced the input's AUTO-FOCUS. Focusing on open put the keyboard over
 * half the screen — the seeded sample was behind it — so the dot is what says
 * "start here" instead. A static dot was not enough to catch the eye on a
 * device, which is the whole job it was given.
 *
 * The halo pulses rather than the dot: growing the dot itself would shift the
 * label beside it on every beat, since both sit in the same flex row.
 *
 * ⚠️ `useNativeDriver` — on the JS thread it would compete with the driver
 * interval that switches the torch every few milliseconds.
 *
 * ⚠️ And it stops after {@link BEATS}. It used to run until the field was
 * touched, which cost the promo tour 23 seconds of Maestro settle time against
 * a 180-second recording ceiling.
 */
export function TypeHintDot({
  label,
  testID = 'type-hint-dot',
}: Readonly<{ label: string; testID?: string }>): React.JSX.Element {
  // ⚠️ Lazy `useState`, not `useRef(new Animated.Value(0)).current`. The value
  // must survive re-renders without being constructed on each one, and reading
  // a ref during render is what `react-hooks/refs` exists to stop.
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
        Animated.timing(beat, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      { iterations: BEATS },
    );
    loop.start();
    // ⚠️ Stopped on unmount. The hint disappears the moment the field is
    // touched, and a loop left running on a detached node keeps a native
    // animation alive for the rest of the session.
    return () => {
      loop.stop();
    };
  }, [beat]);

  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="image"
      style={styles.slot}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: beat.interpolate({
              inputRange: [0, 1],
              outputRange: [HALO_OPACITY, 0],
            }),
            transform: [
              { scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, HALO] }) },
            ],
          },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ⚠️ Lifted off the text baseline. Sitting centred against the label it read
  // as a bullet point belonging to the words; raised, it reads as a marker
  // pointing at the field below.
  //
  // ⚠️ THIS MATTERS MORE NOW THAT THE DOT LEADS THE ROW. Trailing the label it
  // could only ever have looked like punctuation; leading it, at 10pt, it is
  // sitting exactly where a bullet would. The lift is what keeps it a marker.
  slot: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -5 }],
  },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: theme.color.accent,
  },
  // Deliberately small and in the accent, not a red badge. It points at the
  // field; it is not reporting that anything is wrong.
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: theme.color.accent,
  },
});
