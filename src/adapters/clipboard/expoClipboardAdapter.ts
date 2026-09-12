import * as Clipboard from 'expo-clipboard';

import type { IClipboardPort } from '@/core/ports';

/**
 * The clipboard, via `expo-clipboard`.
 *
 * ⚠️ Every failure is swallowed into `false`. A clipboard write is not worth
 * crashing a translator over, and the screen's response to a refusal is the
 * same as its response to a thrown error: say nothing happened. Reporting the
 * difference would give the user a distinction they cannot act on.
 */
export function createExpoClipboardAdapter(): IClipboardPort {
  return {
    async read(): Promise<string | null> {
      try {
        const text = await Clipboard.getStringAsync();
        // ⚠️ An empty string is "nothing to paste", not a value. Pasting it
        // would silently wipe what the user had typed, which is the one
        // outcome a Paste button must never produce.
        return text.length > 0 ? text : null;
      } catch {
        return null;
      }
    },

    async write(text: string): Promise<boolean> {
      try {
        // ⚠️ `setStringAsync` RETURNS whether it worked — it does not throw on
        // a plain refusal. Ignoring that and returning `true` on anything that
        // did not throw would report success for a write the platform
        // declined, which is the one answer the caller must not be given.
        return await Clipboard.setStringAsync(text);
      } catch {
        return false;
      }
    },
  };
}
