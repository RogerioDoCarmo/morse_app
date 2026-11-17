import { Platform } from 'react-native';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoSpeechRecognitionAdapter } from './expoSpeechRecognitionAdapter';

type Listener = (event: unknown) => void;

const mockListeners = new Map<string, Listener>();
const mockRemovals: string[] = [];

const mockStart = jest.fn<void, [unknown]>();
const mockStop = jest.fn<void, []>();
const mockAbort = jest.fn<void, []>();
const mockLocales = jest.fn<Promise<{ locales: string[] }>, []>();
const mockPermissions = jest.fn<Promise<{ granted: boolean }>, []>();
const mockRecognitionAvailable = jest.fn<boolean, []>();

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: (options: unknown): void => mockStart(options),
    stop: (): void => mockStop(),
    abort: (): void => mockAbort(),
    getSupportedLocales: (): Promise<{ locales: string[] }> => mockLocales(),
    requestPermissionsAsync: (): Promise<{ granted: boolean }> => mockPermissions(),
    isRecognitionAvailable: (): boolean => mockRecognitionAvailable(),
    addListener: (event: string, listener: Listener) => {
      mockListeners.set(event, listener);
      return {
        remove: () => {
          mockRemovals.push(event);
        },
      };
    },
  },
}));

const emit = (event: string, payload: unknown): void => {
  mockListeners.get(event)?.(payload);
};

const adapter = (): ReturnType<typeof createExpoSpeechRecognitionAdapter> =>
  createExpoSpeechRecognitionAdapter(createRecordingCrashReporter());

describe('expoSpeechRecognitionAdapter — availability on iOS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockRemovals.length = 0;
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('is available when the device recognises the language', async () => {
    mockLocales.mockResolvedValue({ locales: ['en-US', 'fr-FR'] });
    await expect(adapter().isAvailable('en')).resolves.toBe(true);
  });

  // A device that recognises en-GB recognises English. Refusing because the
  // table happens to say en-US would turn a working recogniser into a missing
  // one.
  it('matches on the language, not the whole tag', async () => {
    mockLocales.mockResolvedValue({ locales: ['en-GB'] });
    await expect(adapter().isAvailable('en')).resolves.toBe(true);

    mockLocales.mockResolvedValue({ locales: ['pt_BR'] });
    await expect(adapter().isAvailable('pt-BR')).resolves.toBe(true);
  });

  it('is unavailable when the language is missing entirely', async () => {
    mockLocales.mockResolvedValue({ locales: ['fr-FR', 'de-DE'] });
    await expect(adapter().isAvailable('es')).resolves.toBe(false);
  });

  it('reports a device that cannot answer, and says unavailable', async () => {
    mockLocales.mockRejectedValue(new Error('no service'));
    const crash = createRecordingCrashReporter();

    await expect(
      createExpoSpeechRecognitionAdapter(crash).isAvailable('en'),
    ).resolves.toBe(false);
    expect(crash.reports).toEqual([
      { message: 'no service', context: 'speech: could not list locales' },
    ]);
  });
});

/**
 * Android listens through whichever recogniser the user picked in the system
 * settings: Google's, Samsung's, Kõnele, anything offering a RecognitionService.
 * The library's locale list cannot speak for that recogniser: on Android 13+ it
 * asks the on-device one (absent on a phone without Google's services), and on
 * 12 and older it is always empty. Gating on it refused working recognisers
 * before they were ever asked.
 */
describe('expoSpeechRecognitionAdapter — availability on Android', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('is available whenever a recogniser is installed, even with an empty locale list', async () => {
    mockRecognitionAvailable.mockReturnValue(true);
    mockLocales.mockResolvedValue({ locales: [] });

    await expect(adapter().isAvailable('pt-BR')).resolves.toBe(true);
  });

  it('is unavailable when no recogniser is installed at all', async () => {
    mockRecognitionAvailable.mockReturnValue(false);
    mockLocales.mockResolvedValue({ locales: ['pt-BR'] });

    await expect(adapter().isAvailable('pt-BR')).resolves.toBe(false);
  });
});

