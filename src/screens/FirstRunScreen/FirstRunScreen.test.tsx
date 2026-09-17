import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { elementAt } from '@/testing/elementAt';
import { FirstRunScreen } from './FirstRunScreen';

const next = (): void => {
  fireEvent.press(screen.getByTestId('first-run-next'));
};

/** Which dot is lit — the one thing that says where the carousel is now. */
const at = (): number =>
  [0, 1, 2, 3].findIndex(
    (dot) =>
      screen.getByTestId(`first-run-dot-${String(dot)}`).props.accessibilityState
        ?.selected === true,
  );

/**
 * A swipe that lands on `page`.
 *
 * The pager measures itself, so the width has to arrive before an offset means
 * anything — which is also true on a device, and why nothing moves until the
 * first layout.
 */
const swipeTo = (page: number, width = 390): void => {
  const pager = screen.getByTestId('first-run-pager');
  fireEvent(pager, 'layout', {
    nativeEvent: { layout: { width, height: 700, x: 0, y: 0 } },
  });
  fireEvent(pager, 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: page * width, y: 0 } },
  });
};

describe('FirstRunScreen', () => {
  it('opens on the first slide', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    expect(screen.getByText('Type it, see it')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-art-chips')).toBeOnTheScreen();
  });

  it('walks through the four slides in order', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    next();
    expect(at()).toBe(1);
    next();
    expect(at()).toBe(2);
    next();
    expect(at()).toBe(3);
  });

  it('marks how far through it is', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    expect(at()).toBe(0);
    next();
    expect(at()).toBe(1);
  });

  /**
   * The slides are all mounted side by side, which is what makes the gesture
   * free — and it means every illustration is in the tree from the start. What
   * page you are ON is the dots, not what exists.
   */
  it('mounts every slide, so there is something to swipe to', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    expect(screen.getByTestId('first-run-art-chips')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-art-channels')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-art-letter')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-art-surface')).toBeOnTheScreen();
  });

  it('follows a swipe rather than only the button', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    swipeTo(3);

    expect(at()).toBe(3);
    expect(screen.getByText('Start')).toBeOnTheScreen();
    expect(screen.queryByTestId('first-run-skip')).toBeNull();
  });

  /**
   * A momentum event is not guaranteed: the CI emulator runs with animations
   * off, and a paging scroll view there can finish its snap inside the drag
   * and never emit one. The swipe moved the pager, the dots did not follow.
   */
  it('follows a swipe that never reports momentum', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    const pager = screen.getByTestId('first-run-pager');

    fireEvent(pager, 'layout', {
      nativeEvent: { layout: { width: 390, height: 700, x: 0, y: 0 } },
    });
    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: { contentOffset: { x: 780, y: 0 } },
    });

    expect(at()).toBe(2);
  });

  // A drag with a snap still to come is somewhere between two pages, and
  // reading a page out of it would fight the snap.
  it('ignores a drag that has not landed on a page yet', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    const pager = screen.getByTestId('first-run-pager');

    fireEvent(pager, 'layout', {
      nativeEvent: { layout: { width: 390, height: 700, x: 0, y: 0 } },
    });
    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: { contentOffset: { x: 250, y: 0 } },
    });

    expect(at()).toBe(0);
  });

  it('follows a swipe back as well', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    swipeTo(2);
    swipeTo(1);

    expect(at()).toBe(1);
    expect(screen.getByTestId('first-run-skip')).toBeOnTheScreen();
  });

  // The pager measures itself a frame after the first paint. Pages a frame
  // wide of zero would be a blank carousel on the very first screen a new user
  // ever sees, so until the real width arrives it uses the window's.
  it('reads as wide as the window before it has been measured', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    fireEvent(screen.getByTestId('first-run-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * Dimensions.get('window').width, y: 0 } },
    });

    expect(at()).toBe(2);
  });

  it('finishes only on the last slide', () => {
    const onDone = jest.fn();
    renderWithProviders(<FirstRunScreen onDone={onDone} />);

    next();
    next();
    next();
    expect(onDone).not.toHaveBeenCalled();

    next();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // Skip used to jump to the last slide, on the reasoning that Start should
  // be the single way out. Answering "skip this" with one more slide and one
  // more button reads as the guide refusing to let go, and Settings keeps a
  // row that brings it back.
  it('leaves outright on Skip', () => {
    const onDone = jest.fn();
    renderWithProviders(<FirstRunScreen onDone={onDone} />);

    fireEvent.press(screen.getByTestId('first-run-skip'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('offers Skip on every slide but the last, where Start says it', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    expect(screen.getByTestId('first-run-skip')).toBeOnTheScreen();
    next();
    expect(screen.getByTestId('first-run-skip')).toBeOnTheScreen();
    next();
    expect(screen.getByTestId('first-run-skip')).toBeOnTheScreen();
    next();
    expect(screen.queryByTestId('first-run-skip')).toBeNull();
  });

  // The whole reason it exists: Light starts off, so the strip has to be
  // explained or the torch is a feature nobody finds.
  it('shows the real output strip, with light off, on the middle slide', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    next();

    expect(screen.getByTestId('channel-sound')).toBeSelected();
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
    expect(screen.getByTestId('channel-screen')).not.toBeSelected();
    expect(screen.getByTestId('channel-buzz')).not.toBeSelected();
  });

  it('leaves the strip inert — it is a picture of the control, not the control', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    next();

    fireEvent.press(screen.getByTestId('channel-light'));

    expect(screen.getByTestId('channel-light')).not.toBeSelected();
  });

  it('speaks the interface language', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />, { locale: 'pt-BR' });
    expect(screen.getByText('Escreva e veja')).toBeOnTheScreen();
    expect(screen.getByText('Pular')).toBeOnTheScreen();
  });

  /**
   * The guide illustrates with the very string the Translator will be holding
   * when the guide closes. It used to be a greeting translated per locale, on
   * the reasoning that an English sample inside a Spanish screen reads as a
   * bug; SOS answers that better, being the one message every language writes
   * the same way.
   *
   * What matters is that the two agree. A guide that shows one thing and
   * hands over a screen showing another is worse than either.
   */
  it.each(['en', 'pt-BR', 'es'] as const)(
    'illustrates with the same sample the Translator will seed, in %s',
    (locale) => {
      renderWithProviders(<FirstRunScreen onDone={jest.fn()} />, { locale });
      expect(screen.getByText('SOS')).toBeOnTheScreen();
    },
  );
});

