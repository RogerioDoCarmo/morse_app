/**
 * Permission state, modelled so illegal states cannot be represented.
 *
 * `null` means "not known yet" — the status is still being read. Anything
 * non-null is a definite answer, and `canAskAgain` is always present, so a
 * screen can never forget to handle the blocked case.
 */
export type PermissionState =
  | null
  | Readonly<{ granted: true; canAskAgain: boolean }>
  | Readonly<{ granted: false; canAskAgain: boolean }>;

/** The two permissions this app can ask for. Nothing else is ever requested. */
export type PermissionKind = 'camera' | 'microphone';

/** True when the app may show its own rationale and then prompt the OS. */
export const canPrompt = (state: PermissionState): boolean =>
  state !== null && !state.granted && state.canAskAgain;

/** True when only the system settings screen can change the answer. */
export const isBlocked = (state: PermissionState): boolean =>
  state !== null && !state.granted && !state.canAskAgain;
