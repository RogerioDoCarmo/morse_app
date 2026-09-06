import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { theme } from '@/theme';

/**
 * The largest the disc may be, and the reason there is a cap at all.
 *
 * ⚠️ This is a SAFETY constraint, not a layout preference. Morse flashes at
 * 4.2Hz at 10 words per minute and 6.3Hz at 15 — both far past WCAG 2.3.1's
 * limit of three flashes per second. What is left is the area exemption: a
 * flashing region under 25% of the visual field. A 240pt disc is 13.7% of a
 * 390×844 screen — a circle covers π/4 of its bounding box, so this is
 * comfortably under the limit even before it shrinks to fit.
 *
 * Full screen would be far more legible across a room. It is not available.
 * Anything larger needs a photosensitivity warning ahead of it, and a way to
 * decline.
 *
 * It is a MAXIMUM, not a size. The disc is measured against the space it is
 * given and takes the smaller of the two, because one that overflows its card
 * is clipped by it — which is worse than a smaller one, and was exactly the
 * bug this cap caused when it was applied as a fixed size.
 */
export const SURFACE_SIZE = 240;

type Props = Readonly<{
  /** True while the signal is on. */
  lit: boolean;
  testID?: string;
}>;

/**
 * A disc that carries the message as light and dark.
 *
 * Near-black rather than pure black, and the app's own white: this sits inside
 * a card, and pure black against a soft white ground reads as a hole rather
 * than as a surface.
 */
export function SignalSurface({
  lit,
  testID = 'signal-surface',
}: Props): React.JSX.Element {
  const [side, setSide] = useState(SURFACE_SIZE);

  const measure = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    const fits = Math.floor(Math.min(SURFACE_SIZE, width, height));
    if (fits > 0 && fits !== side) setSide(fits);
  };

  return (
    <View style={styles.stage} onLayout={measure}>
      <View
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={testID}
        accessibilityState={{ selected: lit }}
        // Measured, not decorative: the square is only ever as big as the room
        // it was given, so it cannot be clipped by the card around it.
        style={[
          styles.surface,
          { width: side, height: side, borderRadius: side / 2 },
          lit ? styles.lit : styles.dark,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // minHeight 0 lets this shrink inside a flex parent instead of forcing the
  // card taller than the space it has.
  stage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Clear of the label row above it, which sits close in a full card.
    paddingTop: theme.spacing.lg,
  },
  surface: {},
  lit: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dark: { backgroundColor: theme.color.ink },
});
