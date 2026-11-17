import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import type { AppLocale } from '@/core/domain/locale';
import type { ICrashReportingPort, ISpeechRecognitionPort } from '@/core/ports';

/**
 * App locale → the BCP-47 tag a recogniser is registered under.
 *
 * Deliberately not shared with the text-to-speech table: they are different
 * catalogues on both platforms, and a device can easily have a voice for a
 * language it cannot recognise.
 */
const RECOGNITION_TAG: Readonly<Record<AppLocale, string>> = Object.freeze({
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es-ES',
});

/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/**
 * Whether `tag` is covered by a device locale, comparing only the language.
 *
 * A device that recognises `en-GB` can recognise English; refusing because the
 * table happens to say `en-US` would turn a working recogniser into an
 * unavailable one.
 */
const covers = (available: string, tag: string): boolean => {
  const language = (value: string): string =>
    value.toLowerCase().replace('_', '-').split('-')[0] ?? '';
  return language(available) === language(tag);
};

/**
 * Turns speech into text through expo-speech-recognition.
 *
 * Takes {@link ICrashReportingPort} — the interface, not the Firebase adapter,
 * so this file never learns that Firebase exists and its tests stay free of it.
 */
export function createExpoSpeechRecognitionAdapter(
  crash: ICrashReportingPort,
): ISpeechRecognitionPort {
  return {
    async isAvailable(locale) {
      // ⚠️ Android listens through the recogniser the user picked in the
      // system settings, and the locale list below cannot speak for it: on 13+
      // it asks the on-device recogniser (absent without Google's services),
      // and on 12 and older it is always empty. Whether ANY recogniser exists
      // is the only question Android can answer up front; a language that one
      // lacks comes back from start() as `language-not-supported`.
      if (Platform.OS === 'android') {
        return ExpoSpeechRecognitionModule.isRecognitionAvailable();
      }
      try {
        const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
        return locales.some((available) => covers(available, RECOGNITION_TAG[locale]));
      } catch (error) {
        // Not every device answers this. Reporting unavailable is the honest
        // answer, and the UI already has to handle it.
        await crash.recordError(asError(error), 'speech: could not list locales');
        return false;
      }
    },

    async start(locale, onResult, onError) {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        onError('permission');
        return () => undefined;
      }

      const subscriptions = [
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const transcript = event.results[0]?.transcript ?? '';
          onResult({ transcript, isFinal: event.isFinal });
        }),
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          onError(event.error === 'language-not-supported' ? 'language' : event.error);
        }),
      ];

      try {
        ExpoSpeechRecognitionModule.start({
          lang: RECOGNITION_TAG[locale],
          // Partials are what make the transcript appear as the user speaks
          // rather than in one lump at the end.
          interimResults: true,
          // One utterance. A translator is given a message, not dictation.
          continuous: false,
        });
      } catch (error) {
        subscriptions.forEach((subscription) => {
          subscription.remove();
        });
        await crash.recordError(asError(error), 'speech: could not start listening');
        onError('start');
        return () => undefined;
      }

      return () => {
        subscriptions.forEach((subscription) => {
          subscription.remove();
        });
        // abort, not stop: unsubscribing means the caller has stopped caring,
        // so a final result would arrive with nowhere to go.
        ExpoSpeechRecognitionModule.abort();
      };
    },

    async stop() {
      try {
        // stop, not abort: this is the user saying they have finished
        // speaking, and the final transcript is exactly what they want.
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        await crash.recordError(asError(error), 'speech: could not stop listening');
      }
    },
  };
}
