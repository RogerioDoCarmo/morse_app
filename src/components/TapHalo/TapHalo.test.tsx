import React from 'react';
import { Animated } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TapHalo } from './TapHalo';

describe('TapHalo', () => {
  /**
   * ⚠️ The ring is the whole component. The letter chips were already
   * pressable, already labelled "Tap a letter to hear it" in the card header
   * and already explained on a guide slide of their own — and a tester
   * finished 0.3.4 without discovering them. Movement is the part none of
   * that had. Asserting the loop STARTS is as far as a test can follow it.
   */
  it('starts a loop', () => {
    const loop = jest.spyOn(Animated, 'loop');
    render(<TapHalo />);

    expect(loop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });

  /**
   * ⚠️ FINITE, asserted LITERALLY rather than read back from the module. An
   * endless animation never lets Maestro settle: the same mistake cost the
   * Play promo tour 23 seconds against a 180-second recording ceiling. A test
   * that compared the constant with itself would pass on `iterations: -1`,
   * which is exactly the value that caused it.
   */
  it('breathes four times and then rests', () => {
    const loop = jest.spyOn(Animated, 'loop');
    render(<TapHalo />);

    expect(loop.mock.calls[0]?.[1]).toStrictEqual({ iterations: 4 });
    loop.mockRestore();
  });

  it('stops the loop when it goes away', () => {
    const stop = jest.fn();
    const loop = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });

    const view = render(<TapHalo />);
    expect(stop).not.toHaveBeenCalled();

    view.unmount();

    expect(stop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });

  /**
   * ⚠️ IT MUST NOT EAT THE PRESS. It is drawn over the chip it is pointing at,
   * so a ring that took the touch would swallow the very tap it is asking
   * for — the feature would look, to the user being taught it, broken.
   */
  it('lets the press through to what it is pointing at', () => {
    render(<TapHalo />);

    // ⚠️ `includeHiddenElements`, because it IS hidden — from the
    // accessibility tree, which is the next assertion. Without it the query
    // fails with "unable to find", which reads like a missing element rather
    // than like the deliberate one below.
    expect(
      screen.getByTestId('tap-halo', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('none');
  });

  /**
   * And it says nothing to a screen reader. VoiceOver already reads the chip
   * as a button; a decorative ring announced beside it would turn one control
   * into two, one of which does nothing.
   */
  it('is invisible to a screen reader', () => {
    render(<TapHalo />);

    expect(
      screen.getByTestId('tap-halo', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });
});
