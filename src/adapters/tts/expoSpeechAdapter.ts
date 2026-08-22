import * as Speech from 'expo-speech';
import type { AppLocale } from '@/core/domain/locale';
import type { ITextToSpeechPort } from '@/core/ports';

/** App locale → the BCP-47 tag the platform voices are registered under. */
const VOICE_TAG: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es-ES',
});

/** Reads decoded text aloud. Output only, so it needs no permission. */
export function createExpoSpeechAdapter(): ITextToSpeechPort {
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
          onError: () => resolve(),
        });
      });
    },
    async stop() {
      await Speech.stop();
    },
  };
}
