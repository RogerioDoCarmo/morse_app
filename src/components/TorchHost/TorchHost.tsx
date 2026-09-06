import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import type { TorchAdapter } from '@/adapters/torch/expoTorchAdapter';

/**
 * Drives the real torch.
 *
 * expo-camera exposes the torch only as a `CameraView` prop, so something has
 * to be mounted for it to switch. This host subscribes to the torch adapter and
 * mounts a camera **only while the torch is on**, so the app is not holding the
 * camera open the rest of the time. It renders nothing visible.
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
  host: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  camera: { width: 1, height: 1 },
});
