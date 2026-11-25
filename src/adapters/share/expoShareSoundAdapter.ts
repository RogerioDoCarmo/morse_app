import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ICrashReportingPort, IShareSoundPort } from '@/core/ports';

/**
 * The name the recipient sees.
 *
 * ⚠️ Always the same, never derived from the message: chat apps show a file's
 * name beside it, so a name built from the text would send the message twice,
 * once in plain words. It also tells the recipient where the sound came from.
 */
export const SHARED_SOUND_NAME = 'OmniMorse.wav';

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Shares Morse audio through `expo-sharing`.
 *
 * The bytes go to a cache file first, because both platforms' share sheets
 * take a file, not a buffer. Android serves it to the receiving app through
 * expo-sharing's own FileProvider, which already covers the cache directory.
 *
 * ⚠️ The file is NOT deleted after the sheet closes. `shareAsync` resolves
 * when the sheet goes away, which can be before the receiving app has finished
 * reading the file; deleting it then can hand the recipient an empty or broken
 * clip. The next share overwrites it, and the system reclaims the cache.
 */
export function createExpoShareSoundAdapter(crash: ICrashReportingPort): IShareSoundPort {
  return {
    async share(wav, title) {
      try {
        if (!(await Sharing.isAvailableAsync())) return 'unavailable';

        const file = new File(Paths.cache, SHARED_SOUND_NAME);
        file.create({ overwrite: true });
        file.write(wav);

        await Sharing.shareAsync(file.uri, {
          mimeType: 'audio/wav',
          UTI: 'com.microsoft.waveform-audio',
          dialogTitle: title,
        });
        return 'shared';
      } catch (error) {
        await crash.recordError(asError(error), 'share: offering the sound failed');
        return 'failed';
      }
    },
  };
}
