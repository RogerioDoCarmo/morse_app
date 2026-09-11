import { setStringAsync } from 'expo-clipboard';

import { createExpoClipboardAdapter } from './expoClipboardAdapter';

// ⚠️ The factory cannot close over an outer variable — jest hoists it above
// every import. Declared inline, then reached through `jest.mocked`, which is
// the shape `nativeVolumeAdapter.test.ts` already uses.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const mockWrite = jest.mocked(setStringAsync);

describe('expoClipboardAdapter', () => {
  beforeEach(() => {
    mockWrite.mockReset();
    mockWrite.mockResolvedValue(true);
  });

  it('writes the text it was given', async () => {
    await expect(createExpoClipboardAdapter().write('... --- ...')).resolves.toBe(true);
    expect(mockWrite).toHaveBeenCalledWith('... --- ...');
  });

  /**
   * ⚠️ Swallowed into `false`, not rethrown. A clipboard write is not worth
   * crashing a translator over, and the screen's response to a refusal is the
   * same as to a thrown error — say nothing happened. Reporting the difference
   * would hand the user a distinction they cannot act on.
   */
  it('turns a thrown platform error into false', async () => {
    mockWrite.mockRejectedValue(new Error('no pasteboard'));
    await expect(createExpoClipboardAdapter().write('x')).resolves.toBe(false);
  });

  /**
   * ⚠️ A refusal is RETURNED, not thrown. An adapter that only caught throws
   * would report success for a write the platform declined.
   */
  it('passes a platform refusal through as false', async () => {
    mockWrite.mockResolvedValue(false);
    await expect(createExpoClipboardAdapter().write('x')).resolves.toBe(false);
  });

  it('writes an empty string rather than deciding for the caller', async () => {
    await expect(createExpoClipboardAdapter().write('')).resolves.toBe(true);
    expect(mockWrite).toHaveBeenCalledWith('');
  });
});
