import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { DEFAULT_UNIT_MS, UNITS } from '@/core/domain/tapping';
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

// File-level, not inside one describe: press duration and the silence between
// presses ARE the input on this screen, so every block here needs the clock
// under its control. A block that missed this would read every hold as a dot.
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('TapScreen', () => {
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

describe('TapScreen — the letter row empties when the letter is done', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // The decoded text has already taken the letter by then, so leaving its
  // marks in the row reads as a letter still being keyed.
  it('clears once the silence has closed the letter', () => {
    show();
    hold(100);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);

    // Three units at the 180ms default is 540ms.
    wait(600);

    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
    // The letter itself is not lost — it is in the decoding.
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('holds the marks while the silence is still short enough', () => {
    show();
    hold(100);

    wait(400);

    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
  });

  it('starts showing again the moment the next key goes down', () => {
    show();
    hold(100);
    wait(600);
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);

    hold(300);

    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
  });

  it('keeps showing a letter that is still being keyed', () => {
    show();
    hold(100);
    wait(200);
    hold(300);
    wait(400);

    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  it('empties when everything is cleared', () => {
    show();
    hold(100);
    fireEvent.press(screen.getByTestId('tap-clear'));

    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
  });
});

describe('the cut-off is a saved preference, not screen state', () => {
  const holding = (stored: Readonly<Record<string, string>>): FakePorts => {
    const ports = createFakePorts();
    return {
      ...ports,
      preferences: {
        ...ports.preferences,
        read: async (key: string) => stored[key] ?? null,
      },
    };
  };

  it('starts from what was stored rather than the shipped default', async () => {
    const ports = holding({ 'settings.tapUnitMs': '300' });
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    await waitFor(() => {
      expect(screen.getByTestId('cutoff-value')).toHaveTextContent('300 ms');
    });
  });

  // The same value the Settings slider moves, so the stepper must write it
  // through rather than keep a copy of its own.
  it('writes the stepper through to storage', async () => {
    const ports = createFakePorts();
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    fireEvent.press(screen.getByTestId('cutoff-up'));
    await waitFor(() => {
      expect(ports.calls.stored.some((row) => row.key === 'settings.tapUnitMs')).toBe(
        true,
      );
    });
  });
});

describe('reading the decoded text aloud', () => {
  const holding = (stored: Readonly<Record<string, string>>): FakePorts => {
    const ports = createFakePorts();
    return {
      ...ports,
      preferences: {
        ...ports.preferences,
        read: async (key: string) => stored[key] ?? null,
      },
    };
  };

  /** Keys E, which is one dot — the shortest thing that decodes to a letter. */
  const keyE = (): void => {
    hold(100);
    wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  it('offers nothing to read until something has been keyed', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    expect(screen.queryByTestId('tap-read')).toBeNull();
  });

  it('offers it once there is a decoded letter', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();
    expect(screen.getByTestId('tap-read')).toBeOnTheScreen();
  });

  it('speaks what was decoded, in the app language', () => {
    const ports = createFakePorts();
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
      locale: 'pt-BR',
    });
    keyE();
    fireEvent.press(screen.getByTestId('tap-read'));
    expect(ports.calls.spoken).toStrictEqual([{ text: 'E', locale: 'pt-BR' }]);
  });

  // The same switch that governs the Translator's control, because it is the
  // same promise: speaking is the one output that says the message in words.
  it('withholds it when the setting is off', async () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports: holding({ 'settings.speakDecoded': 'false' }),
    });
    keyE();
    await waitFor(() => {
      expect(screen.queryByTestId('tap-read')).toBeNull();
    });
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('goes away again when the message is cleared', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();
    fireEvent.press(screen.getByTestId('tap-clear'));
    expect(screen.queryByTestId('tap-read')).toBeNull();
  });
});

describe('undoing the last thing keyed', () => {
  /** Past the 540ms the letter needs to close at the 180ms default. */
  const settle = (): void => {
    wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  it('offers nothing to undo on an empty screen', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    expect(screen.queryByTestId('tap-back')).toBeNull();
  });

  // One press, not one letter: everything here is derived from the press
  // list, so the last press is exactly what the operator did last.
  it('takes back one mark of a letter still being keyed', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    hold(100);
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('..');
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
  });

  it('takes back into a letter that has already been committed', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    settle();
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
  });

  // The row comes back, so a correction can be seen before it is continued.
  it('shows the letter again rather than leaving the row empty', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    hold(100);
    settle();
    expect(screen.queryByTestId('tap-mark-dot')).toBeNull();
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
  });

  // And closes again on its own, exactly as it would have after a real press.
  it('closes the letter again once the silence has run', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    hold(100);
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    settle();
    expect(screen.queryByTestId('tap-mark-dot')).toBeNull();
  });

  it('goes away once there is nothing left to undo', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.queryByTestId('tap-back')).toBeNull();
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
  });

  it('can be pressed repeatedly back to nothing', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    hold(100);
    hold(300);
    hold(100);
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.-.');
    fireEvent.press(screen.getByTestId('tap-back'));
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
    fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
  });
});
