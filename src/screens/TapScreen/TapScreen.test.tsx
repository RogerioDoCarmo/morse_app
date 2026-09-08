import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { encode } from '@/core/domain/morse';
import { DEFAULT_UNIT_MS, UNITS } from '@/core/domain/tapping';
import { toTimeline, unitMsForWpm } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
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

describe('TapScreen — the cut-off it reads', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * The stepper used to live on this screen and no longer does: it is in
   * Settings, which is where it always also was, and this screen could not
   * hold it and the output channels both on a 320dp phone.
   *
   * What still belongs here is that the screen READS that setting. "Long" is
   * relative to the operator's own speed, which is the whole reason it is a
   * setting rather than a constant — and a 150ms press has to land on either
   * side of it accordingly.
   */
  const holdingCutoff = (ms: string): FakePorts => {
    const ports = createFakePorts();
    return {
      ...ports,
      preferences: {
        ...ports.preferences,
        read: async (key: string) => (key === 'settings.tapUnitMs' ? ms : null),
      },
    };
  };

  it('reads a 150ms press as a dot at the shipped default', () => {
    show();
    hold(150);
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('reads the same press as a dash under a lower cut-off', async () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports: holdingCutoff('120'),
    });
    await waitFor(() => {
      expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    });

    hold(150);

    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('T');
  });

  it('does not offer the stepper any more — Settings owns it', () => {
    show();
    expect(screen.queryByTestId('cutoff-value')).toBeNull();
    expect(screen.queryByTestId('cutoff-up')).toBeNull();
    expect(screen.queryByTestId('cutoff-down')).toBeNull();
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

  // Reading it is this screen's half; writing it is the Settings slider's, and
  // SettingsScreen.test.tsx covers that end.
  it('decodes by what was stored rather than the shipped default', async () => {
    const ports = holding({ 'settings.tapUnitMs': '300' });
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    await waitFor(() => {
      expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    });

    // 250ms is a dash at the 180ms default and a dot at 300.
    hold(250);

    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
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
  // Same race as the Translator's: the stored setting lands a tick after the
  // defaults have already rendered, so wait for it before keying anything.
  it('withholds it when the setting is off', async () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports: holding({ 'settings.speakDecoded': 'false' }),
    });
    await waitFor(() => {
      expect(screen.getByTestId('tap-screen')).toBeOnTheScreen();
    });

    keyE();

    expect(screen.queryByTestId('tap-read')).toBeNull();
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

/**
 * A TestFlight tester came to this screen looking for the way to send what
 * they had tapped out as vibration or a flashing screen, the way the
 * Translator offers, and found the key was input only.
 */
describe('sending what was tapped', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  /** Keys E, which is one dot — the shortest thing that decodes to a letter. */
  const keyE = (): void => {
    hold(100);
    wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  // Shown from the start, not once there is something to send. The complaint
  // was that the feature could not be FOUND; hiding it until the user had
  // already guessed it was there would repeat the mistake.
  it('shows all four channels before anything has been keyed', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);

    for (const channel of ['sound', 'light', 'screen', 'buzz']) {
      expect(screen.getByTestId(`channel-${channel}`)).toBeOnTheScreen();
    }
  });

  it('will not emit an empty message', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);

    expect(screen.getByTestId('signal-button')).toBeDisabled();
  });

  /**
   * Reported from a Poco X5 5G, on the first Android build a person ever ran:
   * "the new output options in the other screens dont work, only the button to
   * activate them works."
   *
   * The Screen channel had no surface here. Toggling it worked, the run
   * started, the progress ran — and nothing flashed, because the Translator
   * was the only screen that rendered anything for `screenLit`. The channel
   * strip was wired to a hook that had no consumer.
   */
  it('flashes a surface when the Screen channel carries the message', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();

    expect(screen.queryByTestId('signal-surface')).toBeNull();

    fireEvent.press(screen.getByTestId('channel-screen'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();
    // The square IS the message while it carries it.
    expect(screen.queryByTestId('tap-decoded')).toBeNull();
  });

  it('emits what was keyed once there is something to emit', () => {
    const ports = createFakePorts();
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    keyE();

    expect(screen.getByTestId('signal-button')).not.toBeDisabled();
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.played).toHaveLength(1);
  });

  /**
   * A 186pt disc is most of a phone's remaining height, and there is nothing
   * to key while the message is going out. Worse, a press would change the
   * decoded text — and so the message, and so the effect keyed on it — tearing
   * the run down halfway through.
   */
  it('takes the key off the screen while the message is going out', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();
    expect(screen.getByTestId('tap-key')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.queryByTestId('tap-key')).toBeNull();
  });

  it('gives the key back the moment the message stops', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('tap-key')).toBeOnTheScreen();
  });

  // Emit goes nowhere without it, and it is the control that ends the run.
  it('keeps Emit where it is, so there is still a way to stop', () => {
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    keyE();

    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('signal-button')).toBeOnTheScreen();
  });

  /**
   * ⚠️ The cut-off and the playback speed are two different settings, and the
   * domain says so in as many words: one is how sloppy a HUMAN's keying may be
   * before a dot becomes a dash, the other is how fast the app reads a message
   * back. Keying slowly and listening quickly is a reasonable thing to want.
   */
  it('plays back at the playback speed, not at the keying cut-off', () => {
    const ports = createFakePorts();
    renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });
    keyE();
    fireEvent.press(screen.getByTestId('signal-button'));

    // E is one dot. At the default 10 wpm that is 120ms of tone, not the
    // 180ms the tap cut-off defaults to.
    // Inline rather than in a variable: `renderWav` starts with "render", and
    // testing-library's naming rule cannot tell it from a component render.
    expect((ports.calls.played[0] as Uint8Array).length).toBe(
      renderWav(toTimeline(encode('E')), { unitMs: unitMsForWpm(10) }).length,
    );
  });
});
