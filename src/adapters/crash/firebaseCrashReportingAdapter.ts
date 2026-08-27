import {
  getCrashlytics,
  log,
  recordError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import type { ICrashReportingPort } from '@/core/ports';

/**
 * Crashlytics, behind {@link ICrashReportingPort}.
 *
 * Every call is wrapped: a reporting failure must never become the crash it was
 * meant to record. The native module is absent whenever `google-services.json`
 * or `GoogleService-Info.plist` is missing, which is the normal state in a
 * local checkout, so construction has to tolerate that rather than assume it.
 */
export function createFirebaseCrashReportingAdapter(): ICrashReportingPort {
  const crashlytics = (): ReturnType<typeof getCrashlytics> | null => {
    try {
      return getCrashlytics();
    } catch {
      return null;
    }
  };

  // Awaits inside the try so a REJECTED promise is caught too, not just a
  // synchronous throw. A floating promise here would surface as an unhandled
  // rejection — reporting a crash by causing one.
  const quietly = async (run: () => void | Promise<unknown>): Promise<void> => {
    try {
      await run();
    } catch {
      // Swallowed on purpose — see the note above.
    }
  };

  return {
    isEnabled: () => crashlytics() !== null,

    setEnabled: async (enabled: boolean) =>
      quietly(async () => {
        const instance = crashlytics();
        if (instance) await setCrashlyticsCollectionEnabled(instance, enabled);
      }),

    recordError: async (error: Error, context?: string) =>
      quietly(() => {
        const instance = crashlytics();
        if (!instance) return;
        // log() and recordError() are synchronous in the modular API; only
        // setCrashlyticsCollectionEnabled returns a promise.
        if (context !== undefined) log(instance, context);
        recordError(instance, error);
      }),

    log: async (message: string) =>
      quietly(() => {
        const instance = crashlytics();
        if (instance) log(instance, message);
      }),
  };
}
