import { requireOptionalNativeModule } from 'expo';
import type { ICrashReportingPort, IVolumePort } from '@/core/ports';

/**
 * `modules/morse-volume` — the local module, on both platforms.
 *
 * `getOutputLevel` answers 0 to 1, or null where the device would not say.
 * Android divides notches by the maximum before it gets here; iOS reports a
 * fraction already.
 */
type MorseVolume = Readonly<{ getOutputLevel: () => number | null }>;

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
 * Reports how loud the device is set to play media.
 *
 * ⚠️ NOT the playback volume. `expo-audio` exposes a `volume` on the player,
 * which is a multiplier the app itself sets — it reads 1.0 on a phone muted to
 * silence, because the player is playing at full strength into nothing. The
 * only thing that answers the question a user is actually asking is the
 * DEVICE's level, and nothing in Expo exposes it.
 *
 * Every failure answers null rather than a number. A warning shown on a guess
 * would fire on every build without the module — which is every build before
 * this one — and telling someone their volume is low when it is not is a
 * worse bug than staying quiet.
 */
export function createNativeVolumeAdapter(crash: ICrashReportingPort): IVolumePort {
  return {
    async level() {
      try {
        const reading = morseVolume()?.getOutputLevel();
        if (typeof reading !== 'number' || !Number.isFinite(reading)) return null;
        // A device that reports outside the range has told us something is
        // wrong with the reading, not that the volume is at an unusual place.
        return Math.min(1, Math.max(0, reading));
      } catch (error) {
        await crash.recordError(asError(error), 'volume: could not read the level');
        return null;
      }
    },
  };
}
