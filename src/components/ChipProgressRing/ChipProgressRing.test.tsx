import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { theme } from '@/theme';
import { ChipProgressRing } from './ChipProgressRing';

/** The chip this actually wraps is about this size on a phone. */
const WIDTH = 120;
const HEIGHT = 40;

/**
 * Hands the ring a size, because nothing else will.
 *
 * ⚠️ `onLayout` DOES NOT FIRE IN JEST. Nothing is laid out, so without this the
 * ring renders its outer `View` and no SVG at all — and every assertion about
 * the track and the mark would pass vacuously against an empty element.
 */
const layOut = (width = WIDTH, height = HEIGHT): void => {
  // ⚠️ `includeHiddenElements`: the ring sets `accessibilityElementsHidden`,
  // so RNTL treats it as hidden and a plain query finds nothing.
  fireEvent(
    screen.getByTestId('chip-progress-ring', { includeHiddenElements: true }),
    'layout',
    {
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    },
  );
};

type SvgRect = { props: Record<string, unknown> };

const rects = (): SvgRect[] => {
  // ⚠️ `UNSAFE_getAllByType` is typed `any[]` — the tree it walks has no
  // static shape — so the narrowing happens here, once, through a typed local.
  // Returning the call directly is an unsafe return; asserting on it is an
  // unnecessary one, because an `any` receiver accepts anything. The local is
  // the only spelling that is neither.
  const found: SvgRect[] = screen.UNSAFE_getAllByType(Rect);
  return found;
};

describe('ChipProgressRing', () => {
  it('draws nothing until it has been measured', () => {
    render(<ChipProgressRing />);
    // The dash lengths are absolute SVG units, so a ring drawn before the
    // measurement would size its segment against a perimeter of zero.
    expect(screen.UNSAFE_queryAllByType(Rect)).toHaveLength(0);
  });

  it('draws a track and one travelling mark', () => {
    render(<ChipProgressRing />);
    layOut();

    const all = rects();
    expect(all).toHaveLength(2);

    const [track, mark] = all;
    // ⚠️ The track carries NO dash pattern: it is the part that must not move.
    expect(track?.props.strokeDasharray).toBeUndefined();
    expect(mark?.props.strokeDasharray).toEqual(expect.any(String));
  });

  /**
   * ⚠️ WHICH ONE IS LOUD. This is the assertion the first version of this file
   * got backwards, and getting it backwards is not a subtle miss: with the
   * accent on the track and `onInk` on the dash, a device draws a solid teal
   * border with a white notch chasing round it. Naming the two colours
   * literally — rather than "the mark differs from the track" — is what makes
   * the swap fail here instead of on someone's phone.
   */
  it('lights the mark and leaves the track dim', () => {
    render(<ChipProgressRing />);
    layOut();

    const [track, mark] = rects();
    expect(track?.props.stroke).toBe('#e7f6f3');
    expect(mark?.props.stroke).toBe('#12a594');
    // The same two tokens, so a palette change moves both together.
    expect(track?.props.stroke).toBe(theme.color.accentTint);
    expect(mark?.props.stroke).toBe(theme.color.accent);
    // And the mark is never the card underneath it.
    expect(mark?.props.stroke).not.toBe(theme.color.onInk);
  });

  /**
   * The ring traces the chip, so it has to bend where the chip bends. They are
   * separate components with separate style sheets, and the two radii were
   * two points apart for a whole build.
   */
  it('traces the chip’s own corner radius', () => {
    render(<ChipProgressRing />);
    layOut();

    for (const rect of rects()) {
      expect(rect.props.rx).toBe(14);
      expect(rect.props.rx).toBe(theme.radius.control);
    }
  });

  /**
   * ⚠️ The maths that makes the mark a FRACTION rather than a fixed length. A
   * chip's width depends on its letter, so a hardcoded dash would be a
   * different proportion on every chip in the row.
   */
  it('sizes the mark to 17 percent of the measured perimeter', () => {
    render(<ChipProgressRing />);
    layOut();

    const mark = rects()[1];
    const [lit, gap] = String(mark?.props.strokeDasharray).split(' ').map(Number);

    // 117 x 37 inside a 3pt stroke, corner radius 14:
    //   2*(117-28) + 2*(37-28) + 2*pi*14  =  178 + 18 + 87.96  =  283.96
    const perimeter = (lit ?? 0) + (gap ?? 0);
    expect(perimeter).toBeCloseTo(283.96, 1);
    expect(lit).toBeCloseTo(perimeter * 0.17, 5);
  });

  /** A wider chip must get a proportionally longer mark, not the same one. */
  it('re-measures when the chip is a different size', () => {
    render(<ChipProgressRing />);
    layOut();
    const narrow = Number(String(rects()[1]?.props.strokeDasharray).split(' ')[0]);

    layOut(220, HEIGHT);
    const wide = Number(String(rects()[1]?.props.strokeDasharray).split(' ')[0]);

    expect(wide).toBeGreaterThan(narrow);
  });

  it('keeps the caller’s testID', () => {
    render(<ChipProgressRing testID="custom-ring" />);
    expect(
      screen.getByTestId('custom-ring', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
