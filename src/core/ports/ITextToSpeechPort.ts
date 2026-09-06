import type { AppLocale } from '../domain/locale';

/** Reads decoded text aloud. Output only — needs no permission. */
export interface ITextToSpeechPort {
  /** Speaks `text` in `locale`. Resolves when speech finishes or is stopped. */
  speak(text: string, locale: AppLocale): Promise<void>;
  /** Stops immediately. Safe to call when nothing is speaking. */
  stop(): Promise<void>;
}
