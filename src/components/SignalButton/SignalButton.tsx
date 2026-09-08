import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '@/components/Icon';
import { theme } from '@/theme';

type Props = Readonly<{
  /** True while a message is going out. */
  playing: boolean;
  /** False when there is nothing to send, or nothing to send it on. */
  canPlay: boolean;
  onPress: () => void;
  /** "Emit" when at rest, "Stop" while running. */
  label: string;
}>;

/**
 * The control that puts a message out, on whichever channels are switched on.
 *
 * Lifted out of the Translator when Speak and Tap needed it too: a tester on
 * TestFlight went looking for a way to feel a transcript as vibration and
 * found nothing there. Three copies of this would have been three chances for
 * one of them to drift.
 *
 * `signal-button` is the testID on every screen that shows one, which is safe
 * because only one screen is ever mounted — and it means the flows read the
 * same on all three.
 */
export function SignalButton({
  playing,
  canPlay,
  onPress,
  label,
}: Props): React.JSX.Element {
  const blocked = !playing && !canPlay;

  return (
    <Pressable
      testID="signal-button"
      accessibilityRole="button"
      accessibilityLabel="signal-button"
      accessibilityState={{ selected: playing, disabled: blocked }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.signal,
        playing && styles.playing,
        blocked && styles.blocked,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={playing ? 'stop' : 'play'}
        size={17}
        color={blocked ? theme.color.faint : theme.color.onInk}
      />
      <Text style={[styles.label, blocked && styles.labelBlocked]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  signal: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.color.ink,
  },
  playing: { backgroundColor: theme.color.accent },
  // Nothing switched on: there is nothing for it to drive, and saying so is
  // better than animating a progress bar over silence.
  blocked: { backgroundColor: theme.color.track },
  pressed: { opacity: 0.85 },
  label: { ...theme.type.action, color: theme.color.onInk },
  labelBlocked: { color: theme.color.faint },
});
