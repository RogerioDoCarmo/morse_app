/**
 * Reports crashes and non-fatal errors.
 *
 * Behind a port for the usual reason — nothing above `adapters/` may import a
 * vendor SDK — and for one specific to this app: crash reporting is the FIRST
 * thing here that sends anything off the device, so it must be trivially
 * possible to swap in an implementation that sends nothing at all. That is what
 * a no-op build (and F-Droid, if it is ever targeted) needs.
 */
export interface ICrashReportingPort {
  /** True when a real backend is wired up and collection is permitted. */
  isEnabled(): boolean;
  /**
   * Turns collection on or off for good. Takes effect on the next launch for
   * the underlying SDK, so treat it as a preference rather than a switch.
   */
  setEnabled(enabled: boolean): Promise<void>;
  /** Records a handled error. Never throws — reporting must not cause a crash. */
  recordError(error: Error, context?: string): Promise<void>;
  /** Leaves a breadcrumb on the next report. */
  log(message: string): Promise<void>;
}
