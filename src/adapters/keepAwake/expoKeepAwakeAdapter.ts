import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { ICrashReportingPort, IKeepAwakePort } from '@/core/ports';

/**
 * Tag for this app's hold, so releasing ours cannot release someone else's.
 * expo-keep-awake reference-counts by tag.
 */
const TAG = 'morse-playback';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Keeps the screen awake through expo-keep-awake.
 *
 * Failures are reported and swallowed. A message that plays while the screen
 * dims is a poor experience; a message that refuses to play because the screen
 * could not be held awake is a worse one.
 */
export function createExpoKeepAwakeAdapter(crash: ICrashReportingPort): IKeepAwakePort {
  return {
    async activate() {
      try {
        await activateKeepAwakeAsync(TAG);
      } catch (error) {
        await crash.recordError(asError(error), 'keepAwake: could not hold the screen');
      }
    },
    async release() {
      try {
        await deactivateKeepAwake(TAG);
      } catch (error) {
        // Worth reporting: a hold that will not release drains the battery
        // until the app is killed.
        await crash.recordError(asError(error), 'keepAwake: could not release');
      }
    },
  };
}
