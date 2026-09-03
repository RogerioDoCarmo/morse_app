/**
 * Every user-facing string in the app, as a closed union.
 *
 * `TranslationMap` is `Record<TranslationKey, string>`, so a locale file that
 * omits a key **fails the build** rather than falling back to English at
 * runtime. With three locales that matters more, not less: a silent English
 * fallback in a Spanish UI is the exact bug this type exists to prevent.
 */
export type TranslationKey =
  | 'app.name'
  | 'nav.translate'
  | 'nav.speak'
  | 'nav.tap'
  | 'nav.learn'
  | 'translator.toMorse'
  | 'translator.toText'
  | 'translator.sourceLabel'
  | 'translator.morseLabel'
  | 'translator.hint'
  | 'translator.sample'
  | 'translator.speak'
  | 'translator.tapItIn'
  | 'translator.readAloud'
  | 'translator.flash'
  | 'translator.copy'
  | 'translator.play'
  | 'translator.playing'
  | 'translator.unsupported'
  | 'settings.title'
  | 'settings.cutoff'
  | 'settings.cutoffHint'
  | 'settings.calibrate'
  | 'settings.language'
  | 'settings.speechRecognition'
  | 'settings.playbackSpeed'
  | 'settings.tone'
  | 'settings.readAloud'
  | 'language.title'
  | 'language.interface'
  | 'language.matchInterface'
  | 'language.footnote'
  | 'permission.cameraTitle'
  | 'permission.cameraRationale'
  | 'permission.cameraAssurance'
  | 'permission.cameraGrant'
  | 'permission.microphoneTitle'
  | 'permission.microphoneRationale'
  | 'permission.microphoneAssurance'
  | 'permission.microphoneGrant'
  | 'permission.blockedHint'
  | 'permission.openSettings'
  | 'permission.notNow';

/** A complete set of translations. Missing a key is a compile error. */
export type TranslationMap = Record<TranslationKey, string>;
