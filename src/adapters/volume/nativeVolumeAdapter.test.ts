import { requireOptionalNativeModule } from 'expo';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createNativeVolumeAdapter } from './nativeVolumeAdapter';

// The local module. Absent by default, which is what every build before this
// one sees — and what the test runner sees always.
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));
const mockRequireModule = jest.mocked(requireOptionalNativeModule);

const reporting = (level: unknown): { getOutputLevel: jest.Mock } => ({
  getOutputLevel: jest.fn(() => level),
});

describe('nativeVolumeAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireModule.mockReturnValue(null);
  });

  it('reports the level the device gives', async () => {
    mockRequireModule.mockReturnValue(reporting(0.25));

    await expect(
      createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
    ).resolves.toBe(0.25);
  });

  /**
   * The case this whole adapter exists to answer honestly. Every build before
   * the module shipped has no module, and a warning shown on a guess would
   * fire on all of them — telling someone their volume is low when it is not
   * is a worse bug than staying quiet.
   */
  it('answers null when the module is not in this build', async () => {
    mockRequireModule.mockReturnValue(null);

    await expect(
      createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
    ).resolves.toBeNull();
  });

  it('answers null when the device declines to say', async () => {
    mockRequireModule.mockReturnValue(reporting(null));

    await expect(
      createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
    ).resolves.toBeNull();
  });

  it.each([NaN, Infinity, 'loud', undefined])(
    'answers null for a reading of %p, which is not a level',
    async (reading) => {
      mockRequireModule.mockReturnValue(reporting(reading));

      await expect(
        createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
      ).resolves.toBeNull();
    },
  );

  // Out of range says the reading is wrong, not that the volume is somewhere
  // unusual — so it is pulled back into the range rather than trusted.
  it.each([
    [1.4, 1],
    [-0.2, 0],
  ])('clamps %f to %f', async (reading, expected) => {
    mockRequireModule.mockReturnValue(reporting(reading));

    await expect(
      createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
    ).resolves.toBe(expected);
  });

  it('reports a read that threw, and still answers null', async () => {
    const crash = createRecordingCrashReporter();
    mockRequireModule.mockReturnValue({
      getOutputLevel: jest.fn(() => {
        throw new Error('no audio service');
      }),
    });

    await expect(createNativeVolumeAdapter(crash).level()).resolves.toBeNull();
    expect(crash.reports).toContainEqual({
      message: 'no audio service',
      context: 'volume: could not read the level',
    });
  });

  it('reports nothing on a healthy read', async () => {
    const crash = createRecordingCrashReporter();
    mockRequireModule.mockReturnValue(reporting(0.8));

    await createNativeVolumeAdapter(crash).level();

    expect(crash.reports).toEqual([]);
  });
});
