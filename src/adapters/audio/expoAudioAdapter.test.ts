import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoAudioAdapter } from './expoAudioAdapter';

type Status = { didJustFinish: boolean };
type StatusListener = (status: Status) => void;

const mockPlay = jest.fn<void, []>();
const mockPlayerRemove = jest.fn<void, []>();
const mockSubscriptionRemove = jest.fn<void, []>();
const mockCreateAudioPlayer = jest.fn<unknown, [string]>();
const mockSetAudioModeAsync = jest.fn<Promise<void>, [unknown]>();

const mockFileCreate = jest.fn<void, [unknown]>();
const mockFileWrite = jest.fn<void, [Uint8Array]>();
const mockFileDelete = jest.fn<void, []>();
const mockFileNames: string[] = [];

/** Set by the fake player each time the adapter subscribes. */
let notify: StatusListener = () => undefined;

jest.mock('expo-audio', () => ({
  createAudioPlayer: (uri: string): unknown => mockCreateAudioPlayer(uri),
  setAudioModeAsync: (mode: unknown): Promise<void> => mockSetAudioModeAsync(mode),
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
    delete(): void {
      mockFileDelete();
    }
  },
}));

/** A player that hands its status listener back to the test. */
const fakePlayer = (): unknown => ({
  play: () => mockPlay(),
  remove: () => mockPlayerRemove(),
  addListener: (_event: string, listener: StatusListener) => {
    notify = listener;
    return { remove: () => mockSubscriptionRemove() };
  },
});

const WAV = new Uint8Array([82, 73, 70, 70]);

const adapter = (): ReturnType<typeof createExpoAudioAdapter> =>
  createExpoAudioAdapter(createRecordingCrashReporter());

describe('expoAudioAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileNames.length = 0;
    notify = () => undefined;
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAudioPlayer.mockImplementation(() => fakePlayer());
  });

  it('writes the bytes to a cache clip and plays that file', async () => {
    const playing = adapter().play(WAV);
    await Promise.resolve();

    expect(mockFileWrite).toHaveBeenCalledWith(WAV);
    expect(mockCreateAudioPlayer).toHaveBeenCalledWith('file:///cache/morse-1.wav');
    expect(mockPlay).toHaveBeenCalledTimes(1);

    notify({ didJustFinish: true });
    await expect(playing).resolves.toBeUndefined();
  });

  // A user who pressed play asked to hear it; the silent switch should not
  // swallow the message.
  it('allows playback while the device is in silent mode', async () => {
    const playing = adapter().play(WAV);
    await Promise.resolve();

    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true });

    notify({ didJustFinish: true });
    await playing;
  });

  it('stays pending while the clip is still playing', async () => {
    let settled = false;
    const playing = adapter()
      .play(WAV)
      .then(() => {
        settled = true;
      });
    await Promise.resolve();

    notify({ didJustFinish: false });
    await Promise.resolve();
    expect(settled).toBe(false);

    notify({ didJustFinish: true });
    await playing;
    expect(settled).toBe(true);
  });

  it('releases the player and deletes the clip once it finishes', async () => {
    const playing = adapter().play(WAV);
    await Promise.resolve();
    notify({ didJustFinish: true });
    await playing;

    expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
    expect(mockPlayerRemove).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  it('resolves a playback that is stopped part-way', async () => {
    const port = adapter();
    const playing = port.play(WAV);
    await Promise.resolve();

    await port.stop();

    await expect(playing).resolves.toBeUndefined();
    expect(mockPlayerRemove).toHaveBeenCalledTimes(1);
  });

  it('does nothing when stopped with nothing playing', async () => {
    await expect(adapter().stop()).resolves.toBeUndefined();
    expect(mockPlayerRemove).not.toHaveBeenCalled();
  });

  // Two Morse signals at once are unreadable.
  it('ends the previous message when a new one starts', async () => {
    const port = adapter();
    const first = port.play(WAV);
    await Promise.resolve();

    const second = port.play(WAV);
    await Promise.resolve();

    await expect(first).resolves.toBeUndefined();
    expect(mockPlayerRemove).toHaveBeenCalledTimes(1);

    notify({ didJustFinish: true });
    await second;
  });

  it('gives each clip its own name, so a lingering player cannot read a rewritten file', async () => {
    const port = adapter();
    void port.play(WAV);
    await Promise.resolve();
    void port.play(WAV);
    await Promise.resolve();
    await port.stop();

    expect(mockFileNames).toEqual(['morse-1.wav', 'morse-2.wav']);
  });

  it('overwrites a clip left behind by a previous run', async () => {
    void adapter().play(WAV);
    await Promise.resolve();

    expect(mockFileCreate).toHaveBeenCalledWith({ overwrite: true });
  });
});

describe('expoAudioAdapter failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileNames.length = 0;
    notify = () => undefined;
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAudioPlayer.mockImplementation(() => fakePlayer());
  });

  // Every case here must RESOLVE. A caller awaiting playback that hangs is a
  // worse failure than one that plays nothing.
  it('reports a clip it could not prepare, and does not hang the caller', async () => {
    mockCreateAudioPlayer.mockImplementation(() => {
      throw new Error('no codec');
    });
    const crash = createRecordingCrashReporter();

    await expect(createExpoAudioAdapter(crash).play(WAV)).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'no codec', context: 'audio: preparing the clip failed' },
    ]);
  });

  it('reports playback that would not start, and resolves', async () => {
    mockPlay.mockImplementation(() => {
      throw new Error('device busy');
    });
    const crash = createRecordingCrashReporter();

    await expect(createExpoAudioAdapter(crash).play(WAV)).resolves.toBeUndefined();
    expect(crash.reports).toContainEqual({
      message: 'device busy',
      context: 'audio: starting playback failed',
    });
  });

  it('reports a player it could not release', async () => {
    mockPlayerRemove.mockImplementation(() => {
      throw new Error('already gone');
    });
    const crash = createRecordingCrashReporter();
    const port = createExpoAudioAdapter(crash);

    const playing = port.play(WAV);
    await Promise.resolve();
    await port.stop();

    await expect(playing).resolves.toBeUndefined();
    expect(crash.reports).toContainEqual({
      message: 'already gone',
      context: 'audio: releasing the player failed',
    });
  });

  it('reports a clip it could not delete', async () => {
    mockFileDelete.mockImplementation(() => {
      throw new Error('locked');
    });
    const crash = createRecordingCrashReporter();
    const port = createExpoAudioAdapter(crash);

    const playing = port.play(WAV);
    await Promise.resolve();
    await port.stop();

    await playing;
    expect(crash.reports).toContainEqual({
      message: 'locked',
      context: 'audio: deleting the clip failed',
    });
  });

  it('reports a non-Error throw with a usable message', async () => {
    mockCreateAudioPlayer.mockImplementation(() => {
      // Throwing a non-Error is the whole point of this test.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'just a string';
    });
    const crash = createRecordingCrashReporter();

    await createExpoAudioAdapter(crash).play(WAV);
    expect(crash.reports).toEqual([
      { message: 'just a string', context: 'audio: preparing the clip failed' },
    ]);
  });
});
