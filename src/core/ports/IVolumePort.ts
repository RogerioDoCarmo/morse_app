/**
 * Reads how loud the device is set to play media.
 *
 * Read-only on purpose. Turning a user's volume up for them is not the app's
 * business — the point is to say why they cannot hear anything, not to take
 * the decision away.
 */
export interface IVolumePort {
  /**
   * The media output level, 0 to 1, or `null` when it cannot be read.
   *
   * `null` is a real answer rather than a failure: a build without the native
   * module, a platform that refused, or a device that reports nothing. The
   * domain treats it as "say nothing" — see `isLowVolume`.
   */
  level(): Promise<number | null>;
}
