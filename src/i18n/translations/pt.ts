import type { TranslationMap } from '../keys';

/** Brazilian Portuguese. */
export const ptBR: TranslationMap = {
  'app.name': 'Morse',
  'nav.translate': 'Traduzir',
  'nav.speak': 'Falar',
  'nav.tap': 'Tocar',
  'nav.learn': 'Aprender',
  'translator.toMorse': 'Texto → Morse',
  'translator.toText': 'Morse → Texto',
  'translator.sourceLabel': 'Português',
  'translator.morseLabel': 'Morse',
  'translator.hint': 'Toque numa letra para ouvi-la',
  // Sem acentos: o encoder dobra os que a ITU não define.
  'translator.sample': 'Boa noite',
  'translator.speak': 'Falar',
  'translator.tapItIn': 'Tocar',
  'translator.readAloud': 'Ler em voz alta',
  'translator.flash': 'Piscar',
  'translator.copy': 'Copiar',
  'translator.play': 'Tocar som',
  'settings.title': 'Ajustes',
  'settings.cutoff': 'Limite de ponto / traço',
  'settings.cutoffHint':
    'Segurar a tecla por mais tempo que isto conta como traço. “Longo” depende da sua velocidade, então ajuste como preferir.',
  'settings.calibrate': 'Calibrar tocando',
  'settings.language': 'Idioma do app',
  'settings.speechRecognition': 'Reconhecimento de fala',
  'settings.playbackSpeed': 'Velocidade de reprodução',
  'settings.tone': 'Tocar um som junto com o flash',
  'settings.readAloud': 'Ler o texto decodificado em voz alta',
  'language.title': 'Idioma',
  'language.interface': 'Interface',
  'language.matchInterface': 'Acompanhar a interface',
  'language.footnote':
    'Os idiomas que o microfone reconhece dependem do que está instalado no seu aparelho. A interface é totalmente traduzida de qualquer forma.',
  'permission.cameraTitle': 'Saída em flash',
  'permission.cameraRationale':
    'Reproduzir uma mensagem como luz significa ligar e desligar o flash da câmera. Android e iOS colocam a lanterna atrás da permissão de câmera — não existe uma separada.',
  'permission.cameraAssurance':
    'A prévia da câmera nunca é aberta e nenhuma imagem é capturada. Só a lanterna é acionada.',
  'permission.cameraGrant': 'Permitir acesso à câmera',
  'permission.microphoneTitle': 'Entrada por voz',
  'permission.microphoneRationale':
    'Para transformar o que você diz em Morse, o app precisa ouvir você. Digitar e tocar funcionam sem isto, então você pode pular.',
  'permission.microphoneAssurance':
    'O reconhecimento roda no aparelho onde a plataforma permite. Nenhum áudio é armazenado, e nenhum áudio é enviado.',
  'permission.microphoneGrant': 'Permitir acesso ao microfone',
  'permission.blockedHint':
    'Isto fica desativado até você liberar o acesso nos ajustes do sistema. O resto do app continua funcionando.',
  'permission.openSettings': 'Abrir ajustes',
  'permission.notNow': 'Agora não',
};
