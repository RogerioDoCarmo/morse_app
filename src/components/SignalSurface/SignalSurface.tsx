import React, { useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
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

/**
 * The largest disc that keeps the flashing area inside the area exemption on
 * THIS screen, in points.
 *
 * A circle covers π/4 of its bounding box, so a disc of diameter `d` flashes
 * π/4·d² — a quarter of a `width x height` screen exactly when
 * `d = sqrt(width * height / π)`.
 *
 * ⚠️ This became load-bearing the day the card stopped being able to squeeze
 * the disc. The stage used to be handed whatever height was left over, so a
 * cramped screen produced a small disc by accident; it now has a floor, and on
 * a 320x480 display SURFACE_SIZE alone would put the disc at 29% of the
 * screen — past the very limit the cap above exists to stay inside. On a
 * 390x844 phone this yields 323, so SURFACE_SIZE still binds and nothing
 * about a normal phone changes.
 */
export function largestSafeDiameter(width: number, height: number): number {
  return Math.floor(Math.sqrt((width * height) / Math.PI));
}

type Props = Readonly<{
  /** True while the signal is on. */
  lit: boolean;
  testID?: string;
}>;

/**
 * The least room the stage will insist on.
 *
 * Enough that the disc is still recognisably a disc, small enough that a
 * progress row appearing below it can take the space it needs.
 */
const MIN_STAGE = 96;

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
  const screen = useWindowDimensions();
  const cap = Math.min(SURFACE_SIZE, largestSafeDiameter(screen.width, screen.height));
  const [side, setSide] = useState(cap);

  const measure = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    const fits = Math.floor(Math.min(cap, width, height));
    if (fits > 0 && fits !== side) setSide(fits);
  };

  return (
    // ⚠️ The floor is a FLOOR, not the ideal size.
    //
    // It was `minHeight: cap` — the diameter the disc would like — so the
    // stage refused to shrink when the progress bar and clock appeared beneath
    // it during playback, and the disc spilled under them. It looked like the
    // clock was drawn on top of the circle; the stage was overflowing its
    // room. "Sometimes" was the giveaway: that row only exists while playing.
    //
    // A small floor still does the job it was added for — `flex: 1` in a
    // container whose height is its content resolves to zero, and a
    // zero-height stage takes the disc out of the view hierarchy — without
    // claiming space the screen does not have.
    <View
      testID={`${testID}-stage`}
      style={[styles.stage, { minHeight: Math.min(cap, MIN_STAGE) }]}
      onLayout={measure}
    >
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
  // `minHeight` is applied inline, from the screen's own safe cap.
  stage: {
    flex: 1,
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
