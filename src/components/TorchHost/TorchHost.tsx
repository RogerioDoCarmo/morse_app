import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import type { TorchAdapter, TorchState } from '@/adapters/torch/expoTorchAdapter';

/**
 * How large the hidden camera is, and how far off screen it sits.
 *
 * Big enough that a camera will negotiate a preview for it — 1x1 is not a size
 * any HAL offers — and far enough out that the surface never lands in the
 * visible region.
 */
const HIDDEN = 120;

const AT_REST: TorchState = { active: false, enabled: false };

/**
 * Drives the real torch.
 *
 * expo-camera exposes the torch only as a `CameraView` prop, so something has
 * to be mounted for it to switch. This host subscribes to the torch adapter and
 * mounts a camera **while a run is holding one**, switching `enableTorch` on
 * the camera that is already there.
 *
 * ⚠️ MOUNTING PER MARK IS THE BUG THIS EXISTS TO AVOID, and it was the second
 * report from the same Poco X5 5G.
 *
 * The first version mounted the camera whenever the torch was ON, which at
 * 15 wpm means opening and closing one every 80ms. A camera does not open in
 * 80ms — so the torch barely lit — and every mount put a fresh SurfaceView
 * through the compositor, which is what the black rectangle blinking across
 * half the display actually was. Moving it off screen moved the rectangle from
 * the bottom half to the top; it did not stop it, because the flicker was the
 * mounting, not the position.
 *
 * ⚠️ It is ALSO hidden by being off screen rather than transparent. A camera
 * preview is a SurfaceView: it draws straight to its own hardware layer, so a
 * parent's opacity does not touch it.
 */
export function TorchHost({
  adapter,
}: Readonly<{ adapter: TorchAdapter }>): React.JSX.Element | null {
  const [torch, setTorch] = useState<TorchState>(AT_REST);

  useEffect(() => adapter.subscribe(setTorch), [adapter]);

  // `active` is the run holding the camera; `enabled` alone covers anything
  // that lights the torch without having asked for a camera first.
  if (!torch.active && !torch.enabled) return null;

  return (
    <View style={styles.host} pointerEvents="none" testID="torch-host">
      <CameraView style={styles.camera} enableTorch={torch.enabled} facing="back" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Off the edge of the display rather than transparent — see the note above.
  // `left`/`top` beyond the screen keeps the surface out of the compositor's
  // visible region without asking it to honour an opacity it ignores.
  host: {
    position: 'absolute',
    left: -HIDDEN,
    top: -HIDDEN,
    width: HIDDEN,
    height: HIDDEN,
  },
  camera: { width: HIDDEN, height: HIDDEN },
});
