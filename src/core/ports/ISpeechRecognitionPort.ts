import type { AppLocale } from '../domain/locale';

/**
 * A single recognition result. `isFinal` distinguishes a live partial from
 *  the transcript the recogniser has committed to.
 */
export type SpeechResult = Readonly<{ transcript: string; isFinal: boolean }>;

/**
 * Turns speech into text. Unavailable in CI and on devices without the
 *  recogniser installed, which is exactly why it sits behind a port.
 */
export interface ISpeechRecognitionPort {
  /** True when this device can recognise `locale`. */
  isAvailable(locale: AppLocale): Promise<boolean>;
  /**
   * Starts listening. Returns an unsubscribe that also stops recognition.
   *
   * `onError` reasons: `permission` (microphone refused), `language` (the
   * recogniser cannot do this locale, which on Android is only known once
   * asked), `start` (it would not start), or the recogniser's own code.
   */
  start(
    locale: AppLocale,
    onResult: (result: SpeechResult) => void,
    onError: (reason: string) => void,
  ): Promise<() => void>;
  /** Stops listening without discarding the transcript so far. */
  stop(): Promise<void>;
}
