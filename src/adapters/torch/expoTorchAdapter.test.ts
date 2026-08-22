import { Camera } from 'expo-camera';
import { createExpoTorchAdapter } from './expoTorchAdapter';

jest.mock('expo-camera', () => ({
  Camera: { getCameraPermissionsAsync: jest.fn() },
}));
const camera = jest.mocked(Camera);

describe('expoTorchAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports availability from the camera permission, since the torch sits behind it', async () => {
    camera.getCameraPermissionsAsync.mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof Camera.getCameraPermissionsAsync>
    >);
    await expect(createExpoTorchAdapter().isAvailable()).resolves.toBe(true);

    camera.getCameraPermissionsAsync.mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof Camera.getCameraPermissionsAsync>
    >);
    await expect(createExpoTorchAdapter().isAvailable()).resolves.toBe(false);
  });

  it('pushes the current state to a subscriber immediately', () => {
    const adapter = createExpoTorchAdapter();
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));
    expect(seen).toEqual([false]);
  });

  it('notifies subscribers when the torch is switched', async () => {
    const adapter = createExpoTorchAdapter();
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.setEnabled(false);
    expect(seen).toEqual([false, true, false]);
  });

  it('does not re-notify when nothing changed', async () => {
    const adapter = createExpoTorchAdapter();
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.setEnabled(true);
    expect(seen).toEqual([false, true]);
  });

  it('release turns the torch off, and is safe to call twice', async () => {
    const adapter = createExpoTorchAdapter();
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.release();
    await adapter.release();
    expect(seen).toEqual([false, true, false]);
  });

  it('stops notifying after unsubscribe', async () => {
    const adapter = createExpoTorchAdapter();
    const seen: boolean[] = [];
    const unsubscribe = adapter.subscribe((enabled) => seen.push(enabled));

    unsubscribe();
    await adapter.setEnabled(true);
    expect(seen).toEqual([false]);
  });
});
