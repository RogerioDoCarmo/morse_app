import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoKeepAwakeAdapter } from './expoKeepAwakeAdapter';

const mockActivate = jest.fn<Promise<void>, [string]>();
const mockDeactivate = jest.fn<Promise<void>, [string]>();

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string): Promise<void> => mockActivate(tag),
  deactivateKeepAwake: (tag: string): Promise<void> => mockDeactivate(tag),
}));

describe('expoKeepAwakeAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivate.mockResolvedValue(undefined);
    mockDeactivate.mockResolvedValue(undefined);
  });

  // Tagged, because expo-keep-awake reference-counts by tag: an untagged
  // release would drop a hold this app never took.
  it("holds and releases under this app's own tag", async () => {
    const port = createExpoKeepAwakeAdapter(createRecordingCrashReporter());

    await port.activate();
    await port.release();

    expect(mockActivate).toHaveBeenCalledWith('morse-playback');
    expect(mockDeactivate).toHaveBeenCalledWith('morse-playback');
  });

  // A message that will not play because the screen could not be held awake is
  // worse than one that plays while the screen dims.
  it('reports a hold it could not take, and carries on', async () => {
    mockActivate.mockRejectedValue(new Error('no window'));
    const crash = createRecordingCrashReporter();

    await expect(createExpoKeepAwakeAdapter(crash).activate()).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'no window', context: 'keepAwake: could not hold the screen' },
    ]);
  });

  // A hold that will not release drains the battery until the app is killed.
  it('reports a hold it could not release', async () => {
    mockDeactivate.mockRejectedValue(new Error('not held'));
    const crash = createRecordingCrashReporter();

    await expect(createExpoKeepAwakeAdapter(crash).release()).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'not held', context: 'keepAwake: could not release' },
    ]);
  });
});
