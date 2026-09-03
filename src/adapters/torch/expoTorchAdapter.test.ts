import { Camera } from 'expo-camera';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
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
    await expect(
      createExpoTorchAdapter(createRecordingCrashReporter()).isAvailable(),
    ).resolves.toBe(true);

    camera.getCameraPermissionsAsync.mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof Camera.getCameraPermissionsAsync>
    >);
    await expect(
      createExpoTorchAdapter(createRecordingCrashReporter()).isAvailable(),
    ).resolves.toBe(false);
  });

  it('pushes the current state to a subscriber immediately', () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));
    expect(seen).toEqual([false]);
  });

  it('notifies subscribers when the torch is switched', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.setEnabled(false);
    expect(seen).toEqual([false, true, false]);
  });

  it('does not re-notify when nothing changed', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.setEnabled(true);
    expect(seen).toEqual([false, true]);
  });

  it('release turns the torch off, and is safe to call twice', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: boolean[] = [];
    adapter.subscribe((enabled) => seen.push(enabled));

    await adapter.setEnabled(true);
    await adapter.release();
    await adapter.release();
    expect(seen).toEqual([false, true, false]);
  });

  it('stops notifying after unsubscribe', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: boolean[] = [];
    const unsubscribe = adapter.subscribe((enabled) => seen.push(enabled));

    unsubscribe();
    await adapter.setEnabled(true);
    expect(seen).toEqual([false]);
  });
});

describe('expoTorchAdapter — error reporting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports a permissions read that throws, and reports no torch', async () => {
    const crash = createRecordingCrashReporter();
    camera.getCameraPermissionsAsync.mockRejectedValue(new Error('camera service down'));

    await expect(createExpoTorchAdapter(crash).isAvailable()).resolves.toBe(false);
    expect(crash.reports).toContainEqual({
      message: 'camera service down',
      context: 'torch: reading camera permissions',
    });
  });

  // A throwing view must not leave the caller of setEnabled with a rejection,
  // nor stop the other listeners being told.
  it('survives a listener that throws, and still notifies the others', async () => {
    const crash = createRecordingCrashReporter();
    const adapter = createExpoTorchAdapter(crash);
    const seen: boolean[] = [];

    adapter.subscribe(() => {
      throw new Error('view exploded');
    });
    adapter.subscribe((enabled) => seen.push(enabled));

    await expect(adapter.setEnabled(true)).resolves.toBeUndefined();
    expect(seen).toContain(true);
    expect(crash.reports).toContainEqual({
      message: 'view exploded',
      context: 'torch: notifying a mounted view',
    });
  });

  it('wraps a non-Error throw so the report still carries a message', async () => {
    const crash = createRecordingCrashReporter();
    camera.getCameraPermissionsAsync.mockRejectedValue('just a string');

    await createExpoTorchAdapter(crash).isAvailable();

    expect(crash.reports).toContainEqual({
      message: 'just a string',
      context: 'torch: reading camera permissions',
    });
  });

  it('reports nothing on a healthy path', async () => {
    const crash = createRecordingCrashReporter();
    camera.getCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);

    const adapter = createExpoTorchAdapter(crash);
    await adapter.isAvailable();
    await adapter.setEnabled(true);
    await adapter.release();

    expect(crash.reports).toEqual([]);
  });
});
