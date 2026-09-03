import { createNoopCrashReportingAdapter } from './noopCrashReportingAdapter';

describe('noopCrashReportingAdapter', () => {
  const adapter = createNoopCrashReportingAdapter();

  it('reports itself as disabled, so the composition root can tell', () => {
    expect(adapter.isEnabled()).toBe(false);
  });

  it('accepts every call without throwing', async () => {
    await expect(adapter.setEnabled(true)).resolves.toBeUndefined();
    await expect(adapter.recordError(new Error('boom'))).resolves.toBeUndefined();
    await expect(
      adapter.recordError(new Error('boom'), 'while flashing'),
    ).resolves.toBeUndefined();
    await expect(adapter.log('breadcrumb')).resolves.toBeUndefined();
  });

  it('stays disabled even after being switched on', async () => {
    await adapter.setEnabled(true);
    expect(adapter.isEnabled()).toBe(false);
  });
});
