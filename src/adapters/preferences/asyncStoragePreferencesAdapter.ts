import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ICrashReportingPort, IPreferencesPort } from '@/core/ports';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Stores small values in AsyncStorage.
 *
 * A read that fails answers null — the same as never having stored anything.
 * Every caller already has to handle that case, so a failure degrades into
 * one they know rather than an exception they do not.
 */
export function createAsyncStoragePreferencesAdapter(
  crash: ICrashReportingPort,
): IPreferencesPort {
  return {
    async read(key) {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        await crash.recordError(asError(error), `preferences: could not read ${key}`);
        return null;
      }
    },
    async write(key, value) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        // Worth reporting: a write that silently fails makes a one-time screen
        // show every launch, which looks broken rather than merely unlucky.
        await crash.recordError(asError(error), `preferences: could not write ${key}`);
      }
    },
  };
}
