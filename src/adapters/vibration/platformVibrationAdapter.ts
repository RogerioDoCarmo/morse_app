import { Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import type { ICrashReportingPort, IVibrationPort, VibrationMark } from '@/core/ports';

/**
 * `modules/morse-vibration` — the local Android module, and the only caller in
 * this tree that tells the platform what the vibration is FOR.
 *
 * `vibratePattern` answers whether it managed anything, so a device with no
 * motor and a build without the module are told apart from a vibration that
 * played.
 */
type MorseVibration = Readonly<{
  vibratePattern: (pattern: readonly number[]) => boolean;
  cancelVibration: () => void;
}>;

/**
 * Looked up per call rather than once at import.
 *
 * It costs a map lookup, it is only reached on Android, and it keeps this file
 * free of module-load state that a test would have to reset.
 */
const morseVibration = (): MorseVibration | null =>
  requireOptionalNativeModule<MorseVibration>('MorseVibration');

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Android's pattern form: a delay, then alternating buzz and silence.
 *
 * ⚠️ THE PATTERN WAS NEVER THE PROBLEM, AND THREE BUILDS WERE SPENT FINDING
 * THAT OUT.
 *
 * A Poco X5 5G felt nothing at all while the same code buzzed on an iPhone.
 * The pattern is well formed at every speed offered (a test pins it),
 * `android.permission.VIBRATE` is in the shipped APK (`aapt2 dump permissions`
 * says so), and the composition root wires the real adapter.
 *
 * What React Native does with the pattern is:
 *
 *     v.vibrate(VibrationEffect.createWaveform(patternLong, repeat))
 *
 * — the single-argument overload, with no `VibrationAttributes`. Nothing in
 * the dependency tree sets them, expo-haptics included. A vibration with no
 * stated usage is `USAGE_UNKNOWN`, and the platform applies the user's
 * TOUCH-FEEDBACK intensity to it: turned down, the OS drops it silently.
 *
 * So `modules/morse-vibration` says the usage out loud — `USAGE_ALARM`, which
 * is what a message the user asked to be sent actually is — and this adapter
 * prefers it, falling back to `Vibration` where the module is not linked.
 * Switching to expo-haptics instead would not have helped: it has the same
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
          const pattern = toAndroidPattern(marks);
          // The local module first, because it states a usage the platform
          // will not silently scale away. React Native's own Vibration is the
          // fallback for a build without it — it plays on a phone whose touch
          // feedback is turned up, which is most of them.
          if (morseVibration()?.vibratePattern(pattern) !== true) {
            Vibration.vibrate(pattern, false);
          }
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
        // Both, and unconditionally: whichever one started the run, this has
        // to end it, and neither minds being asked to cancel nothing.
        if (Platform.OS === 'android') morseVibration()?.cancelVibration();
        Vibration.cancel();
      } catch (error) {
        return crash.recordError(asError(error), 'vibration: could not stop');
      }
      return Promise.resolve();
    },
  };
}
