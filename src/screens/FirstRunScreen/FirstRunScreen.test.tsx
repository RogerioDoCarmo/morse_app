import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { FirstRunScreen } from './FirstRunScreen';

const next = (): void => {
  fireEvent.press(screen.getByTestId('first-run-next'));
};

/** Which dot is lit — the one thing that says where the carousel is now. */
const at = (): number =>
  [0, 1, 2].findIndex(
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

  it('walks through the three slides in order', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    next();
    expect(at()).toBe(1);
    next();
    expect(at()).toBe(2);
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
  });

  it('follows a swipe rather than only the button', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);

    swipeTo(2);

    expect(at()).toBe(2);
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

  // An English sample inside a Spanish screen reads as a bug, not as a
  // picture of Morse — and the Translator seeds its own input in the
  // interface language.
  it('illustrates with the same sample the Translator will seed', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />, { locale: 'es' });
    expect(screen.getByText('Hola mundo')).toBeOnTheScreen();

    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />, { locale: 'en' });
    expect(screen.getByText('Hello world')).toBeOnTheScreen();
  });
});
