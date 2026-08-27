import * as Speech from 'expo-speech';
import type { AppLocale } from '@/core/domain/locale';
import type { ICrashReportingPort, ITextToSpeechPort } from '@/core/ports';

/** App locale → the BCP-47 tag the platform voices are registered under. */
const VOICE_TAG: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es-ES',
});

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Reads decoded text aloud. Output only, so it needs no permission.
 *
 * Takes {@link ICrashReportingPort} — the interface, not the Firebase adapter,
 * so this file never learns that Firebase exists and its tests stay free of it.
 */
export function createExpoSpeechAdapter(crash: ICrashReportingPort): ITextToSpeechPort {
  return {
    speak(text, locale) {
      if (text.trim() === '') return Promise.resolve();

      return new Promise<void>((resolve) => {
        Speech.speak(text, {
          language: VOICE_TAG[locale],
          // Resolving on stop as well as done means a caller awaiting speech
          // is never left hanging when the user interrupts it.
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: (error) => {
            // Still resolves — a caller awaiting speech must not hang because the
            // voice failed. But the error used to be discarded outright, which is
            // exactly the silent failure crash reporting exists to catch: a
            // missing voice for a locale looks identical to speech that worked.
            void crash.recordError(asError(error), 'tts: speaking failed');
            resolve();
          },
        });
      });
    },
    async stop() {
      try {
        await Speech.stop();
      } catch (error) {
        // Stopping is best-effort; the caller has already moved on.
        await crash.recordError(asError(error), 'tts: stopping failed');
      }
    },
  };
}
