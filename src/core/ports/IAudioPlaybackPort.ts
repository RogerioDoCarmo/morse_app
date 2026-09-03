/**
 * Plays a rendered Morse message as sound. Output only — needs no permission.
 *
 * Takes bytes rather than a message or a timeline, so the decision of what the
 * audio should sound like stays in the domain (`renderWav`) and the adapter
 * only moves them to a speaker.
 */
export interface IAudioPlaybackPort {
  /** Plays `wav`. Resolves when playback finishes or is stopped. */
  play(wav: Uint8Array): Promise<void>;
  /** Stops immediately. Safe to call when nothing is playing. */
  stop(): Promise<void>;
}