describe('expoSpeechRecognitionAdapter — listening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockRemovals.length = 0;
    // clearAllMocks clears calls but keeps implementations, so a test that
    // makes start() throw would otherwise poison the ones after it.
    mockStart.mockImplementation(() => undefined);
    mockStop.mockImplementation(() => undefined);
    mockPermissions.mockResolvedValue({ granted: true });
  });

  it('listens in the locale it was given, with partials on', async () => {
    await adapter().start('pt-BR', jest.fn(), jest.fn());

    expect(mockStart).toHaveBeenCalledWith({
      lang: 'pt-BR',
      interimResults: true,
      continuous: false,
    });
  });

  // Partials are what make the transcript appear as the user speaks rather
  // than in one lump at the end.
  it('passes partials and finals through, marked as such', async () => {
    const onResult = jest.fn();
    await adapter().start('en', onResult, jest.fn());

    emit('result', { results: [{ transcript: 'hello' }], isFinal: false });
    emit('result', { results: [{ transcript: 'hello world' }], isFinal: true });

    expect(onResult).toHaveBeenNthCalledWith(1, {
      transcript: 'hello',
      isFinal: false,
    });
    expect(onResult).toHaveBeenNthCalledWith(2, {
      transcript: 'hello world',
      isFinal: true,
    });
  });

  it('survives a result with nothing in it', async () => {
    const onResult = jest.fn();
    await adapter().start('en', onResult, jest.fn());

    emit('result', { results: [], isFinal: true });

    expect(onResult).toHaveBeenCalledWith({ transcript: '', isFinal: true });
  });

  it('passes a recogniser error through', async () => {
    const onError = jest.fn();
    await adapter().start('en', jest.fn(), onError);

    emit('error', { error: 'no-speech' });

    expect(onError).toHaveBeenCalledWith('no-speech');
  });

  // The library's own code stays in the adapter; the screen only knows the
  // port's word for it.
  it('names an unsupported language in the port vocabulary', async () => {
    const onError = jest.fn();
    await adapter().start('es', jest.fn(), onError);

    emit('error', { error: 'language-not-supported' });

    expect(onError).toHaveBeenCalledWith('language');
  });

  // Refusing the microphone is a normal answer, not a crash.
  it('reports a refused permission and never starts listening', async () => {
    mockPermissions.mockResolvedValue({ granted: false });
    const onError = jest.fn();

    const unsubscribe = await adapter().start('en', jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith('permission');
    expect(mockStart).not.toHaveBeenCalled();
    expect(() => {
      unsubscribe();
    }).not.toThrow();
  });

  it('reports a recogniser that would not start, and unhooks its mockListeners', async () => {
    mockStart.mockImplementation(() => {
      throw new Error('busy');
    });
    const crash = createRecordingCrashReporter();
    const onError = jest.fn();

    await createExpoSpeechRecognitionAdapter(crash).start('en', jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith('start');
    expect(mockRemovals).toEqual(['result', 'error']);
    expect(crash.reports).toEqual([
      { message: 'busy', context: 'speech: could not start listening' },
    ]);
  });

  // Unsubscribing means the caller has stopped caring, so a final result would
  // arrive with nowhere to go.
  it('aborts when unsubscribed, rather than waiting for a final result', async () => {
    const unsubscribe = await adapter().start('en', jest.fn(), jest.fn());

    unsubscribe();

    expect(mockRemovals).toEqual(['result', 'error']);
    expect(mockAbort).toHaveBeenCalledTimes(1);
    expect(mockStop).not.toHaveBeenCalled();
  });

  // stop() is the user saying they have finished speaking, and the final
  // transcript is exactly what they want.
  it('stops without discarding what was heard', async () => {
    await adapter().stop();

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockAbort).not.toHaveBeenCalled();
  });

  it('reports a recogniser that would not stop', async () => {
    mockStop.mockImplementation(() => {
      throw new Error('stuck');
    });
    const crash = createRecordingCrashReporter();

    await expect(
      createExpoSpeechRecognitionAdapter(crash).stop(),
    ).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'stuck', context: 'speech: could not stop listening' },
    ]);
  });
});
