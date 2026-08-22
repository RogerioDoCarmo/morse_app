import { Camera } from 'expo-camera';
import type { ITorchPort } from '@/core/ports';

/**
 * The torch is a `CameraView` **prop** in expo-camera, not an imperative call,
 * so it can only be driven by a mounted view. This adapter therefore holds the
 * requested state and lets exactly one mounted view observe it — the view stays
 * in the UI layer, the decision to switch stays behind the port.
 */
export type TorchAdapter = ITorchPort &
  Readonly<{
    /** Subscribes a mounted camera view to the requested torch state. */
    subscribe: (listener: (enabled: boolean) => void) => () => void;
  }>;

export function createExpoTorchAdapter(): TorchAdapter {
  const listeners = new Set<(enabled: boolean) => void>();
  let enabled = false;

  const emit = (): void => {
    for (const listener of listeners) listener(enabled);
  };

  return {
    async isAvailable() {
      const { granted } = await Camera.getCameraPermissionsAsync();
      return granted;
    },
    async setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      emit();
    },
    async release() {
      if (!enabled) return;
      enabled = false;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(enabled);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
