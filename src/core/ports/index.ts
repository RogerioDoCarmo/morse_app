export type { ITorchPort } from './ITorchPort';
export type { ITextToSpeechPort } from './ITextToSpeechPort';
export type { ISpeechRecognitionPort, SpeechResult } from './ISpeechRecognitionPort';
export type { ILocalePort } from './ILocalePort';
export type { IPermissionPort } from './IPermissionPort';

import type { ILocalePort } from './ILocalePort';
import type { IPermissionPort } from './IPermissionPort';
import type { ISpeechRecognitionPort } from './ISpeechRecognitionPort';
import type { ITextToSpeechPort } from './ITextToSpeechPort';
import type { ITorchPort } from './ITorchPort';

/**
 * Everything the UI layer is allowed to reach the outside world through.
 *  Injected once at the root; screens and hooks never import an adapter.
 */
export type Ports = Readonly<{
  torch: ITorchPort;
  tts: ITextToSpeechPort;
  speech: ISpeechRecognitionPort;
  locale: ILocalePort;
  permission: IPermissionPort;
}>;
