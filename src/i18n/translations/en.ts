import type { TranslationMap } from '../keys';

/** English — the default, and the reference for the other locales. */
export const en: TranslationMap = {
  'app.name': 'Morse',
  'nav.translate': 'Translate',
  'nav.speak': 'Speak',
  'nav.tap': 'Tap',
  'nav.learn': 'Learn',
  'translator.toMorse': 'Text → Morse',
  'translator.toText': 'Morse → Text',
  'translator.sourceLabel': 'English',
  'translator.morseLabel': 'Morse',
  'translator.hint': 'Tap a letter to hear it',
  // Seed content, so the screen demonstrates itself on first open.
  'translator.sample': 'Hello world',
  'translator.speak': 'Speak',
  'translator.tapItIn': 'Tap it in',
  'translator.readAloud': 'Read aloud',
  'translator.flash': 'Flash it',
  'translator.copy': 'Copy',
  'translator.play': 'Play',
  'settings.title': 'Settings',
  'settings.cutoff': 'Dot / dash cut-off',
  'settings.cutoffHint':
    'Hold the key longer than this and it counts as a dash. “Long” depends on your speed, so set it to suit you.',
  'settings.calibrate': 'Calibrate by tapping',
  'settings.language': 'App language',
  'settings.speechRecognition': 'Speech recognition',
  'settings.playbackSpeed': 'Playback speed',
  'settings.tone': 'Play a tone with the flash',
  'settings.readAloud': 'Read decoded text aloud',
  'language.title': 'Language',
  'language.interface': 'Interface',
  'language.matchInterface': 'Match the interface',
  'language.footnote':
    'Which languages the microphone can recognise depends on what your device has installed. The interface itself is fully translated either way.',
  'permission.cameraTitle': 'Flash output',
  'permission.cameraRationale':
    'Playing a message as light means switching the camera flash on and off. Android and iOS both put the torch behind the camera permission — there is no separate one.',
  'permission.cameraAssurance':
    'The camera preview is never opened and no image is ever captured. Only the torch is switched.',
  'permission.cameraGrant': 'Allow camera access',
  'permission.microphoneTitle': 'Speech input',
  'permission.microphoneRationale':
    'To turn what you say into Morse, the app has to hear you. Typing and tap input work without this, so you can skip it.',
  'permission.microphoneAssurance':
    'Recognition runs on the device where the platform supports it. No audio is stored, and no audio is ever uploaded.',
  'permission.microphoneGrant': 'Allow microphone access',
  'permission.blockedHint':
    'This stays off until you grant access in the system settings. Everything else in the app keeps working.',
  'permission.openSettings': 'Open Settings',
  'permission.notNow': 'Not now',
};
