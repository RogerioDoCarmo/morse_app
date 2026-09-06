import type { PermissionKind, PermissionState } from '../domain/permission';

/** Reads and requests the two permissions this app can ask for. */
export interface IPermissionPort {
  /** Current state without prompting. `null` while still unknown. */
  getState(kind: PermissionKind): Promise<PermissionState>;
  /** Prompts the OS. Resolves to the state after the user answers. */
  request(kind: PermissionKind): Promise<PermissionState>;
  /** Opens the OS settings page for this app, for the blocked case. */
  openSettings(): Promise<void>;
}
