import { Camera } from 'expo-camera';
import { Linking } from 'react-native';
import type { PermissionKind, PermissionState } from '@/core/domain/permission';
import type { IPermissionPort } from '@/core/ports';

/** Expo's shape, narrowed to what the domain actually models. */
type ExpoPermission = Readonly<{ granted: boolean; canAskAgain: boolean }>;

const toDomain = (response: ExpoPermission): PermissionState =>
  response.granted
    ? { granted: true, canAskAgain: response.canAskAgain }
    : { granted: false, canAskAgain: response.canAskAgain };

/**
 * Reads and requests the camera and microphone permissions through expo-camera.
 *
 * The torch lives behind the camera permission on both platforms — there is no
 * separate torch permission — which is why the camera entry covers flash output.
 */
export function createExpoPermissionAdapter(): IPermissionPort {
  const read = async (kind: PermissionKind): Promise<ExpoPermission> =>
    kind === 'camera'
      ? await Camera.getCameraPermissionsAsync()
      : await Camera.getMicrophonePermissionsAsync();

  const ask = async (kind: PermissionKind): Promise<ExpoPermission> =>
    kind === 'camera'
      ? await Camera.requestCameraPermissionsAsync()
      : await Camera.requestMicrophonePermissionsAsync();

  return {
    async getState(kind) {
      return toDomain(await read(kind));
    },
    async request(kind) {
      return toDomain(await ask(kind));
    },
    async openSettings() {
      await Linking.openSettings();
    },
  };
}
