import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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
 * How much of the border the travelling mark covers, as a fraction.
 *
 * Short enough to read as a mark rather than a filling bar, long enough to see
 * at a glance on a chip barely wider than three dots.
 */
const SEGMENT = 0.17;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * A stationary chip border with one lit mark travelling around it.
 *
 * Used ONLY by the first-run guide's letter slide. In the app proper the chips
 * wear {@link TapHalo}, which breathes four times — a nudge, not a summons.
 * This is the summons, and it is confined to the one screen whose whole job is
 * teaching that the chips can be pressed.
 *
 * ⚠️ THE BORDER ITSELF MUST NOT MOVE, and it used to. The first version rotated
 * the whole ring `View` 360°, colouring one border side lighter so the lighter
 * side appeared to travel. On a SQUARE that reads correctly; a chip is a wide
 * rounded rectangle, so rotating it swept the whole shape around and the border
 * visibly turned. Reported from a device as "the border moves".
 *
 * ⚠️ AND IT LEAVES NO TRAIL, deliberately. A mark that fills the border behind
 * it reads as PROGRESS — something to wait for — which is the opposite of what
 * this asks for. The slide exists because a tester never pressed a chip; an
 * indicator that looks like loading invites more waiting, not a press.
 *
 * ⚠️ ABSOLUTE, for the reason TapHalo records: a chip sits in a wrapping row,
 * and anything occupying space would move its neighbours on every frame and
 * re-wrap the row on a narrow screen.
 */
export function ChipProgressRing({
  testID = 'chip-progress-ring',
}: Readonly<{ testID?: string }>): React.JSX.Element {
  // Lazy `useState` rather than a ref read during render — see TypeHintDot.
  const [travel] = useState(() => new Animated.Value(0));
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (size === null) return;
    const turn = Animated.timing(travel, {
      toValue: 1,
      duration: REVOLUTION_MS,
      easing: Easing.linear,
      // ⚠️ NOT the native driver. `strokeDashoffset` is an SVG attribute, not a
      // transform or an opacity, and the native driver animates only those. The
      // old rotation could use it; the cost of a border that stays still is that
      // this one is driven from JS.
      useNativeDriver: false,
    });
    const animation = Animated.loop(turn, { iterations: REVOLUTIONS });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [travel, size]);

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current !== null && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  };

  // ⚠️ MEASURED, not assumed. Dash lengths are absolute in SVG user units, so
  // the perimeter has to be known before a segment can be a fraction of it —
  // and a chip's width depends on its letter and on the device's text size.
  const inset = BORDER_WIDTH / 2;
  const width = Math.max(0, (size?.width ?? 0) - BORDER_WIDTH);
  const height = Math.max(0, (size?.height ?? 0) - BORDER_WIDTH);
  const radius = Math.min(theme.radius.chip, width / 2, height / 2);
  // A rounded rectangle's perimeter: the straight runs, plus one whole circle
  // assembled from the four corner quarters.
  const perimeter =
    2 * Math.max(0, width - 2 * radius) +
    2 * Math.max(0, height - 2 * radius) +
    2 * Math.PI * radius;
  const lit = perimeter * SEGMENT;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.ring}
      onLayout={onLayout}
    >
      {size !== null && perimeter > 0 && (
        <Svg width="100%" height="100%">
          {/* The track. It never moves. */}
          <Rect
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={radius}
            fill="none"
            stroke={theme.color.accent}
            strokeWidth={BORDER_WIDTH}
          />
          {/* The one lit mark, travelling. */}
          <AnimatedRect
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={radius}
            fill="none"
            stroke={theme.color.onInk}
            strokeWidth={BORDER_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${String(lit)} ${String(perimeter - lit)}`}
            strokeDashoffset={travel.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -perimeter],
            })}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { ...StyleSheet.absoluteFill },
});
