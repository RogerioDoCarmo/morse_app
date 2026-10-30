import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
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
const layOut = async (width = WIDTH, height = HEIGHT): Promise<void> => {
  // ⚠️ `includeHiddenElements`: the ring sets `accessibilityElementsHidden`,
  // so RNTL treats it as hidden and a plain query finds nothing.
  await fireEvent(
    screen.getByTestId('chip-progress-ring', { includeHiddenElements: true }),
    'layout',
    {
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    },
  );
};

/**
 * ⚠️ `Rect` IS A PLAIN HOST ELEMENT HERE. The test renderer only keeps host
 * elements, and the real one is `RNSVGRect`, whose props react-native-svg has
 * already rewritten — colours processed, the dash string split. Mocking it as
 * a host element keeps the props the component actually passes, which is
 * what every assertion below is about.
 */
jest.mock('react-native-svg', () => ({
  // The spread drops the non-enumerable flag, and without it the default
  // `Svg` import resolves to this whole object.
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('react-native-svg'),
  Rect: 'Rect',
}));

const rects = (): TestInstance[] =>
  screen.container.queryAll((node) => node.type === 'Rect');

describe('ChipProgressRing', () => {
  it('draws nothing until it has been measured', async () => {
    await render(<ChipProgressRing />);
    // The dash lengths are absolute SVG units, so a ring drawn before the
    // measurement would size its segment against a perimeter of zero.
    expect(rects()).toHaveLength(0);
  });

  it('draws a track and one travelling mark', async () => {
    await render(<ChipProgressRing />);
    await layOut();

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
  it('lights the mark and leaves the track dim', async () => {
    await render(<ChipProgressRing />);
    await layOut();

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
  it('traces the chip’s own corner radius', async () => {
    await render(<ChipProgressRing />);
    await layOut();

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
  it('sizes the mark to 17 percent of the measured perimeter', async () => {
    await render(<ChipProgressRing />);
    await layOut();

    const mark = rects()[1];
    const [lit, gap] = String(mark?.props.strokeDasharray).split(' ').map(Number);

    // 117 x 37 inside a 3pt stroke, corner radius 14:
    //   2*(117-28) + 2*(37-28) + 2*pi*14  =  178 + 18 + 87.96  =  283.96
    const perimeter = (lit ?? 0) + (gap ?? 0);
    expect(perimeter).toBeCloseTo(283.96, 1);
    expect(lit).toBeCloseTo(perimeter * 0.17, 5);
  });

  /** A wider chip must get a proportionally longer mark, not the same one. */
  it('re-measures when the chip is a different size', async () => {
    await render(<ChipProgressRing />);
    await layOut();
    const narrow = Number(String(rects()[1]?.props.strokeDasharray).split(' ')[0]);

    await layOut(220, HEIGHT);
    const wide = Number(String(rects()[1]?.props.strokeDasharray).split(' ')[0]);

    expect(wide).toBeGreaterThan(narrow);
  });

  it('keeps the caller’s testID', async () => {
    await render(<ChipProgressRing testID="custom-ring" />);
    expect(
      screen.getByTestId('custom-ring', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
