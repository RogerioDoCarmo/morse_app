import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { theme } from '@/theme';

/** One expand-and-fade, in milliseconds. A resting heartbeat, roughly. */
const PULSE_MS = 1400;

/**
 * How many pulses before it rests.
 *
 * ⚠️ FINITE, for the reason {@link ChipProgressRing} records at length: Maestro
 * waits for the UI to settle after every command, and FOUR flows press this
 * button — `speech.yaml`, `permissions.yaml`, `video/tab-speak.yaml` and
 * `video/tour.yaml`. An endless animation already cost the Play promo tour
 * TWENTY-THREE SECONDS against a 180-second `screenrecord` ceiling once.
 *
 * 30 pulses is 42 seconds, which is longer than anyone dictates a message into
 * a Morse app, so in practice it is still pulsing when they stop. It just does
 * not pulse forever if the screen is left open.
 */
const PULSES = 30;

/** How far the ring grows. Beyond the button, not so far it leaves the stage. */
const GROWTH = 1.6;

/**
 * A ring that expands and fades from behind the microphone while it listens.
 *
 * ⚠️ THE SCREEN HAD NOTHING THAT MOVED. The level bars are fixed heights — the
 * file says so, deliberately, because a meter that pretends to read the
 * microphone is an animation pretending to be data. The result was that a
 * listening phone looked exactly like an idle one apart from a colour change,
 * and "is it recording?" is the one question this screen has to answer.
 *
 * This answers it without claiming to measure anything: it says LISTENING, not
 * "this is how loud you are".
 *
 * ⚠️ ABSOLUTE and behind the button, so it cannot move the layout. A ring that
 * occupied space would push the status text down on every frame.
 */
export function MicPulse({
  active,
  testID = 'mic-pulse',
}: Readonly<{ active: boolean; testID?: string }>): React.JSX.Element | null {
  // Lazy `useState` rather than a ref read during render — see TypeHintDot.
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) {
      beat.setValue(0);
      return;
    }
    const pulse = Animated.timing(beat, {
      toValue: 1,
      duration: PULSE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    const animation = Animated.loop(pulse, { iterations: PULSES });
    animation.start();
    return () => {
      animation.stop();
      beat.setValue(0);
    };
  }, [active, beat]);

  if (!active) return null;

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.pulse,
        {
          opacity: beat.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [
            { scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, GROWTH] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pulse: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: theme.color.accent,
  },
});
