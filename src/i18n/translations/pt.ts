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
  'translator.copy': 'Copiar',
  'translator.play': 'Tocar som',
  'translator.playing': 'Tocando',
  'translator.unsupported': 'Sem código: {{chars}}',
  'translator.signal': 'Emitir',
  'translator.stop': 'Parar',
  'firstRun.skip': 'Pular',
  'firstRun.next': 'Avançar',
  'firstRun.start': 'Começar',
  'firstRun.oneTitle': 'Escreva e veja',
  'firstRun.oneBody':
    'Tudo que você escreve vira Morse na hora, letra por letra. Também funciona ao contrário: toque os pontos e traços e receba as palavras.',
  'firstRun.twoTitle': 'Escolha como sai',
  'firstRun.twoBody':
    'O som está ligado. A luz fica desligada até você ligá-la, porque a lanterna precisa da câmera. Tela e vibração também estão ali. Mude qualquer uma a qualquer momento, mesmo com uma mensagem em andamento.',
  'firstRun.threeTitle': 'Ouça uma letra por vez',
  'firstRun.threeBody':
    'Toque em qualquer letra para ouvir só ela. É o jeito mais rápido de aprender o ritmo, e a aba Aprender tem o alfabeto inteiro quando você quiser.',
  'speech.tapToSpeak': 'Toque para falar',
  'speech.listening': 'Ouvindo…',
  'speech.gotIt': 'Entendi',
  'speech.idleHint': 'Diga uma palavra ou uma frase curta — ela vira Morse.',
  'speech.listeningHint': 'Toque de novo quando terminar.',
  'speech.doneHint': 'Toque no microfone para gravar de novo.',
  'speech.heard': 'Ouvido',
  'speech.unavailable': 'Este aparelho não reconhece este idioma.',
  'speech.denied': 'O Morse precisa do microfone para ouvir você.',
  'speech.failed': 'O reconhecedor parou. Toque para tentar de novo.',
  'translator.channelSound': 'Som',
  'translator.channelLight': 'Luz',
  'translator.channelScreen': 'Tela',
  'translator.channelBuzz': 'Vibrar',
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
