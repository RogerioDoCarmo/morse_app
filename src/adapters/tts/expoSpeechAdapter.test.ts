import * as Speech from 'expo-speech';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createExpoSpeechAdapter } from './expoSpeechAdapter';

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
const mockSpeak = jest.mocked(Speech.speak);
const mockStop = jest.mocked(Speech.stop);

describe('expoSpeechAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['en', 'en-US'],
    ['pt-BR', 'pt-BR'],
    ['es', 'es-ES'],
  ] as const)('speaks %s with the %s voice', async (locale, tag) => {
    mockSpeak.mockImplementation((_text, options) => options?.onDone?.());
    await createExpoSpeechAdapter(createRecordingCrashReporter()).speak('hello', locale);
    expect(mockSpeak).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ language: tag }),
    );
  });

  it('resolves when the user interrupts, so an awaiting caller is never stuck', async () => {
    mockSpeak.mockImplementation((_text, options) => options?.onStopped?.());
    await expect(
      createExpoSpeechAdapter(createRecordingCrashReporter()).speak('hi', 'en'),
    ).resolves.toBeUndefined();
  });

  it('resolves on error rather than rejecting into the UI', async () => {
    mockSpeak.mockImplementation((_text, options) =>
      options?.onError?.(new Error('nope')),
    );
    await expect(
      createExpoSpeechAdapter(createRecordingCrashReporter()).speak('hi', 'en'),
    ).resolves.toBeUndefined();
  });

  it('does not bother the engine with empty text', async () => {
    await createExpoSpeechAdapter(createRecordingCrashReporter()).speak('   ', 'en');
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('stops', async () => {
    await createExpoSpeechAdapter(createRecordingCrashReporter()).stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});

describe('expoSpeechAdapter — error reporting', () => {
  beforeEach(() => jest.clearAllMocks());

  // This is the failure the port exists for: a missing voice for a locale used
  // to look exactly like speech that worked.
  it('reports a speech failure instead of discarding it', async () => {
    const crash = createRecordingCrashReporter();
    mockSpeak.mockImplementation((_text, options) => {
      options?.onError?.(new Error('no voice for pt-BR'));
      return undefined;
    });

    await createExpoSpeechAdapter(crash).speak('olá', 'pt-BR');

    expect(crash.reports).toContainEqual({
      message: 'no voice for pt-BR',
      context: 'tts: speaking failed',
    });
  });

  it('still resolves when speech fails, so no caller hangs', async () => {
    const crash = createRecordingCrashReporter();
    mockSpeak.mockImplementation((_text, options) => {
      options?.onError?.(new Error('boom'));
      return undefined;
    });

    await expect(
      createExpoSpeechAdapter(crash).speak('hi', 'en'),
    ).resolves.toBeUndefined();
  });

  it('reports a failure to stop', async () => {
    const crash = createRecordingCrashReporter();
    mockStop.mockRejectedValue(new Error('engine busy'));

    await createExpoSpeechAdapter(crash).stop();

    expect(crash.reports).toContainEqual({
      message: 'engine busy',
      context: 'tts: stopping failed',
    });
  });

  it('reports nothing when speech succeeds', async () => {
    const crash = createRecordingCrashReporter();
    mockSpeak.mockImplementation((_text, options) => {
      options?.onDone?.();
      return undefined;
    });

    await createExpoSpeechAdapter(crash).speak('hi', 'en');

    expect(crash.reports).toEqual([]);
  });
});
