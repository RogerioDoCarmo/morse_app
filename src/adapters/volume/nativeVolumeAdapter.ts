import { requireOptionalNativeModule } from 'expo';
import type { ICrashReportingPort, IVolumePort } from '@/core/ports';

/**
 * `modules/morse-volume` — the local module, on both platforms.
 *
 * ⚠️ TWO ANSWER SHAPES, and both have to be read. The module used to return a
 * bare number (or null) and now returns `{ level, stale }`. An `expo-updates`
 * bundle reaches binaries it was not built with, so this JS can land on a
 * phone whose native side is the older one — and a reader that only understood
 * the new shape would quietly report "cannot tell" on every one of them, which
 * is exactly the failure the `stale` field was added to expose.
 *
 * `level` is 0 to 1, or null where the device would not say. Android divides
 * notches by the maximum before it gets here; iOS reports a fraction already.
 * `stale` means the reading may predate the user's last volume change — see
 * the iOS module.
 */
type Reading = Readonly<{ level: number | null; stale: boolean }>;
type NativeAnswer = number | null | undefined | Partial<Reading>;
type MorseVolume = Readonly<{ getOutputLevel: () => NativeAnswer }>;

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Looked up per call rather than once at import — a map lookup, and it keeps
 * this file free of module-load state a test would have to reset.
 */
const morseVolume = (): MorseVolume | null =>
  requireOptionalNativeModule<MorseVolume>('MorseVolume');

/**
 * Both shapes, as one.
 *
 * An older binary's bare number cannot be stale: that build activated the
 * session or returned nothing at all, so a number from it is a live reading.
 */
function readingOf(answer: NativeAnswer): Reading {
  if (typeof answer === 'number') return { level: answer, stale: false };
  if (answer === null || answer === undefined) return { level: null, stale: false };
  return { level: answer.level ?? null, stale: answer.stale === true };
}

/** A device that reports outside 0–1 has told us the reading is wrong. */
const clamp = (level: number): number => Math.min(1, Math.max(0, level));

/**
 * Reports how loud the device is set to play media.
 *
 * ⚠️ NOT the playback volume. `expo-audio` exposes a `volume` on the player,
 * which is a multiplier the app itself sets — it reads 1.0 on a phone muted to
 * silence, because the player is playing at full strength into nothing. The
 * only thing that answers the question a user is actually asking is the
 * DEVICE's level, and nothing in Expo exposes it.
 *
 * A failure still answers null rather than a number. A warning shown on a
 * guess would fire on every build without the module — which is every build
 * before 0.3.3 — and telling someone their volume is low when it is not is a
 * worse bug than staying quiet.
 */
export function createNativeVolumeAdapter(crash: ICrashReportingPort): IVolumePort {
  return {
    async level() {
      try {
        const { level, stale } = readingOf(morseVolume()?.getOutputLevel());

        // ⚠️ Reported, and the reading is used anyway. A tester saw no volume
        // warning at all on 0.3.4 (13), and a session this app could not
        // activate was one of the two candidate explanations — this is the
        // breadcrumb that tells the next round whether it was.
        if (stale) {
          await crash.recordError(
            new Error('volume: the audio session would not activate'),
            'volume: the level may predate the last change',
          );
        }

        if (typeof level !== 'number' || !Number.isFinite(level)) return null;
        return clamp(level);
      } catch (error) {
        await crash.recordError(asError(error), 'volume: could not read the level');
        return null;
      }
    },
  };
}
