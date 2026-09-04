import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

  it('is the size it says it is', () => {
    render(<SignalSurface lit={false} />);
    expect(screen.getByTestId('signal-surface')).toHaveStyle({
      width: SURFACE_SIZE,
      height: SURFACE_SIZE,
    });
  });
});
