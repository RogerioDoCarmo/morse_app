import { Camera } from 'expo-camera';
import { Linking } from 'react-native';
import { createExpoPermissionAdapter } from './expoPermissionAdapter';

jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    getMicrophonePermissionsAsync: jest.fn(),
    requestMicrophonePermissionsAsync: jest.fn(),
  },
}));

const camera = jest.mocked(Camera);

describe('expoPermissionAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps a granted response into the domain shape', async () => {
    camera.getCameraPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
    } as Awaited<ReturnType<typeof Camera.getCameraPermissionsAsync>>);
    await expect(createExpoPermissionAdapter().getState('camera')).resolves.toEqual({
      granted: true,
      canAskAgain: false,
    });
  });

  it('maps a blocked response into the domain shape', async () => {
    camera.getMicrophonePermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as Awaited<ReturnType<typeof Camera.getMicrophonePermissionsAsync>>);
    await expect(createExpoPermissionAdapter().getState('microphone')).resolves.toEqual({
      granted: false,
      canAskAgain: false,
    });
  });

  it('asks the camera API for the camera, and the microphone API for the microphone', async () => {
    const response = { granted: true, canAskAgain: true };
    camera.requestCameraPermissionsAsync.mockResolvedValue(
      response as Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>,
    );
    camera.requestMicrophonePermissionsAsync.mockResolvedValue(
      response as Awaited<ReturnType<typeof Camera.requestMicrophonePermissionsAsync>>,
    );
    const adapter = createExpoPermissionAdapter();

    await adapter.request('camera');
    expect(camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(camera.requestMicrophonePermissionsAsync).not.toHaveBeenCalled();

    await adapter.request('microphone');
    expect(camera.requestMicrophonePermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('opens the OS settings page for the blocked case', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await createExpoPermissionAdapter().openSettings();
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });
});
