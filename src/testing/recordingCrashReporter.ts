import type { ICrashReportingPort } from '@/core/ports';

export type RecordedReport = Readonly<{ message: string; context?: string }>;

export type RecordingCrashReporter = ICrashReportingPort &
  Readonly<{ reports: RecordedReport[] }>;

/**
 * A crash reporter that remembers what it was told.
 *
 * Lets an adapter's error handling be asserted without Firebase anywhere near
 * the test — which is the point of the port: the adapter depends on the
 * interface, so a test can satisfy it with twenty lines.
 */
export function createRecordingCrashReporter(): RecordingCrashReporter {
  const reports: RecordedReport[] = [];
  return {
    reports,
    isEnabled: () => true,
    setEnabled: async () => undefined,
    recordError: async (error, context) => {
      reports.push(
        context === undefined
          ? { message: error.message }
          : { message: error.message, context },
      );
    },
    log: async (message) => {
      reports.push({ message });
    },
  };
}
