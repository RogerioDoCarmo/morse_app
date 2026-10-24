import type { ISpeechRecognitionPort } from '@/core/ports';

/**
 * A recogniser that is never available.
 *
 * Used by a build that leaves speech input out (`speechInput` off in
 * `buildFeatures.ts`). Nothing should reach it — that build has no Speak tab
 * and no Speak button — but `Ports` still needs a `speech`, and an adapter
 * that cannot hear is a better answer than one whose native module is not in
 * the APK. It never touches `expo-speech-recognition`, so it is safe to build
 * when that package is not installed.
 */
export function createUnavailableSpeechRecognitionAdapter(): ISpeechRecognitionPort {
  return {
    isAvailable: async () => false,
    start: async (_locale, _onResult, onError) => {
      onError('unavailable');
      return () => undefined;
    },
    stop: async () => undefined,
  };
}