/**
 * ⚠️ THE SLIDE THAT DESCRIBED AND WAS READ PAST. It has said "tap any letter
 * to hear just that one" since the guide existed, above a chip drawn with the
 * highlight already on it — and a tester finished 0.3.4 not knowing the chips
 * do anything at all.
 *
 * So the slide hands the press over instead of describing it: the chips are
 * live here, and pressing one plays that letter through the app's own
 * playback. Same shape of fix as the circle slide, for the same reason.
 */
describe('the letter slide demonstrates rather than describes', () => {
  // ⚠️ The GUIDE'S ring, not the app's. `tap-halo` breathes four times and is
  // what the Translator's chips wear; this slide wears `chip-progress-ring`,
  // which turns twenty times because four was not enough to be noticed.
  const rings = (): unknown[] =>
    screen.queryAllByTestId('chip-progress-ring', { includeHiddenElements: true });

  const halos = (): unknown[] =>
    screen.queryAllByTestId('tap-halo', { includeHiddenElements: true });

  const letterChips = (): unknown[] =>
    within(screen.getByTestId('first-run-art-letter')).getAllByTestId('morse-letter');

  // The MIDDLE chip: in the sample the outer two letters are identical, so a
  // ring on the first reads as decoration on a row that begins with it.
  it('points at the middle chip, not the first', async () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    await waitFor(() => {
      expect(rings()).toHaveLength(1);
    });
    const chips = letterChips();
    expect(chips).toHaveLength(3);
    expect(
      within(chips[1] as Parameters<typeof within>[0]).queryAllByTestId(
        'chip-progress-ring',
        { includeHiddenElements: true },
      ),
    ).toHaveLength(1);
  });

  // The app proper keeps the breathing halo; putting the guide's summons on
  // every message typed would be a nag rather than a hint.
  it('does not wear the app’s breathing halo', async () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    await waitFor(() => {
      expect(rings()).toHaveLength(1);
    });
    expect(halos()).toHaveLength(0);
  });

  it('points at a chip before anything has been pressed', async () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    await waitFor(() => {
      expect(rings()).toHaveLength(1);
    });
  });

  it('plays that one letter when its chip is pressed', async () => {
    const { ports } = renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    fireEvent.press(elementAt(letterChips()));

    await waitFor(() => {
      expect(ports.calls.played).toHaveLength(1);
    });
  });

  /**
   * ⚠️ And it stops pointing. The invitation has been accepted; a ring still
   * breathing on the chip would be asking for something already given.
   */
  it('stops pointing once the invitation has been taken up', async () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    await waitFor(() => {
      expect(rings()).toHaveLength(1);
    });

    fireEvent.press(elementAt(letterChips()));

    expect(rings()).toHaveLength(0);
  });

  /**
   * ⚠️ And the TRANSLATOR's hint is settled by it too. The user has done the
   * very thing that hint exists to teach; being pointed at it on the next
   * screen would be the app explaining back what they just did.
   */
  it('settles the Translator hint, which teaches the same thing', async () => {
    const { ports } = renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    fireEvent.press(elementAt(letterChips()));

    await waitFor(() => {
      expect(ports.calls.stored).toContainEqual({
        key: 'hint.letterTapSeenVersion',
        value: '1',
      });
    });
  });
});

/**
 * ⚠️ THE FIRST PLACE A MUTED PHONE CAN BE FOUND, and the worst place to find
 * it silently. The letter slide's whole argument is "press a chip and you will
 * HEAR that letter" — on a muted phone it presses, nothing happens, and the
 * slide has taught the opposite of what it set out to.
 *
 * The same toast the Translator shows, driven by the same playback hook, so
 * there is one answer to "why can I not hear it" rather than two.
 */
describe('the letter slide on a muted phone', () => {
  const muted = (): FakePorts => {
    const ports = createFakePorts();
    ports.volume.level = async () => 0.05;
    return ports;
  };

  const letterChips = (): unknown[] =>
    within(screen.getByTestId('first-run-art-letter')).getAllByTestId('morse-letter');

  it('says so when a chip is pressed with the volume down', async () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />, { ports: muted() });

    fireEvent.press(elementAt(letterChips()));

    await waitFor(() => {
      expect(screen.getByText('Turn the volume up')).toBeOnTheScreen();
    });
  });

  it('says nothing while the volume is up', async () => {
    const { ports } = renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    fireEvent.press(elementAt(letterChips()));

    await waitFor(() => {
      expect(ports.calls.played).toHaveLength(1);
    });
    expect(screen.queryByText('Turn the volume up')).toBeNull();
  });
});
