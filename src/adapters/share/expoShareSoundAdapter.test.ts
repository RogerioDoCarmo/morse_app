import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoShareSoundAdapter, SHARED_SOUND_NAME } from './expoShareSoundAdapter';

const mockIsAvailable = jest.fn<Promise<boolean>, []>();
const mockShareAsync = jest.fn<Promise<void>, [string, unknown]>();
const mockFileCreate = jest.fn<void, [unknown]>();
const mockFileWrite = jest.fn<void, [Uint8Array]>();
const mockFileNames: string[] = [];

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (): Promise<boolean> => mockIsAvailable(),
  shareAsync: (url: string, options: unknown): Promise<void> =>
    mockShareAsync(url, options),
}));

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    readonly uri: string;
    constructor(_directory: string, name: string) {
      mockFileNames.push(name);
      this.uri = `file:///cache/${name}`;
    }
    create(options: unknown): void {
      mockFileCreate(options);
    }
    write(bytes: Uint8Array): void {
      mockFileWrite(bytes);
    }
  },
}));

const WAV = new Uint8Array([82, 73, 70, 70]);

describe('expoShareSoundAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileNames.length = 0;
    mockIsAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it('names the file OmniMorse.wav, whatever the message', async () => {
    expect(SHARED_SOUND_NAME).toBe('OmniMorse.wav');
    await createExpoShareSoundAdapter(createRecordingCrashReporter()).share(WAV, 'Share');
    expect(mockFileNames).toEqual(['OmniMorse.wav']);
  });

  it('writes the exact bytes, overwriting the previous share', async () => {
    await createExpoShareSoundAdapter(createRecordingCrashReporter()).share(WAV, 'Share');
    expect(mockFileCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockFileWrite).toHaveBeenCalledWith(WAV);
  });

  it('offers the file as WAV audio under the given title', async () => {
    await expect(
      createExpoShareSoundAdapter(createRecordingCrashReporter()).share(
        WAV,
        'Share as sound',
      ),
    ).resolves.toBe('shared');
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/OmniMorse.wav', {
      mimeType: 'audio/wav',
      UTI: 'com.microsoft.waveform-audio',
      dialogTitle: 'Share as sound',
    });
  });

  it('writes nothing when the device cannot share', async () => {
    mockIsAvailable.mockResolvedValue(false);
    await expect(
      createExpoShareSoundAdapter(createRecordingCrashReporter()).share(WAV, 'Share'),
    ).resolves.toBe('unavailable');
    expect(mockFileWrite).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Returned, not thrown, and REPORTED. The screen shows one message for
   * every failure, so the report is the only place the cause survives.
   */
  it('reports a sheet that will not open and resolves failed', async () => {
    const crash = createRecordingCrashReporter();
    mockShareAsync.mockRejectedValue(new Error('no activity'));
    await expect(createExpoShareSoundAdapter(crash).share(WAV, 'Share')).resolves.toBe(
      'failed',
    );
    expect(crash.reports).toEqual([
      { message: 'no activity', context: 'share: offering the sound failed' },
    ]);
  });

  it('reports a file that cannot be written and never opens the sheet', async () => {
    const crash = createRecordingCrashReporter();
    mockFileWrite.mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(createExpoShareSoundAdapter(crash).share(WAV, 'Share')).resolves.toBe(
      'failed',
    );
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(crash.reports).toEqual([
      { message: 'disk full', context: 'share: offering the sound failed' },
    ]);
  });

  it('reports a non-Error throw with a message it can keep', async () => {
    const crash = createRecordingCrashReporter();
    mockIsAvailable.mockRejectedValue('gone');
    await expect(createExpoShareSoundAdapter(crash).share(WAV, 'Share')).resolves.toBe(
      'failed',
    );
    expect(crash.reports).toEqual([
      { message: 'gone', context: 'share: offering the sound failed' },
    ]);
  });
});
