import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SURFACE_SIZE, SignalSurface, largestSafeDiameter } from './SignalSurface';

describe('SignalSurface', () => {
  it('is dark when the signal is off', () => {
    render(<SignalSurface lit={false} />);
    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      backgroundColor: '#101820',
    });
  });

  it('is light when the signal is on', () => {
    render(<SignalSurface lit />);
    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      backgroundColor: '#ffffff',
    });
  });

  it('says which state it is in, for anything not looking at the colour', () => {
    render(<SignalSurface lit />);
    expect(screen.getByTestId('signal-surface')).toBeSelected();
  });

  /**
   * ⚠️ SAFETY tests, not layout ones. Morse flashes at 4.2Hz at 10 words per
   * minute and 6.3Hz at 15, both far past WCAG 2.3.1's three-per-second limit,
   * so the only thing keeping this compliant is the area exemption: under 25%
   * of the visual field. Growing this without a photosensitivity warning ahead
   * of it is not a style change.
   *
   * The old version of this test checked SURFACE_SIZE against a 390x844 phone
   * and called that "the smallest screen it ships on". It is not — the CI
   * emulator alone is 320dp wide. That went unnoticed while the disc was given
   * only the height the card had left over, which on a cramped screen was
   * small by accident. The stage has a floor now, so the limit has to be
   * computed rather than assumed.
   */
  describe('the flashing area', () => {
    it.each([
      ['a 390x844 phone', 390, 844],
      ['a 320x640 emulator', 320, 640],
      ['a 320x480 phone, about the smallest Android still shipping', 320, 480],
    ])('stays under a quarter of %s', (_label, width, height) => {
      const side = Math.min(SURFACE_SIZE, largestSafeDiameter(width, height));

      expect(Math.PI * (side / 2) ** 2).toBeLessThan(width * height * 0.25);
    });

    // Literal values: a test that recomputed the formula would agree with any
    // mistake in it.
    it.each([
      [390, 844, 323],
      [320, 640, 255],
      [320, 480, 221],
      [1180, 820, 554],
    ])('gives %ix%i a safe diameter of %i', (width, height, expected) => {
      expect(largestSafeDiameter(width, height)).toBe(expected);
    });

    // If this ever stopped being true the cap would start changing how the app
    // looks on ordinary phones, which is not what it is for.
    it('leaves an ordinary phone alone — SURFACE_SIZE is what binds there', () => {
      expect(largestSafeDiameter(390, 844)).toBeGreaterThan(SURFACE_SIZE);
    });

    // And on a small screen it is the one that binds, which is the whole point.
    it('binds instead of SURFACE_SIZE once the screen is small enough', () => {
      expect(largestSafeDiameter(320, 480)).toBeLessThan(SURFACE_SIZE);
    });
  });

  it('takes the full size when there is room for it', () => {
    render(<SignalSurface lit={false} />);
    fireEvent(screen.getByTestId('signal-surface').parent as never, 'layout', {
      nativeEvent: { layout: { width: 320, height: 400 } },
    });

    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      width: SURFACE_SIZE,
      height: SURFACE_SIZE,
    });
  });

  // The bug this exists for: a fixed 240 inside a shorter card overflowed it
  // and was clipped, so the square that IS the message went half missing.
  it('shrinks to the room it is given rather than overflowing it', () => {
    render(<SignalSurface lit={false} />);
    fireEvent(screen.getByTestId('signal-surface').parent as never, 'layout', {
      nativeEvent: { layout: { width: 300, height: 150 } },
    });

    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      width: 150,
      height: 150,
    });
  });

  it('is a circle, at whatever size it ends up', () => {
    render(<SignalSurface lit={false} />);
    fireEvent(screen.getByTestId('signal-surface').parent as never, 'layout', {
      nativeEvent: { layout: { width: 300, height: 160 } },
    });

    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      width: 160,
      height: 160,
      borderRadius: 80,
    });
  });

  it('stays round when the room it is given is not square', () => {
    render(<SignalSurface lit={false} />);
    fireEvent(screen.getByTestId('signal-surface').parent as never, 'layout', {
      nativeEvent: { layout: { width: 90, height: 400 } },
    });

    expect(screen.getByTestId('signal-surface')).toHaveStyle({ width: 90, height: 90 });
  });
});

/**
 * ⚠️ Reported from a Poco and a Moto G22: the flashing disc was half covered
 * by the progress bar and clock.
 *
 * The stage carried `minHeight: cap` — the diameter the disc WANTS — so it
 * would not shrink when that row appeared during playback, and the disc
 * spilled underneath it. "Sometimes" was the tell: the row only exists while
 * something is playing.
 */
describe('the stage yields to what appears below it', () => {
  const flatten = (style: unknown): Record<string, unknown> =>
    Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<
      string,
      unknown
    >;

  it('asks for a floor, not for the diameter it would like', () => {
    render(<SignalSurface lit={false} />);
    const floor = flatten(
      screen.getByTestId('signal-surface-stage').props.style,
    ).minHeight;

    // Small enough that a progress row can take the room it needs, and far
    // below the cap the disc would choose for itself on any real phone.
    expect(typeof floor).toBe('number');
    expect(floor as number).toBeLessThanOrEqual(96);
    expect(floor as number).toBeGreaterThan(0);
  });
});
