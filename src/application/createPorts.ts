import { createExpoAudioAdapter } from '@/adapters/audio/expoAudioAdapter';
import { createFirebaseCrashReportingAdapter } from '@/adapters/crash/firebaseCrashReportingAdapter';
import { createExpoKeepAwakeAdapter } from '@/adapters/keepAwake/expoKeepAwakeAdapter';
import { createNoopCrashReportingAdapter } from '@/adapters/crash/noopCrashReportingAdapter';
import { createExpoLocalizationAdapter } from '@/adapters/locale/expoLocalizationAdapter';
import { createExpoPermissionAdapter } from '@/adapters/permission/expoPermissionAdapter';
import { createAsyncStoragePreferencesAdapter } from '@/adapters/preferences/asyncStoragePreferencesAdapter';
import { createExpoSpeechRecognitionAdapter } from '@/adapters/speech/expoSpeechRecognitionAdapter';
import {
  createExpoTorchAdapter,
  type TorchAdapter,
} from '@/adapters/torch/expoTorchAdapter';
import { createExpoSpeechAdapter } from '@/adapters/tts/expoSpeechAdapter';
import { createPlatformVibrationAdapter } from '@/adapters/vibration/platformVibrationAdapter';
import type { Ports } from '@/core/ports';

/**
 * The composition root — the one place that knows which adapter implements
 * which port. Nothing above this line imports an `expo-*` package.
 *
 * The torch adapter is returned alongside the ports because the torch is a
 * camera-view prop rather than an imperative API, so a host component has to
 * observe it. See {@link TorchAdapter}.
 *
 * Crash reporting picks itself: the Firebase adapter reports its own
 * availability, and a checkout without `google-services.json` gets the no-op
 * one. That keeps local development, CI and any Firebase-free build behaving
 * identically to a configured one rather than erroring at startup.
 */
export function createPorts(): Readonly<{ ports: Ports; torch: TorchAdapter }> {
  const firebaseCrash = createFirebaseCrashReportingAdapter();
  const crash = firebaseCrash.isEnabled()
    ? firebaseCrash
    : createNoopCrashReportingAdapter();
  // Built after `crash` because both take it: adapters report through the
  // port, never by reaching for a sibling adapter.
  const torch = createExpoTorchAdapter(crash);

  return {
    torch,
    ports: {
      torch,
      audio: createExpoAudioAdapter(crash),
      keepAwake: createExpoKeepAwakeAdapter(crash),
      vibration: createPlatformVibrationAdapter(crash),
      preferences: createAsyncStoragePreferencesAdapter(crash),
      tts: createExpoSpeechAdapter(crash),
      speech: createExpoSpeechRecognitionAdapter(crash),
      locale: createExpoLocalizationAdapter(),
      permission: createExpoPermissionAdapter(),
      crash,
    },
  };
}
