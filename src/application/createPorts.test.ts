import { ALL_BUILD_FEATURES, featuresFor } from '@/core/domain/buildFeatures';
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

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getSupportedLocales: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

const mockIsEnabled = jest.fn<boolean, []>();
const mockCreateFirebase = jest.fn();

jest.mock('@/adapters/crash/firebaseCrashReportingAdapter', () => ({
  createFirebaseCrashReportingAdapter: () => {
    mockCreateFirebase();
    return {
      isEnabled: (): boolean => mockIsEnabled(),
      setEnabled: jest.fn(),
      recordError: jest.fn(),
      log: jest.fn(),
    };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const recognition = require('expo-speech-recognition') as {
  ExpoSpeechRecognitionModule: { getSupportedLocales: jest.Mock; start: jest.Mock };
};

describe('createPorts — what a build leaves out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The store build: every feature on, exactly as before build variants existed.
  it('builds the store ports with no argument', () => {
    mockIsEnabled.mockReturnValue(true);
    expect(createPorts().ports.crash.isEnabled()).toBe(true);
    expect(mockCreateFirebase).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ NOT EVEN CONSTRUCTED. In the F-Droid build the Firebase packages are not
   * installed and resolve to an empty module, so building the adapter — even
   * to ask it whether it is enabled — is the call that would read nothing.
   */
  it('never builds the Firebase adapter when crash reporting is left out', () => {
    mockIsEnabled.mockReturnValue(true);
    const { crash } = createPorts(featuresFor('fdroid')).ports;

    expect(mockCreateFirebase).not.toHaveBeenCalled();
    expect(mockIsEnabled).not.toHaveBeenCalled();
    expect(crash.isEnabled()).toBe(false);
  });

  it('uses the real recogniser when speech input is in the build', async () => {
    recognition.ExpoSpeechRecognitionModule.getSupportedLocales.mockResolvedValue({
      locales: ['en-US'],
    });
    const { speech } = createPorts(ALL_BUILD_FEATURES).ports;

    await expect(speech.isAvailable('en')).resolves.toBe(true);
    expect(
      recognition.ExpoSpeechRecognitionModule.getSupportedLocales,
    ).toHaveBeenCalledTimes(1);
  });

  it('never touches the recogniser module when speech input is left out', async () => {
    const features = { ...ALL_BUILD_FEATURES, speechInput: false };
    const { speech } = createPorts(features).ports;
    const onError = jest.fn();

    await expect(speech.isAvailable('en')).resolves.toBe(false);
    await speech.start('en', jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith('unavailable');
    expect(
      recognition.ExpoSpeechRecognitionModule.getSupportedLocales,
    ).not.toHaveBeenCalled();
    expect(recognition.ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  });

  // Speech is kept in the F-Droid build: the platform recogniser is not
  // proprietary code in the APK. Pinned so that choice cannot drift unnoticed.
  it('keeps the real recogniser in the F-Droid build', async () => {
    recognition.ExpoSpeechRecognitionModule.getSupportedLocales.mockResolvedValue({
      locales: ['pt-BR'],
    });
    const { speech } = createPorts(featuresFor('fdroid')).ports;

    await expect(speech.isAvailable('pt-BR')).resolves.toBe(true);
  });
});

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
