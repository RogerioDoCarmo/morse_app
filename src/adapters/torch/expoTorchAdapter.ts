import { Camera } from 'expo-camera';
import type { ICrashReportingPort, ITorchPort } from '@/core/ports';

/**
 * The torch is a `CameraView` **prop** in expo-camera, not an imperative call,
 * so it can only be driven by a mounted view. This adapter therefore holds the
 * requested state and lets exactly one mounted view observe it — the view stays
 * in the UI layer, the decision to switch stays behind the port.
 *
 * Crash reporting arrives as {@link ICrashReportingPort} — the INTERFACE, never
 * the Firebase adapter. An adapter depending on a sibling adapter would drag a
 * vendor SDK into this one's tests and point a dependency sideways instead of
 * inward; the composition root does the wiring.
 */
/** Non-Error throws are legal in JS; reports need a stack either way. */
const asError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

export type TorchAdapter = ITorchPort &
  Readonly<{
    /** Subscribes a mounted camera view to the requested torch state. */
    subscribe: (listener: (enabled: boolean) => void) => () => void;
  }>;

export function createExpoTorchAdapter(crash: ICrashReportingPort): TorchAdapter {
  const listeners = new Set<(enabled: boolean) => void>();
  let enabled = false;

  // Every call into a listener goes through here. `subscribe` seeds the new
  // listener with the current state immediately, and that call needs the same
  // guard as a later emit — a view that throws on mount would otherwise take
  // out whoever subscribed it.
  const notify = (listener: (enabled: boolean) => void): void => {
    try {
      listener(enabled);
    } catch (error) {
      // One misbehaving view must not stop the others from being told, nor
      // leave the caller of setEnabled with a rejected promise.
      void crash.recordError(asError(error), 'torch: notifying a mounted view');
    }
  };

  const emit = (): void => {
    for (const listener of listeners) notify(listener);
  };

  return {
    async isAvailable() {
      try {
        const { granted } = await Camera.getCameraPermissionsAsync();
        return granted;
      } catch (error) {
        // Treated as "no torch" rather than propagated: the caller only wants to
        // know whether it can flash, and a permissions read that throws is a
        // device-level oddity worth seeing in a report.
        await crash.recordError(asError(error), 'torch: reading camera permissions');
        return false;
      }
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
      notify(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
