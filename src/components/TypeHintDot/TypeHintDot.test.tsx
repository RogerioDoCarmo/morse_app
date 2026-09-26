import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TypeHintDot } from './TypeHintDot';

describe('TypeHintDot', () => {
  it('carries the label a screen reader announces', () => {
    render(<TypeHintDot label="Type here" />);

    expect(screen.getByLabelText('Type here')).toBeTruthy();
  });

  /**
   * ⚠️ The pulse is the whole point of this component. A static dot was already
   * there and did not catch the eye on a device — "make it animated" was the
   * report. Asserting the loop STARTS is the only part of that a test can see;
   * nothing here proves it looks right, which is what the device is for.
   */
  it('starts a loop', () => {
    const loop = jest.spyOn(Animated, 'loop');
    render(<TypeHintDot label="Type here" />);

    expect(loop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });

  /**
   * ⚠️ FINITE, and the number is asserted LITERALLY rather than read back from
   * the module. An endless loop cost the Play promo tour 23 seconds — 148s to
   * 171s for the identical flow — because Maestro waits for the UI to settle
   * after every command and a perpetual animation never settles. `screenrecord`
   * stops at 180s, and the tour had already been truncated that way once.
   *
   * A test that imported BEATS and compared it to itself would pass on
   * `iterations: -1`, which is precisely the value that caused this.
   */
  it('breathes six times and then rests', () => {
    const loop = jest.spyOn(Animated, 'loop');
    render(<TypeHintDot label="Type here" />);

    expect(loop.mock.calls[0]?.[1]).toStrictEqual({ iterations: 6 });
    loop.mockRestore();
  });

  /**
   * ⚠️ THE SIZE IS ASSERTED LITERALLY, because 7 was not enough. The dot
   * replaced the input's auto-focus, so catching the eye is its only job, and
   * at 7pt it was reported from a device as not doing it. A test reading SIZE
   * back from the module would pass at 7, at 10, and at 1.
   */
  it('is ten points across, with a halo that grows past it', () => {
    render(<TypeHintDot label="Type here" />);
    const dot = screen.getByLabelText('Type here');

    const slot = StyleSheet.flatten(dot.props.style) as {
      width?: number;
      height?: number;
    };
    expect(slot.width).toBe(10);
    expect(slot.height).toBe(10);
  });

  /**
   * ⚠️ IT SITS ON THE LABEL'S LINE. This carried `translateY: -5` for as long
   * as the dot trailed the label at 7pt, to stop it reading as a bullet point
   * belonging to the words. Leading the row at 10pt with its own clearance, the
   * offset stopped buying that and started being visible: reported from a
   * device as the dot not lining up with the text.
   *
   * The row centres it. This asserts that nothing here fights that — an offset
   * of any size, in either direction, fails.
   */
  it('carries no vertical offset of its own', () => {
    render(<TypeHintDot label="Type here" />);
    const dot = screen.getByLabelText('Type here');

    const slot = StyleSheet.flatten(dot.props.style) as {
      transform?: { translateY?: number }[];
    };
    expect(slot.transform).toBeUndefined();
  });

  /**
   * ⚠️ And STOPS it. The hint unmounts the moment the field is touched, which
   * on a first launch is within seconds — a loop left running on a detached
   * node keeps a native animation alive for the rest of the session.
   */
  it('stops the loop when it goes away', () => {
    const stop = jest.fn();
    const loop = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });

    const view = render(<TypeHintDot label="Type here" />);
    expect(stop).not.toHaveBeenCalled();

    view.unmount();

    expect(stop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });
});
