import React from 'react';
import type * as ReactNative from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { createExpoTorchAdapter } from '@/adapters/torch/expoTorchAdapter';
import { createNoopCrashReportingAdapter } from '@/adapters/crash/noopCrashReportingAdapter';
import { TorchHost } from './TorchHost';

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    Camera: { getCameraPermissionsAsync: jest.fn() },
    CameraView: (props: Record<string, unknown>) => (
      <View testID="camera-view" {...props} />
    ),
  };
});

describe('TorchHost', () => {
  it('mounts no camera while the torch is off', () => {
    render(
      <TorchHost adapter={createExpoTorchAdapter(createNoopCrashReportingAdapter())} />,
    );
    expect(screen.queryByTestId('torch-host')).toBeNull();
  });

  it('mounts a camera only once the torch is switched on', async () => {
    const adapter = createExpoTorchAdapter(createNoopCrashReportingAdapter());
    render(<TorchHost adapter={adapter} />);

    // The adapter drives React from outside, so the update needs flushing.
    await act(async () => {
      await adapter.setEnabled(true);
    });
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
  });

  it('unmounts the camera again when the torch goes off, releasing it', async () => {
    const adapter = createExpoTorchAdapter(createNoopCrashReportingAdapter());
    render(<TorchHost adapter={adapter} />);

    await act(async () => {
      await adapter.setEnabled(true);
    });
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();

    await act(async () => {
      await adapter.release();
    });
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });
});
