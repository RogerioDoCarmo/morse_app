import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { SignalSurface } from '@/components/SignalSurface';
import type { MorseMessage } from '@/core/domain/morse';
import { signalAt, signalChanges, toTimeline, totalMs } from '@/core/domain/timeline';

/** How often the demo asks the timeline what the surface should be doing. */
const TICK_MS = 32;

/** A beat of dark between repeats, so two runs do not read as one. */
const REST_MS = 900;

/**
 * The Screen channel, flashing a real message, as an illustration.
 *
 * ⚠️ THIS EXISTS BECAUSE PROSE DID NOT WORK. A tester came back from 0.3.4
 * confused by the flashing circle — and the letter chips, which are explained
 * TWICE in words: once in the guide's third slide and again in the Morse
 * card's header. Both were on screen, both were missed. Another paragraph
 * would have been a third.
 *
 * So the guide shows it happening instead. It drives the app's own
 * `SignalSurface` from the app's own timeline, the same way the other slides
 * use real components rather than artwork — the guide cannot demonstrate
 * something playback does not do, because it is playback that it runs.
 *
 * ⚠️ It polls rather than queuing timers, exactly as the real driver does. A
 * poll that is late still lands on the right state; a backlog of timers fires
 * a burst of stale ones.
 */
export function SurfaceDemo({
  message,
  unitMs,
  testID = 'surface-demo',
}: Readonly<{
  message: MorseMessage;
  unitMs: number;
  testID?: string;
}>): React.JSX.Element {
  const [lit, setLit] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // ⚠️ Asked, not assumed. This flashes without anyone pressing anything,
  // which real playback never does — the user always starts that. Someone who
  // has told their phone to reduce motion has not opted into an animation
  // arriving on its own, so they get the surface at rest instead.
  useEffect(() => {
    let listening = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (listening) setReduceMotion(on);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      listening = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const timeline = toTimeline(message);
    const changes = signalChanges(timeline);
    const runMs = totalMs(timeline, unitMs);
    const cycleMs = runMs + REST_MS;
    const startedAt = Date.now();

    const timer = setInterval(() => {
      const intoCycle = (Date.now() - startedAt) % cycleMs;
      // Past the message, inside the rest: dark, whatever the timeline says.
      setLit(intoCycle < runMs && signalAt(changes, intoCycle / unitMs));
    }, TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [message, unitMs, reduceMotion]);

  return (
    <View testID={testID}>
      {/* ⚠️ Derived, not stored. Writing `false` into state from the effect
          that reads `reduceMotion` is a synchronous setState inside an
          effect, which cascades a render for a value already known here. */}
      <SignalSurface lit={!reduceMotion && lit} testID={`${testID}-surface`} />
    </View>
  );
}
