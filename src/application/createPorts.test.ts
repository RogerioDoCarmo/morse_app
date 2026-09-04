import { createPorts } from './createPorts';

// expo-audio reads its native module's prototype the moment it is imported,
// and that module does not exist under Jest. The adapter is covered by its own
// tests; here it only has to load so the composition root can be built.
// AsyncStorage throws at import when its native module is absent, which it
// always is under Jest. Same shape as expo-audio below: the adapter has its
// own tests; here it only has to load.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

const mockIsEnabled = jest.fn<boolean, []>();

jest.mock('@/adapters/crash/firebaseCrashReportingAdapter', () => ({
  createFirebaseCrashReportingAdapter: () => ({
    isEnabled: (): boolean => mockIsEnabled(),
    setEnabled: jest.fn(),
    recordError: jest.fn(),
    log: jest.fn(),
  }),
}));

describe('createPorts — crash reporting selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Firebase when it reports itself available', () => {
    mockIsEnabled.mockReturnValue(true);
    expect(createPorts().ports.crash.isEnabled()).toBe(true);
  });

  // A checkout without google-services.json is the normal case, and it must
  // produce a working app rather than an error at startup.
  it('falls back to the no-op reporter when Firebase is not configured', () => {
    mockIsEnabled.mockReturnValue(false);
    const { crash } = createPorts().ports;
    expect(crash.isEnabled()).toBe(false);
  });

  it('leaves the no-op reporter inert', async () => {
    mockIsEnabled.mockReturnValue(false);
    const { crash } = createPorts().ports;
    await expect(crash.recordError(new Error('boom'))).resolves.toBeUndefined();
    expect(crash.isEnabled()).toBe(false);
  });

  it('still supplies every other port either way', () => {
    mockIsEnabled.mockReturnValue(false);
    const { ports } = createPorts();
    for (const key of [
      'torch',
      'tts',
      'speech',
      'locale',
      'permission',
      'crash',
    ] as const) {
      expect(ports[key]).toBeDefined();
    }
  });
});
