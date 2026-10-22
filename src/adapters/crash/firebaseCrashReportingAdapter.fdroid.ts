import type { ICrashReportingPort } from '@/core/ports';
import { createNoopCrashReportingAdapter } from './noopCrashReportingAdapter';

/**
 * The F-Droid bundle's stand-in for the Crashlytics adapter.
 *
 * Metro picks this file over `firebaseCrashReportingAdapter.ts` only when the
 * F-Droid variant is bundled (see `build-variant.js`). That build has no
 * crash reporting, `createPorts` never constructs this, and Firebase is not
 * installed — but without this twin the real adapter's code would still be
 * compiled into the bundle, naming an SDK the APK does not contain.
 */
export function createFirebaseCrashReportingAdapter(): ICrashReportingPort {
  return createNoopCrashReportingAdapter();
}
