import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ICrashReportingPort, IVibrationPort, VibrationMark } from '@/core/ports';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Android's pattern form: a delay, then alternating buzz and silence.
 *
 * ⚠️ THE ANDROID SIDE OF THIS IS AT THE MERCY OF A SETTING THE APP CANNOT SEE.
 *
 * A Poco X5 5G felt nothing at all on the first build anyone ran, and the app
 * is not why. The pattern is well formed at every speed offered (a test pins
 * it), `android.permission.VIBRATE` is in the shipped APK (`aapt2 dump
 * permissions` says so), and the composition root wires the real adapter.
 *
 * What React Native does with the pattern is:
 *
 *     v.vibrate(VibrationEffect.createWaveform(patternLong, repeat))
 *
 * — the DEPRECATED single-argument overload, with no `VibrationAttributes`.
 * Nothing in the dependency tree sets them, expo-haptics included. A vibration
 * with no stated usage is `USAGE_UNKNOWN`, and the platform applies the user's
 * touch-feedback intensity to it: with haptic feedback turned down, the OS
 * drops it silently. Nothing in JS can raise that.
 *
 * If this needs to work regardless of that setting, it takes a native module
 * calling `vibrate(effect, VibrationAttributes)` with a usage the system does
 * not suppress. Switching to expo-haptics would not help — it has the same
 * gap, and canned effects cannot carry a dot and a dash apart anyway.
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
