import { createPorts } from './createPorts';

jest.mock('expo-camera', () => ({ Camera: { getCameraPermissionsAsync: jest.fn() } }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));

describe('createPorts', () => {
  it('wires every port the UI can reach', () => {
    const { ports } = createPorts();
    expect(Object.keys(ports).sort()).toEqual([
      'locale',
      'permission',
      'speech',
      'torch',
      'tts',
    ]);
  });

  it('hands back the same torch instance it injected, so the host observes the real one', async () => {
    const { ports, torch } = createPorts();
    expect(ports.torch).toBe(torch);

    const seen: boolean[] = [];
    torch.subscribe((enabled) => seen.push(enabled));
    await ports.torch.setEnabled(true);
    expect(seen).toEqual([false, true]);
  });
});
