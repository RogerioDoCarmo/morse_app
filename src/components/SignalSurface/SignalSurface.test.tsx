import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SURFACE_SIZE, SignalSurface } from './SignalSurface';

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
   * ⚠️ A SAFETY test, not a layout one. Morse flashes at 4.2Hz at 10 words per
   * minute and 6.3Hz at 15, both far past WCAG 2.3.1's three-per-second limit,
   * so the only thing keeping this compliant is the area exemption: under 25%
   * of the visual field. 240×240 is 17.5% of a 390×844 screen. Growing this
   * without a photosensitivity warning ahead of it is not a style change.
   */
  it('stays under a quarter of the smallest screen it ships on', () => {
    const phone = 390 * 844;
    expect(SURFACE_SIZE * SURFACE_SIZE).toBeLessThan(phone * 0.25);
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

  it('stays square when the room it is given is not', () => {
    render(<SignalSurface lit={false} />);
    fireEvent(screen.getByTestId('signal-surface').parent as never, 'layout', {
      nativeEvent: { layout: { width: 90, height: 400 } },
    });

    expect(screen.getByTestId('signal-surface')).toHaveStyle({ width: 90, height: 90 });
  });
});
