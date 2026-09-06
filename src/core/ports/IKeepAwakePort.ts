/**
 * Holds the screen awake. Output only — needs no permission.
 *
 * A message is minutes long at slow speeds, and the phone's own idle timer
 * knows nothing about it: it sees no touches and dims, which stops the screen
 * channel dead and, on some devices, the torch with it.
 */
export interface IKeepAwakePort {
  /** Holds the screen on. Safe to call when it is already held. */
  activate(): Promise<void>;
  /** Lets it sleep again. Safe to call when nothing is held. */
  release(): Promise<void>;
}
