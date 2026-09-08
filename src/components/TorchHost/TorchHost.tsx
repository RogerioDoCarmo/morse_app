import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import type { TorchAdapter } from '@/adapters/torch/expoTorchAdapter';

/**
 * How large the hidden camera is, and how far off screen it sits.
 *
 * Big enough that a camera will negotiate a preview for it — 1x1 is not a size
 * any HAL offers — and far enough out that the surface never lands in the
 * visible region.
 */
const HIDDEN = 120;

/**
 * Drives the real torch.
 *
 * expo-camera exposes the torch only as a `CameraView` prop, so something has
 * to be mounted for it to switch. This host subscribes to the torch adapter and
 * mounts a camera **only while the torch is on**, so the app is not holding the
 * camera open the rest of the time.
 *
 * ⚠️ It is hidden by being OFF SCREEN, not by being tiny and transparent.
 *
 * The first version was 1x1 at `opacity: 0`, and on a Poco X5 5G that produced
 * a black rectangle flickering over the bottom half of the display whenever
 * Light was switched on — while the torch itself never lit. A camera preview is
 * a SurfaceView: it draws straight to its own hardware layer, so the parent's
 * opacity does not touch it, and a 1x1 request is not a preview size any camera
 * offers — the HAL picks a real one and composites it wherever the surface
 * happens to be. Off screen, at a size a camera will actually agree to, is the
 * shape that has neither problem.
 */
export function TorchHost({
  adapter,
}: Readonly<{ adapter: TorchAdapter }>): React.JSX.Element | null {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => adapter.subscribe(setEnabled), [adapter]);

  if (!enabled) return null;

  return (
    <View style={styles.host} pointerEvents="none" testID="torch-host">
      <CameraView style={styles.camera} enableTorch facing="back" />
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
