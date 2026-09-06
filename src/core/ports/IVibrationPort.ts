/** One mark to be felt: when it starts, how long it is, and which it is. */
export type VibrationMark = Readonly<{
  atMs: number;
  durationMs: number;
  /** True for a dash. */
  long: boolean;
}>;

/**
 * Carries a message as vibration. Output only — needs no permission.
 *
 * ⚠️ The two platforms cannot do the same thing here, and the port is shaped
 * to let each do its best rather than to pretend otherwise. Android reproduces
 * the marks exactly, by duration. iOS cannot vary the length of a vibration at
 * all, so it fires a pulse at each mark's START and carries the dot/dash
 * difference in intensity instead — the rhythm is right, the durations are
 * not. `long` is on the mark for exactly that reason.
 */
export interface IVibrationPort {
  /** Plays the marks. Resolves when playback has been started, not finished. */
  play(marks: readonly VibrationMark[]): Promise<void>;
  /** Stops immediately. Safe to call when nothing is running. */
  stop(): Promise<void>;
}
