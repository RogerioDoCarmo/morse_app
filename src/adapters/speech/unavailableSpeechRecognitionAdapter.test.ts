import { createUnavailableSpeechRecognitionAdapter } from './unavailableSpeechRecognitionAdapter';

describe('unavailableSpeechRecognitionAdapter', () => {
  it('reports every locale unavailable', async () => {
    const adapter = createUnavailableSpeechRecognitionAdapter();
    await expect(adapter.isAvailable('en')).resolves.toBe(false);
    await expect(adapter.isAvailable('pt-BR')).resolves.toBe(false);
    await expect(adapter.isAvailable('es')).resolves.toBe(false);
  });

  it('refuses to start, says why, and hands back a harmless unsubscribe', async () => {
    const onResult = jest.fn();
    const onError = jest.fn();
    const unsubscribe = await createUnavailableSpeechRecognitionAdapter().start(
      'en',
      onResult,
      onError,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('unavailable');
    expect(onResult).not.toHaveBeenCalled();
    expect(unsubscribe()).toBeUndefined();
  });

  it('stops quietly', async () => {
    await expect(
      createUnavailableSpeechRecognitionAdapter().stop(),
    ).resolves.toBeUndefined();
  });
});
