import { Camera } from 'expo-camera';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoTorchAdapter, type TorchState } from './expoTorchAdapter';

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
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));
    expect(seen).toEqual([{ active: false, enabled: false }]);
  });

  it('notifies subscribers when the torch is switched', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setEnabled(true);
    await adapter.setEnabled(false);
    expect(seen).toEqual([
      { active: false, enabled: false },
      { active: false, enabled: true },
      { active: false, enabled: false },
    ]);
  });

  it('does not re-notify when nothing changed', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setEnabled(true);
    await adapter.setEnabled(true);
    expect(seen).toHaveLength(2);
  });

  // The whole point of the second flag: a run holds the camera once, then
  // switches the torch inside it as many times as the message has marks, and
  // the host must not be told to mount anything again in between.
  it('holds the camera across a run without re-announcing it', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setActive(true);
    await adapter.setEnabled(true);
    await adapter.setEnabled(false);
    await adapter.setEnabled(true);

    expect(seen.map((state) => state.active)).toEqual([false, true, true, true, true]);
    expect(seen.map((state) => state.enabled)).toEqual([false, false, true, false, true]);
  });

  it('does not re-announce a camera it is already holding', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setActive(true);
    await adapter.setActive(true);

    expect(seen).toHaveLength(2);
  });

  // A torch lit on a camera that is gone is a state the host cannot render.
  it('puts the torch out when the camera is let go', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setActive(true);
    await adapter.setEnabled(true);
    await adapter.setActive(false);

    expect(seen.at(-1)).toEqual({ active: false, enabled: false });
  });

  it('release turns the torch off, and is safe to call twice', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setEnabled(true);
    await adapter.release();
    await adapter.release();
    expect(seen).toEqual([
      { active: false, enabled: false },
      { active: false, enabled: true },
      { active: false, enabled: false },
    ]);
  });

  it('release also lets go of a camera nothing had lit', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    adapter.subscribe((state) => seen.push(state));

    await adapter.setActive(true);
    await adapter.release();

    expect(seen.at(-1)).toEqual({ active: false, enabled: false });
  });

  it('stops notifying after unsubscribe', async () => {
    const adapter = createExpoTorchAdapter(createRecordingCrashReporter());
    const seen: TorchState[] = [];
    const unsubscribe = adapter.subscribe((state) => seen.push(state));

    unsubscribe();
    await adapter.setEnabled(true);
    expect(seen).toHaveLength(1);
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
    const seen: TorchState[] = [];

    adapter.subscribe(() => {
      throw new Error('view exploded');
    });
    adapter.subscribe((state) => seen.push(state));

    await expect(adapter.setEnabled(true)).resolves.toBeUndefined();
    expect(seen.map((state) => state.enabled)).toContain(true);
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
