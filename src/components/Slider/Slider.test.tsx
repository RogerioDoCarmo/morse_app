import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Slider } from './Slider';

const TRACK = 300;

function setup(value: number, onChange = jest.fn()) {
  render(
    <Slider
      testID="slider"
      value={value}
      min={80}
      max={400}
      step={10}
      onChange={onChange}
      accessibilityLabel="cut-off"
    />,
  );
  // Nothing can be positioned until the track has been measured.
  fireEvent(screen.getByTestId('slider'), 'layout', {
    nativeEvent: { layout: { width: TRACK, height: 34, x: 0, y: 0 } },
  });
  return onChange;
}

function touchAt(x: number): void {
  fireEvent(screen.getByTestId('slider'), 'responderGrant', {
    nativeEvent: { locationX: x },
    touchHistory: { touchBank: [] },
  });
}

describe('Slider', () => {
  it('reports the minimum at the far left', () => {
    const onChange = setup(180);
    touchAt(0);
    expect(onChange).toHaveBeenCalledWith(80);
  });

  it('reports the maximum at the far right', () => {
    const onChange = setup(180);
    touchAt(TRACK);
    expect(onChange).toHaveBeenCalledWith(400);
  });

  it('reports the midpoint in the middle', () => {
    const onChange = setup(180);
    touchAt(TRACK / 2);
    // 80 + 0.5 * 320 = 240, which is already on the step.
    expect(onChange).toHaveBeenCalledWith(240);
  });

  it('snaps to the step rather than reporting every pixel', () => {
    const onChange = setup(180);
    touchAt(10);
    const [reported] = onChange.mock.calls[0] as [number];
    expect(reported % 10).toBe(0);
  });

  // A touch can land outside a view that has captured the gesture.
  it.each([
    ['past the left end', -50, 80],
    ['past the right end', TRACK + 50, 400],
  ])('holds a drag %s in range', (_label, x, expected) => {
    const onChange = setup(180);
    touchAt(x);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('says nothing before the track has been measured', () => {
    const onChange = jest.fn();
    render(
      <Slider
        testID="slider"
        value={180}
        min={80}
        max={400}
        step={10}
        onChange={onChange}
        accessibilityLabel="cut-off"
      />,
    );
    touchAt(100);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('carries its value for assistive technology', () => {
    setup(250);
    expect(screen.getByTestId('slider').props.accessibilityValue).toStrictEqual({
      min: 80,
      max: 400,
      now: 250,
    });
  });

  it.each([
    ['increment', 190],
    ['decrement', 170],
  ])('moves one step on %s', (actionName, expected) => {
    const onChange = setup(180);
    fireEvent(screen.getByTestId('slider'), 'accessibilityAction', {
      nativeEvent: { actionName },
    });
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it.each([
    ['increment', 400, 400],
    ['decrement', 80, 80],
  ])('stays put on %s at the end of the range', (actionName, value, expected) => {
    const onChange = setup(value);
    fireEvent(screen.getByTestId('slider'), 'accessibilityAction', {
      nativeEvent: { actionName },
    });
    expect(onChange).toHaveBeenCalledWith(expected);
  });
});
