import { createExpoLocalizationAdapter } from '@/adapters/locale/expoLocalizationAdapter';
import { createExpoPermissionAdapter } from '@/adapters/permission/expoPermissionAdapter';
import { createUnavailableSpeechRecognitionAdapter } from '@/adapters/speech/unavailableSpeechRecognitionAdapter';
import {
  createExpoTorchAdapter,
  type TorchAdapter,
} from '@/adapters/torch/expoTorchAdapter';
import { createExpoSpeechAdapter } from '@/adapters/tts/expoSpeechAdapter';
import type { Ports } from '@/core/ports';

/**
 * The composition root — the one place that knows which adapter implements
 * which port. Nothing above this line imports an `expo-*` package.
 *
 * The torch adapter is returned alongside the ports because the torch is a
 * camera-view prop rather than an imperative API, so a host component has to
 * observe it. See {@link TorchAdapter}.
 */
export function createPorts(): Readonly<{ ports: Ports; torch: TorchAdapter }> {
  const torch = createExpoTorchAdapter();

  return {
    torch,
    ports: {
      torch,
      tts: createExpoSpeechAdapter(),
      speech: createUnavailableSpeechRecognitionAdapter(),
      locale: createExpoLocalizationAdapter(),
      permission: createExpoPermissionAdapter(),
    },
  };
}
