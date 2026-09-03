export type { ITorchPort } from './ITorchPort';
export type { IAudioPlaybackPort } from './IAudioPlaybackPort';
export type { IKeepAwakePort } from './IKeepAwakePort';
export type { ITextToSpeechPort } from './ITextToSpeechPort';
export type { ISpeechRecognitionPort, SpeechResult } from './ISpeechRecognitionPort';
export type { ILocalePort } from './ILocalePort';
export type { IPermissionPort } from './IPermissionPort';

import type { ILocalePort } from './ILocalePort';
import type { IPermissionPort } from './IPermissionPort';
import type { ISpeechRecognitionPort } from './ISpeechRecognitionPort';
import type { ITextToSpeechPort } from './ITextToSpeechPort';
import type { ITorchPort } from './ITorchPort';
import type { IAudioPlaybackPort } from './IAudioPlaybackPort';
import type { IKeepAwakePort } from './IKeepAwakePort';
import type { ICrashReportingPort } from './ICrashReportingPort';

/**
 * Everything the UI layer is allowed to reach the outside world through.
 *  Injected once at the root; screens and hooks never import an adapter.
 */
export type Ports = Readonly<{
  torch: ITorchPort;
  audio: IAudioPlaybackPort;
  keepAwake: IKeepAwakePort;
  tts: ITextToSpeechPort;
  speech: ISpeechRecognitionPort;
  locale: ILocalePort;
  permission: IPermissionPort;
  crash: ICrashReportingPort;
}>;
export type { ICrashReportingPort } from './ICrashReportingPort';
