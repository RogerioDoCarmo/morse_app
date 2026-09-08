/**
 * Drives the device torch. The riskiest hardware dependency here, so it is
 *  behind a port and mocked in every test.
 */
export interface ITorchPort {
  /** True when this device has a torch the app is allowed to drive. */
  isAvailable(): Promise<boolean>;
  /**
   * Holds the camera open without lighting anything, and lets it go again.
   *
   * ⚠️ Not a nicety. The torch is a camera-view PROP, so switching it means a
   * camera has to be open already — and opening one takes longer than a dot.
   * Mounting a camera per mark made the torch miss most of them and flashed a
   * black rectangle across half the display on every mount, which is what a
   * Poco X5 5G reported twice. Hold the camera for the whole run, switch the
   * prop inside it.
   */
  setActive(active: boolean): Promise<void>;
  /** Switches the torch on or off. */
  setEnabled(enabled: boolean): Promise<void>;
  /** Turns the torch off and drops the camera. Always safe to call twice. */
  release(): Promise<void>;
}
