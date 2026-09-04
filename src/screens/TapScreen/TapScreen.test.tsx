import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TapScreen } from './TapScreen';

const show = (locale?: 'en' | 'pt-BR' | 'es'): void => {
  renderWithProviders(
    <TapScreen onSelectTab={jest.fn()} unavailableTabs={['learn']} />,
    locale === undefined ? {} : { locale },
  );
};

/** Holds the key for `ms`, which is the whole input. */
const hold = (ms: number): void => {
  fireEvent(screen.getByTestId('tap-key'), 'pressIn');
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  fireEvent(screen.getByTestId('tap-key'), 'pressOut');
};

/** Silence between presses — what separates marks, letters and words. */
const wait = (ms: number): void => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

describe('TapScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('invites a tap before anything has been keyed', () => {
    show();
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-decoded')).toBeNull();
  });

  // The default cut-off is 180ms: shorter is a dot, longer is a dash.
  it('reads a short press as a dot', () => {
    show();
    hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('reads a long press as a dash', () => {
    show();
    hold(300);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('-');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('T');
  });

  it('keeps marks in the same letter while the silence is short', () => {
    show();
    hold(100);
    wait(200);
    hold(300);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.-');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('A');
  });

  // Three units of silence closes a letter; seven closes a word.
  it('closes the letter after a longer silence', () => {
    show();
    hold(100);
    wait(700);
    hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('. .');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('EE');
  });

  it('closes the word after a longer silence still', () => {
    show();
    hold(100);
    wait(1500);
    hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('. / .');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E E');
  });

  // A key that gives no feedback until the letter ends is unusable: you cannot
  // tell a dot you meant from a dash you fumbled.
  it('shows the letter being keyed, mark by mark', () => {
    show();
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);

    hold(100);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);

    wait(200);
    hold(300);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  it('starts the letter row over when a letter closes', () => {
    show();
    hold(100);
    wait(700);
    hold(300);

    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  it('lights the key while it is held', () => {
    show();
    fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    expect(screen.getByTestId('tap-key')).toBeSelected();

    fireEvent(screen.getByTestId('tap-key'), 'pressOut');
    expect(screen.getByTestId('tap-key')).not.toBeSelected();
  });
});

describe('TapScreen — the cut-off', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at the default the domain sets', () => {
    show();
    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('180 ms');
  });

  it('steps in both directions', () => {
    show();
    fireEvent.press(screen.getByTestId('cutoff-up'));
    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('200 ms');

    fireEvent.press(screen.getByTestId('cutoff-down'));
    fireEvent.press(screen.getByTestId('cutoff-down'));
    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('160 ms');
  });

  // "Long" is relative to the operator's own speed, which is the whole reason
  // this is a setting rather than a constant.
  it('re-reads what was already keyed at the new cut-off', () => {
    show();
    hold(150);
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');

    // Drop the cut-off below 150ms and the same press becomes a dash.
    for (let i = 0; i < 3; i += 1) fireEvent.press(screen.getByTestId('cutoff-down'));

    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('120 ms');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('T');
  });

  it('will not go below the range the domain allows', () => {
    show();
    for (let i = 0; i < 10; i += 1) fireEvent.press(screen.getByTestId('cutoff-down'));

    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('80 ms');
    expect(screen.getByTestId('cutoff-down')).toBeDisabled();
  });

  it('will not go above it either', () => {
    show();
    for (let i = 0; i < 20; i += 1) fireEvent.press(screen.getByTestId('cutoff-up'));

    expect(screen.getByTestId('cutoff-value')).toHaveTextContent('400 ms');
    expect(screen.getByTestId('cutoff-up')).toBeDisabled();
  });
});

describe('TapScreen — starting over', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers no way to clear an empty key', () => {
    show();
    expect(screen.queryByTestId('tap-clear')).toBeNull();
  });

  it('clears what was keyed', () => {
    show();
    hold(100);
    expect(screen.getByTestId('tap-decoded')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('tap-clear'));

    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-clear')).toBeNull();
  });

  // The gap before the first press has no preceding letter to close, so a
  // long pause before starting again must not become a word break.
  it('does not carry the old silence into the next message', () => {
    show();
    hold(100);
    fireEvent.press(screen.getByTestId('tap-clear'));

    wait(5000);
    hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
  });

  it('speaks the interface language', () => {
    show('pt-BR');
    expect(screen.getByText('Toque ou segure')).toBeOnTheScreen();
  });
});
