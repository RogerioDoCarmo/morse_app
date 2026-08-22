import type { TranslationMap } from '../keys';

/** Spanish. */
export const es: TranslationMap = {
  'app.name': 'Morse',
  'nav.translate': 'Traducir',
  'nav.speak': 'Hablar',
  'nav.tap': 'Pulsar',
  'nav.learn': 'Aprender',
  'translator.toMorse': 'Texto → Morse',
  'translator.toText': 'Morse → Texto',
  'translator.sourceLabel': 'Español',
  'translator.morseLabel': 'Morse',
  'translator.hint': 'Toca una letra para oírla',
  'translator.speak': 'Hablar',
  'translator.tapItIn': 'Pulsar',
  'translator.readAloud': 'Leer en voz alta',
  'translator.flash': 'Destellar',
  'translator.copy': 'Copiar',
  'translator.play': 'Reproducir',
  'settings.title': 'Ajustes',
  'settings.cutoff': 'Umbral de punto / raya',
  'settings.cutoffHint':
    'Mantener la tecla más tiempo que esto cuenta como raya. «Largo» depende de tu velocidad, así que ajústalo a tu gusto.',
  'settings.calibrate': 'Calibrar pulsando',
  'settings.language': 'Idioma de la aplicación',
  'settings.speechRecognition': 'Reconocimiento de voz',
  'settings.playbackSpeed': 'Velocidad de reproducción',
  'settings.tone': 'Reproducir un tono con el destello',
  'settings.readAloud': 'Leer el texto decodificado en voz alta',
  'language.title': 'Idioma',
  'language.interface': 'Interfaz',
  'language.matchInterface': 'Seguir la interfaz',
  'language.footnote':
    'Los idiomas que el micrófono reconoce dependen de lo que tenga instalado tu dispositivo. La interfaz está totalmente traducida en cualquier caso.',
  'permission.cameraTitle': 'Salida por destello',
  'permission.cameraRationale':
    'Reproducir un mensaje como luz significa encender y apagar el flash de la cámara. Android e iOS ponen la linterna detrás del permiso de cámara — no hay uno aparte.',
  'permission.cameraAssurance':
    'La vista previa de la cámara nunca se abre y no se captura ninguna imagen. Solo se acciona la linterna.',
  'permission.cameraGrant': 'Permitir acceso a la cámara',
  'permission.microphoneTitle': 'Entrada por voz',
  'permission.microphoneRationale':
    'Para convertir lo que dices en Morse, la aplicación tiene que oírte. Escribir y pulsar funcionan sin esto, así que puedes omitirlo.',
  'permission.microphoneAssurance':
    'El reconocimiento se ejecuta en el dispositivo donde la plataforma lo permite. No se guarda audio ni se sube nada.',
  'permission.microphoneGrant': 'Permitir acceso al micrófono',
  'permission.blockedHint':
    'Esto seguirá desactivado hasta que concedas el acceso en los ajustes del sistema. El resto de la aplicación sigue funcionando.',
  'permission.openSettings': 'Abrir ajustes',
  'permission.notNow': 'Ahora no',
};
