import { createFirebaseCrashReportingAdapter } from './firebaseCrashReportingAdapter';

type Instance = { name: string };

const mockGetCrashlytics = jest.fn<Instance, []>();
const mockLog = jest.fn<void, [Instance, string]>();
const mockRecordError = jest.fn<void, [Instance, Error]>();
const mockSetCrashlyticsCollectionEnabled = jest.fn<Promise<null>, [Instance, boolean]>();

jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: (): Instance => mockGetCrashlytics(),
  log: (instance: Instance, message: string): void => mockLog(instance, message),
  recordError: (instance: Instance, error: Error): void =>
    mockRecordError(instance, error),
  setCrashlyticsCollectionEnabled: (
    instance: Instance,
    enabled: boolean,
  ): Promise<null> => mockSetCrashlyticsCollectionEnabled(instance, enabled),
}));

const INSTANCE: Instance = { name: 'crashlytics' };

describe('firebaseCrashReportingAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCrashlytics.mockReturnValue(INSTANCE);
    mockSetCrashlyticsCollectionEnabled.mockResolvedValue(null);
  });

  it('is enabled when the native module resolves', () => {
    expect(createFirebaseCrashReportingAdapter().isEnabled()).toBe(true);
  });

  it('is disabled when the native module is absent', () => {
    // The normal state of a checkout without google-services.json.
    mockGetCrashlytics.mockImplementation(() => {
      throw new Error('No Firebase App has been created');
    });
    expect(createFirebaseCrashReportingAdapter().isEnabled()).toBe(false);
  });

  it('records an error against the instance', async () => {
    const error = new Error('torch failed');
    await createFirebaseCrashReportingAdapter().recordError(error);
    expect(mockRecordError).toHaveBeenCalledWith(INSTANCE, error);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('leaves the context as a breadcrumb before the error', async () => {
    const error = new Error('torch failed');
    await createFirebaseCrashReportingAdapter().recordError(error, 'while flashing');
    expect(mockLog).toHaveBeenCalledWith(INSTANCE, 'while flashing');
    expect(mockRecordError).toHaveBeenCalledWith(INSTANCE, error);
  });

  it('forwards a collection preference', async () => {
    await createFirebaseCrashReportingAdapter().setEnabled(false);
    expect(mockSetCrashlyticsCollectionEnabled).toHaveBeenCalledWith(INSTANCE, false);
  });

  it('does nothing at all when the module is absent', async () => {
    mockGetCrashlytics.mockImplementation(() => {
      throw new Error('No Firebase App has been created');
    });
    const adapter = createFirebaseCrashReportingAdapter();
    await adapter.recordError(new Error('boom'), 'context');
    await adapter.log('breadcrumb');
    await adapter.setEnabled(true);
    expect(mockRecordError).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
    expect(mockSetCrashlyticsCollectionEnabled).not.toHaveBeenCalled();
  });

  // Reporting a crash must never become the crash it was meant to report.
  it('swallows a synchronous throw from the SDK', async () => {
    mockRecordError.mockImplementation(() => {
      throw new Error('SDK exploded');
    });
    await expect(
      createFirebaseCrashReportingAdapter().recordError(new Error('boom')),
    ).resolves.toBeUndefined();
  });

  it('swallows a rejected promise from the SDK', async () => {
    mockSetCrashlyticsCollectionEnabled.mockRejectedValue(new Error('network down'));
    await expect(
      createFirebaseCrashReportingAdapter().setEnabled(true),
    ).resolves.toBeUndefined();
  });
});
