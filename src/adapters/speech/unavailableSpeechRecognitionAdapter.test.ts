import { createUnavailableSpeechRecognitionAdapter } from './unavailableSpeechRecognitionAdapter';

describe('unavailableSpeechRecognitionAdapter', () => {
  const adapter = createUnavailableSpeechRecognitionAdapter();

  it('reports unavailable for every locale, so the UI exercises that path', async () => {
    await expect(adapter.isAvailable('en')).resolves.toBe(false);
    await expect(adapter.isAvailable('pt-BR')).resolves.toBe(false);
    await expect(adapter.isAvailable('es')).resolves.toBe(false);
  });

  it('refuses to start rather than pretending to listen', async () => {
    await expect(
      adapter.start(
        'en',
        () => undefined,
        () => undefined,
      ),
    ).rejects.toThrow(/not available/u);
  });

  it('stop is a no-op', async () => {
    await expect(adapter.stop()).resolves.toBeUndefined();
  });
});
