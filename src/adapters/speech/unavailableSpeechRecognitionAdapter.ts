import type { ISpeechRecognitionPort } from '@/core/ports';

/**
 * Speech recognition, not yet wired to a native module.
 *
 * Expo ships no first-party recogniser, so the module choice is deliberately
 * deferred to the feature branch that builds the Speak screen. Reporting
 * "unavailable" is the honest answer in the meantime — the same answer a real
 * device gives when the locale's recogniser is not installed — so the UI has
 * to handle this path anyway and gets exercised from day one.
 */
export function createUnavailableSpeechRecognitionAdapter(): ISpeechRecognitionPort {
  return {
    async isAvailable() {
      return false;
    },
    async start() {
      throw new Error('Speech recognition is not available on this device.');
    },
    async stop() {
      /* nothing is running */
    },
  };
}
