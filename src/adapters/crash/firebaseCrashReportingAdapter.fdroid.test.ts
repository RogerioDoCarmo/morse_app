import { createFirebaseCrashReportingAdapter } from './firebaseCrashReportingAdapter.fdroid';

// If the twin imported Firebase, this mock would be what it got — and the
// assertions below would see it. It must never be touched.
const mockGetCrashlytics = jest.fn();
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: (): unknown => mockGetCrashlytics(),
}));

describe('firebaseCrashReportingAdapter.fdroid', () => {
  it('is the no-op reporter: disabled, and stays so', async () => {
    const adapter = createFirebaseCrashReportingAdapter();
    expect(adapter.isEnabled()).toBe(false);
    await adapter.setEnabled(true);
    expect(adapter.isEnabled()).toBe(false);
  });

  it('accepts every call without reaching Firebase', async () => {
    const adapter = createFirebaseCrashReportingAdapter();
    await expect(
      adapter.recordError(new Error('boom'), 'context'),
    ).resolves.toBeUndefined();
    await expect(adapter.log('breadcrumb')).resolves.toBeUndefined();
    expect(mockGetCrashlytics).not.toHaveBeenCalled();
  });
});
