/**
 * Drives the device torch. The riskiest hardware dependency here, so it is
 *  behind a port and mocked in every test.
 */
export interface ITorchPort {
  /** True when this device has a torch the app is allowed to drive. */
  isAvailable(): Promise<boolean>;
  /** Switches the torch on or off. */
  setEnabled(enabled: boolean): Promise<void>;
  /** Turns the torch off and releases the camera. Always safe to call twice. */
  release(): Promise<void>;
}
