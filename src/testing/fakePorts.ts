import type { AppLocale } from '@/core/domain/locale';
import type { PermissionKind, PermissionState } from '@/core/domain/permission';
import type { Ports } from '@/core/ports';

/** A recording fake for every port, so screens can be tested without Expo. */
export type FakePorts = Ports &
  Readonly<{
    calls: {
      torchEnabled: boolean[];
      spoken: { text: string; locale: AppLocale }[];
      played: Uint8Array[];
      awake: boolean[];
      audioStopped: number;
      requested: PermissionKind[];
      settingsOpened: number;
      recorded: { message: string; context?: string }[];
      crashCollection: boolean[];
    };
  }>;

/** Builds fake ports. Override any piece per test. */
export function createFakePorts(
  overrides: Partial<Ports> = {},
  initialPermission: PermissionState = { granted: true, canAskAgain: false },
): FakePorts {
  const calls: FakePorts['calls'] = {
    torchEnabled: [],
    spoken: [],
    played: [],
    awake: [],
    audioStopped: 0,
    requested: [],
    settingsOpened: 0,
    recorded: [],
    crashCollection: [],
  };

  const base: Ports = {
    torch: {
      isAvailable: async () => true,
      setEnabled: async (enabled) => {
        calls.torchEnabled.push(enabled);
      },
      release: async () => {
        calls.torchEnabled.push(false);
      },
    },
    audio: {
      play: async (wav) => {
        calls.played.push(wav);
      },
      stop: async () => {
        calls.audioStopped += 1;
      },
    },
    keepAwake: {
      activate: async () => {
        calls.awake.push(true);
      },
      release: async () => {
        calls.awake.push(false);
      },
    },
    tts: {
      speak: async (text, locale) => {
        calls.spoken.push({ text, locale });
      },
      stop: async () => undefined,
    },
    speech: {
      isAvailable: async () => false,
      start: async () => () => undefined,
      stop: async () => undefined,
    },
    locale: {
      getDeviceLocale: () => 'en',
    },
    crash: {
      isEnabled: () => true,
      setEnabled: async (enabled) => {
        calls.crashCollection.push(enabled);
      },
      recordError: async (error, context) => {
        calls.recorded.push(
          context === undefined
            ? { message: error.message }
            : { message: error.message, context },
        );
      },
      log: async (message) => {
        calls.recorded.push({ message });
      },
    },
    permission: {
      getState: async () => initialPermission,
      request: async (kind) => {
        calls.requested.push(kind);
        return { granted: true, canAskAgain: false };
      },
      openSettings: async () => {
        calls.settingsOpened += 1;
      },
    },
  };

  return { ...base, ...overrides, calls };
}
