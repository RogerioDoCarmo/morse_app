import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ICrashReportingPort, IVibrationPort, VibrationMark } from '@/core/ports';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Android's pattern form: a delay, then alternating buzz and silence.
 *
 * Built from the gaps between marks rather than from the timeline's silences,
 * so it stays correct for a set of marks that starts part-way through a
 * message — which is what joining a run in progress produces.
 */
export function toAndroidPattern(marks: readonly VibrationMark[]): number[] {
  const pattern: number[] = [];
  let cursor = 0;

  marks.forEach((mark) => {
    pattern.push(Math.max(0, mark.atMs - cursor));
    pattern.push(mark.durationMs);
    cursor = mark.atMs + mark.durationMs;
  });

  return pattern;
}

/**
 * Vibrates the message, as well as each platform allows.
 *
 * Android gets the real thing: the marks, at their real lengths, handed to the
 * OS in one call so the rhythm does not depend on this app's timers.
 *
 * iOS cannot vary the length of a vibration — React Native's own
 * implementation fires a fixed 400ms buzz and uses the pattern only as delays
 * between them, which would make a 120ms dot indistinguishable from a 360ms
 * dash and drag the whole run out of step. So iOS fires a haptic pulse at each
 * mark's start instead, heavy for a dash and light for a dot. The rhythm is
 * exact; the duration information has moved into intensity.
 */
export function createPlatformVibrationAdapter(
  crash: ICrashReportingPort,
): IVibrationPort {
  /** iOS only: one timer per mark, so a stop can cancel what has not fired. */
  let pulses: ReturnType<typeof setTimeout>[] = [];

  const clearPulses = (): void => {
    pulses.forEach((pulse) => {
      clearTimeout(pulse);
    });
    pulses = [];
  };

  return {
    play(marks) {
      clearPulses();
      if (marks.length === 0) return Promise.resolve();

      try {
        if (Platform.OS === 'android') {
          Vibration.vibrate(toAndroidPattern(marks), false);
          return Promise.resolve();
        }

        pulses = marks.map((mark) =>
          setTimeout(() => {
            void Haptics.impactAsync(
              mark.long
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Light,
            ).catch(() => undefined);
          }, mark.atMs),
        );
      } catch (error) {
        // A message that will not play because the motor refused is worse than
        // one that plays without it.
        return crash.recordError(asError(error), 'vibration: could not start');
      }

      return Promise.resolve();
    },

    stop() {
      clearPulses();
      try {
        Vibration.cancel();
      } catch (error) {
        return crash.recordError(asError(error), 'vibration: could not stop');
      }
      return Promise.resolve();
    },
  };
}
