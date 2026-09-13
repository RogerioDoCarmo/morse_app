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

  /**
   * ⚠️ THE ANSWER SHAPE CHANGED, AND BOTH HAVE TO WORK. The module used to
   * return a bare number; it now returns `{ level, stale }`. Every test above
   * passes the OLD shape, which is not a leftover — an `expo-updates` bundle
   * reaches binaries it was not built with, so this JS will run on phones
   * whose native side still answers the old way, and a reader that understood
   * only the new one would report "cannot tell" on all of them.
   */
  describe('the newer answer, which says whether it could be trusted', () => {
    it('reads the level out of the record', async () => {
      mockRequireModule.mockReturnValue(reporting({ level: 0.25, stale: false }));

      await expect(
        createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
      ).resolves.toBe(0.25);
    });

    it('clamps a record reading the same way', async () => {
      mockRequireModule.mockReturnValue(reporting({ level: 1.4, stale: false }));

      await expect(
        createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
      ).resolves.toBe(1);
    });

    it('answers null when the record carries no level', async () => {
      mockRequireModule.mockReturnValue(reporting({ level: null, stale: false }));

      await expect(
        createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
      ).resolves.toBeNull();
    });

    /**
     * ⚠️ USED ANYWAY, not discarded. This is the whole point of the change: a
     * session iOS would not activate used to return nil, and nil silences the
     * warning all the way up — so the one warning whose job is to explain
     * silence could itself be silenced. A reading that may be a few seconds
     * old is a far better basis for it than no reading at all.
     */
    it('still answers with a stale reading rather than going quiet', async () => {
      mockRequireModule.mockReturnValue(reporting({ level: 0.2, stale: true }));

      await expect(
        createNativeVolumeAdapter(createRecordingCrashReporter()).level(),
      ).resolves.toBe(0.2);
    });

    // The breadcrumb that will settle which of the two candidate causes left
    // a tester on 0.3.4 (13) with no volume warning at all.
    it('reports the session it could not activate', async () => {
      const crash = createRecordingCrashReporter();
      mockRequireModule.mockReturnValue(reporting({ level: 0.2, stale: true }));

      await createNativeVolumeAdapter(crash).level();

      expect(crash.reports).toContainEqual({
        message: 'volume: the audio session would not activate',
        context: 'volume: the level may predate the last change',
      });
    });

    it('says nothing about a reading it could trust', async () => {
      const crash = createRecordingCrashReporter();
      mockRequireModule.mockReturnValue(reporting({ level: 0.2, stale: false }));

      await createNativeVolumeAdapter(crash).level();

      expect(crash.reports).toEqual([]);
    });

    // A record with the field missing entirely — an older module half-updated,
    // or a platform that dropped it in serialisation. Absent is not stale.
    it('treats a missing stale flag as a reading it can trust', async () => {
      const crash = createRecordingCrashReporter();
      mockRequireModule.mockReturnValue(reporting({ level: 0.2 }));

      await expect(createNativeVolumeAdapter(crash).level()).resolves.toBe(0.2);
      expect(crash.reports).toEqual([]);
    });
  });
});
