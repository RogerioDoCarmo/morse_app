import * as Speech from 'expo-speech';
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
    await createExpoSpeechAdapter().speak('hello', locale);
    expect(mockSpeak).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ language: tag }),
    );
  });

  it('resolves when the user interrupts, so an awaiting caller is never stuck', async () => {
    mockSpeak.mockImplementation((_text, options) => options?.onStopped?.());
    await expect(createExpoSpeechAdapter().speak('hi', 'en')).resolves.toBeUndefined();
  });

  it('resolves on error rather than rejecting into the UI', async () => {
    mockSpeak.mockImplementation((_text, options) =>
      options?.onError?.(new Error('nope')),
    );
    await expect(createExpoSpeechAdapter().speak('hi', 'en')).resolves.toBeUndefined();
  });

  it('does not bother the engine with empty text', async () => {
    await createExpoSpeechAdapter().speak('   ', 'en');
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('stops', async () => {
    await createExpoSpeechAdapter().stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});
