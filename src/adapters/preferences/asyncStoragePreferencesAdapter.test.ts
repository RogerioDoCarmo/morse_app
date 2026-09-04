import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRecordingCrashReporter } from '@/testing/recordingCrashReporter';
import { createAsyncStoragePreferencesAdapter } from './asyncStoragePreferencesAdapter';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = jest.mocked(AsyncStorage);

describe('asyncStoragePreferencesAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads what was written under a key', async () => {
    storage.getItem.mockResolvedValue('7');
    const port = createAsyncStoragePreferencesAdapter(createRecordingCrashReporter());

    await expect(port.read('a.key')).resolves.toBe('7');
    expect(storage.getItem).toHaveBeenCalledWith('a.key');
  });

  it('answers null for a key nothing was stored under', async () => {
    storage.getItem.mockResolvedValue(null);
    const port = createAsyncStoragePreferencesAdapter(createRecordingCrashReporter());

    await expect(port.read('missing')).resolves.toBeNull();
  });

  it('writes a value through', async () => {
    storage.setItem.mockResolvedValue();
    const port = createAsyncStoragePreferencesAdapter(createRecordingCrashReporter());

    await port.write('a.key', '1');

    expect(storage.setItem).toHaveBeenCalledWith('a.key', '1');
  });

  // A failed read degrades into a case every caller already handles, rather
  // than an exception they do not.
  it('reports a read it could not do, and answers null', async () => {
    storage.getItem.mockRejectedValue(new Error('disk gone'));
    const crash = createRecordingCrashReporter();

    await expect(
      createAsyncStoragePreferencesAdapter(crash).read('a.key'),
    ).resolves.toBeNull();
    expect(crash.reports).toEqual([
      { message: 'disk gone', context: 'preferences: could not read a.key' },
    ]);
  });

  // A write that fails silently makes a one-time screen show every launch,
  // which looks broken rather than merely unlucky.
  it('reports a write it could not do', async () => {
    storage.setItem.mockRejectedValue(new Error('full'));
    const crash = createRecordingCrashReporter();

    await expect(
      createAsyncStoragePreferencesAdapter(crash).write('a.key', '1'),
    ).resolves.toBeUndefined();
    expect(crash.reports).toEqual([
      { message: 'full', context: 'preferences: could not write a.key' },
    ]);
  });
});
