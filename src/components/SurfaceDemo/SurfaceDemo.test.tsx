import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { SurfaceDemo } from './SurfaceDemo';
import { encode } from '@/core/domain/morse';

const A = encode('A');
const UNIT = 240;

/** Whether the surface is lit right now, read off the component's own prop. */
const isLit = (): boolean =>
  screen.getByTestId('surface-demo-surface').props.accessibilityState?.selected === true;

const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe('SurfaceDemo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /**
   * ⚠️ THAT IT FLASHES IS THE ENTIRE POINT. This slide exists because prose
   * did not work: the letter chips are explained twice in words — in the
   * guide and on the Morse card — and a tester still missed them. A demo that
   * renders a static circle would be a fourth paragraph with extra steps.
   */
  it('lights and darkens as the message plays', async () => {
    render(<SurfaceDemo message={A} unitMs={UNIT} />);
    await act(async () => {
      await Promise.resolve();
    });

    // 'A' is dot, gap, dash: lit at the start, dark one unit in.
    await tick(40);
    expect(isLit()).toBe(true);

    await tick(UNIT);
    expect(isLit()).toBe(false);

    // ...and lit again for the dash.
    await tick(UNIT);
    expect(isLit()).toBe(true);
  });

  /**
   * ⚠️ It flashes WITHOUT anyone pressing anything, which real playback never
   * does — the user always starts that. Someone who has asked their phone to
   * reduce motion has not opted into an animation that arrives on its own.
   */
  it('stays dark when the device asks for reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<SurfaceDemo message={A} unitMs={UNIT} />);
    await act(async () => {
      await Promise.resolve();
    });

    await tick(40);
    expect(isLit()).toBe(false);
    await tick(UNIT * 4);
    expect(isLit()).toBe(false);
  });

  // A loop left running on a detached node keeps a timer alive for the rest of
  // the session, and this one is mounted on a screen people leave quickly.
  it('stops its timer when it goes away', async () => {
    const view = render(<SurfaceDemo message={A} unitMs={UNIT} />);
    await act(async () => {
      await Promise.resolve();
    });
    const before = jest.getTimerCount();

    view.unmount();

    expect(jest.getTimerCount()).toBeLessThan(before);
  });
});
