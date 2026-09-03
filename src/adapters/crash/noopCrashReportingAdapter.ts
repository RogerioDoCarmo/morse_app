import type { ICrashReportingPort } from '@/core/ports';

/**
 * A crash reporter that reports nothing.
 *
 * Used when Firebase is not configured — local development, CI, tests, and any
 * build that must ship without a proprietary dependency. The app must behave
 * identically either way, so every method resolves quietly rather than throwing
 * or warning.
 */
export function createNoopCrashReportingAdapter(): ICrashReportingPort {
  return {
    isEnabled: () => false,
    setEnabled: async () => undefined,
    recordError: async () => undefined,
    log: async () => undefined,
  };
}
