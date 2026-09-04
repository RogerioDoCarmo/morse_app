import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';

/**
 * The side of a 240pt square, and the reason it is not larger.
 *
 * ⚠️ This is a SAFETY constraint, not a layout preference. Morse flashes at
 * 4.2Hz at 10 words per minute and 6.3Hz at 15 — both far past WCAG 2.3.1's
 * limit of three flashes per second. What is left is the area exemption: a
 * flashing region under 25% of the visual field. 240×240 is 17.5% of a
 * 390×844 screen, and 12.2% of a tablet's.
 *
 * Full screen would be far more legible across a room. It is not available.
 * Anything larger needs a photosensitivity warning ahead of it, and a way to
 * decline.
 */
export const SURFACE_SIZE = 240;

type Props = Readonly<{
  /** True while the signal is on. */
  lit: boolean;
  testID?: string;
}>;

/**
 * A square that carries the message as light and dark.
 *
 * Near-black rather than pure black, and the app's own white: this sits inside
 * a card, and pure black against a soft white ground reads as a hole rather
 * than as a surface.
 */
export function SignalSurface({
  lit,
  testID = 'signal-surface',
}: Props): React.JSX.Element {
  return (
    <View style={styles.stage}>
      <View
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={testID}
        accessibilityState={{ selected: lit }}
        style={[styles.surface, lit ? styles.lit : styles.dark]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surface: {
    width: SURFACE_SIZE,
    height: SURFACE_SIZE,
    borderRadius: 28,
  },
  lit: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dark: { backgroundColor: theme.color.ink },
});
