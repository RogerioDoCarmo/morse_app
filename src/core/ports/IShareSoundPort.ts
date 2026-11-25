/**
 * Hands a rendered Morse message to the system share sheet as a sound file.
 *
 * Takes bytes rather than a message, as {@link IAudioPlaybackPort} does: what
 * the sound IS stays in the domain (`renderWav`), and the adapter only moves
 * it to whichever app the user picks.
 *
 * Nothing leaves the device unless the user picks a destination in the sheet.
 */
export interface IShareSoundPort {
  /**
   * Offers `wav` to the share sheet under `title`.
   *
   * - `'shared'`: the sheet opened and closed. Neither platform says whether
   *   the user went on to send it, so this is not proof of delivery.
   * - `'unavailable'`: this device has no way to share a file.
   * - `'failed'`: the file could not be written or the sheet would not open.
   *
   * Never rejects: the screen's answer to every failure is the same message,
   * and a share is not worth crashing a translator over.
   */
  share(wav: Uint8Array, title: string): Promise<ShareSoundResult>;
}

/** How a share ended. See {@link IShareSoundPort.share}. */
export type ShareSoundResult = 'shared' | 'unavailable' | 'failed';
