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

const adapter = (): ReturnType<typeof createExpoTorchAdapter> =>
  createExpoTorchAdapter(createNoopCrashReportingAdapter());

describe('TorchHost', () => {
  it('mounts no camera while nothing is holding one', () => {
    render(<TorchHost adapter={adapter()} />);
    expect(screen.queryByTestId('torch-host')).toBeNull();
  });

  it('mounts a camera when a run holds one, before anything is lit', async () => {
    const torch = adapter();
    render(<TorchHost adapter={torch} />);

    // The adapter drives React from outside, so the update needs flushing.
    await act(async () => {
      await torch.setActive(true);
    });

    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    expect(screen.getByTestId('camera-view').props.enableTorch).toBe(false);
  });

  /**
   * The defect this component was rewritten for.
   *
   * Every mark used to mount its own camera — at 15 wpm, one every 80ms. The
   * torch could not open that fast and each mount blinked a black rectangle
   * across half the display. What must survive a message is the CAMERA; only
   * the prop may move with the marks.
   */
  it('keeps the same camera across every mark of a run', async () => {
    const torch = adapter();
    render(<TorchHost adapter={torch} />);

    await act(async () => {
      await torch.setActive(true);
    });
    const mounted = screen.getByTestId('camera-view');

    for (const lit of [true, false, true, false]) {
      await act(async () => {
        await torch.setEnabled(lit);
      });
      expect(screen.getByTestId('camera-view')).toBe(mounted);
    }
  });

  it('switches the torch prop rather than the camera', async () => {
    const torch = adapter();
    render(<TorchHost adapter={torch} />);

    await act(async () => {
      await torch.setActive(true);
      await torch.setEnabled(true);
    });
    expect(screen.getByTestId('camera-view').props.enableTorch).toBe(true);

    await act(async () => {
      await torch.setEnabled(false);
    });
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    expect(screen.getByTestId('camera-view').props.enableTorch).toBe(false);
  });

  it('unmounts the camera once the run lets it go, releasing it', async () => {
    const torch = adapter();
    render(<TorchHost adapter={torch} />);

    await act(async () => {
      await torch.setActive(true);
      await torch.setEnabled(true);
    });
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();

    await act(async () => {
      await torch.setActive(false);
    });
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('still mounts for a torch switched on without a run behind it', async () => {
    const torch = adapter();
    render(<TorchHost adapter={torch} />);

    await act(async () => {
      await torch.setEnabled(true);
    });
    expect(screen.getByTestId('camera-view').props.enableTorch).toBe(true);

    await act(async () => {
      await torch.release();
    });
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });
});
