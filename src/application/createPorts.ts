import { createExpoAudioAdapter } from '@/adapters/audio/expoAudioAdapter';
import { createExpoClipboardAdapter } from '@/adapters/clipboard/expoClipboardAdapter';
import { createFirebaseCrashReportingAdapter } from '@/adapters/crash/firebaseCrashReportingAdapter';
import { createExpoKeepAwakeAdapter } from '@/adapters/keepAwake/expoKeepAwakeAdapter';
import { createNoopCrashReportingAdapter } from '@/adapters/crash/noopCrashReportingAdapter';
import { createExpoLocalizationAdapter } from '@/adapters/locale/expoLocalizationAdapter';
import { createExpoPermissionAdapter } from '@/adapters/permission/expoPermissionAdapter';
import { createAsyncStoragePreferencesAdapter } from '@/adapters/preferences/asyncStoragePreferencesAdapter';
import { createExpoSpeechRecognitionAdapter } from '@/adapters/speech/expoSpeechRecognitionAdapter';
import { createUnavailableSpeechRecognitionAdapter } from '@/adapters/speech/unavailableSpeechRecognitionAdapter';
import { BUNDLED_FEATURES } from '@/application/providers/BuildFeaturesProvider';
import {
  createExpoTorchAdapter,
  type TorchAdapter,
} from '@/adapters/torch/expoTorchAdapter';
import { createExpoSpeechAdapter } from '@/adapters/tts/expoSpeechAdapter';
import { createPlatformVibrationAdapter } from '@/adapters/vibration/platformVibrationAdapter';
import { createNativeVolumeAdapter } from '@/adapters/volume/nativeVolumeAdapter';
import type { BuildFeatures } from '@/core/domain/buildFeatures';
import type { ICrashReportingPort, Ports } from '@/core/ports';

/**
 * Crashlytics when this build has crash reporting AND it is configured; the
 * no-op reporter otherwise.
 *
 * ⚠️ The switch is checked BEFORE the Firebase adapter is built, not after.
 * In a build that leaves crash reporting out, `@react-native-firebase/*` is
 * not installed and Metro resolves it to an empty module; constructing the
 * adapter there would be the one call that reads it.
 */
function selectCrashReporting(features: BuildFeatures): ICrashReportingPort {
  if (!features.crashReporting) return createNoopCrashReportingAdapter();
  const firebaseCrash = createFirebaseCrashReportingAdapter();
  return firebaseCrash.isEnabled() ? firebaseCrash : createNoopCrashReportingAdapter();
}

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
 *
 * `features` says what this build contains — every feature in the store
 * build, less in the F-Droid one. A feature the build leaves out gets an
 * adapter that never touches its native module, because that module is not in
 * the APK. Taken as a parameter so both builds can be tested; the app passes
 * nothing.
 */
export function createPorts(
  features: BuildFeatures = BUNDLED_FEATURES,
): Readonly<{ ports: Ports; torch: TorchAdapter }> {
  const crash = selectCrashReporting(features);
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
      volume: createNativeVolumeAdapter(crash),
      preferences: createAsyncStoragePreferencesAdapter(crash),
      clipboard: createExpoClipboardAdapter(),
      tts: createExpoSpeechAdapter(crash),
      speech: features.speechInput
        ? createExpoSpeechRecognitionAdapter(crash)
        : createUnavailableSpeechRecognitionAdapter(),
      locale: createExpoLocalizationAdapter(),
      permission: createExpoPermissionAdapter(),
      crash,
    },
  };
}
