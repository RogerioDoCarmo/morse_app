import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { encode } from '@/core/domain/morse';
import { DEFAULT_UNIT_MS, UNITS } from '@/core/domain/tapping';
import { toTimeline, unitMsForWpm } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
import { TapScreen } from './TapScreen';

const show = async (locale?: 'en' | 'pt-BR' | 'es'): Promise<void> => {
  await renderWithProviders(
    <TapScreen onSelectTab={jest.fn()} unavailableTabs={['learn']} />,
    locale === undefined ? {} : { locale },
  );
};

/** Holds the key for `ms`, which is the whole input. */
const hold = async (ms: number): Promise<void> => {
  await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
  await fireEvent(screen.getByTestId('tap-key'), 'pressOut');
};

/** Silence between presses — what separates marks, letters and words. */
const wait = async (ms: number): Promise<void> => {
  await act(() => {
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
  it('invites a tap before anything has been keyed', async () => {
    await show();
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-decoded')).toBeNull();
  });

  // The default cut-off is 180ms: shorter is a dot, longer is a dash.
  it('reads a short press as a dot', async () => {
    await show();
    await hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('reads a long press as a dash', async () => {
    await show();
    await hold(300);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('-');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('T');
  });

  it('keeps marks in the same letter while the silence is short', async () => {
    await show();
    await hold(100);
    await wait(200);
    await hold(300);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.-');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('A');
  });

  // Three units of silence closes a letter; seven closes a word.
  it('closes the letter after a longer silence', async () => {
    await show();
    await hold(100);
    await wait(700);
    await hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('. .');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('EE');
  });

  it('closes the word after a longer silence still', async () => {
    await show();
    await hold(100);
    await wait(1500);
    await hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('. / .');
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E E');
  });

  // A key that gives no feedback until the letter ends is unusable: you cannot
  // tell a dot you meant from a dash you fumbled.
  it('shows the letter being keyed, mark by mark', async () => {
    await show();
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);

    await hold(100);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);

    await wait(200);
    await hold(300);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  it('starts the letter row over when a letter closes', async () => {
    await show();
    await hold(100);
    await wait(700);
    await hold(300);

    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  /**
   * ⚠️ THE ONE THING THIS SCREEN COULD NOT TELL YOU. The rule is on screen —
   * "Hold the key for a dash, tap it for a dot" — and the key draws both
   * marks. Neither could say HOW LONG a hold is, because the threshold is a
   * setting measured in milliseconds nobody can feel. A tester pressed,
   * released, and only then found out what they had made.
   *
   * So the key says which mark it is making while it is still down. The
   * opacities are asserted literally: reading them back off the component
   * would agree with whatever it rendered, including nothing at all.
   */
  it('shows a dot while the press is still short', async () => {
    await show();
    await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(screen.getByTestId('tap-key-dot')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('tap-key-dash')).toHaveStyle({ opacity: 0.28 });
  });

  it('switches to the dash the moment the hold earns one', async () => {
    await show();
    await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    await act(() => {
      // Past one unit — the same threshold the decoder uses.
      jest.advanceTimersByTime(DEFAULT_UNIT_MS + 20);
    });

    expect(screen.getByTestId('tap-key-dash')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('tap-key-dot')).toHaveStyle({ opacity: 0.28 });
  });

  /**
   * ⚠️ And the key offers BOTH again once released — neither is dimmed. A key
   * left showing the last mark would read as a mode the user had entered.
   */
  it('offers both marks again once the key is released', async () => {
    await show();
    await hold(DEFAULT_UNIT_MS + 20);

    expect(screen.getByTestId('tap-key-dot')).not.toHaveStyle({ opacity: 0.28 });
    expect(screen.getByTestId('tap-key-dash')).not.toHaveStyle({ opacity: 0.28 });
  });

  it('lights the key while it is held', async () => {
    await show();
    await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    expect(screen.getByTestId('tap-key')).toBeSelected();

    await fireEvent(screen.getByTestId('tap-key'), 'pressOut');
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

  it('reads a 150ms press as a dot at the shipped default', async () => {
    await show();
    await hold(150);
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('reads the same press as a dash under a lower cut-off', async () => {
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports: holdingCutoff('120'),
      },
    );
    await waitFor(() => {
      expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    });

    await hold(150);

    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('T');
  });

  /**
   * ⚠️ AND THE KEY'S LIVE PREVIEW READS THE SAME SETTING. This is the guard
   * the preview exists for: a second, hard-coded threshold would look right at
   * the shipped default and quietly teach the wrong boundary to everyone who
   * moved it — a key promising a dot while the decoder is about to record a
   * dash is worse than a key that promises nothing.
   *
   * The same 150ms hold as the two tests above, so the only thing that differs
   * is the cut-off: at the default it is still showing a dot, and under a
   * 120ms cut-off it has already turned into a dash.
   */
  it('turns the preview into a dash early when the cut-off is lower', async () => {
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports: holdingCutoff('120'),
      },
    );
    await waitFor(() => {
      expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    });

    await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    await act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(screen.getByTestId('tap-key-dash')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('tap-key-dot')).toHaveStyle({ opacity: 0.28 });
  });

  it('does not offer the stepper any more — Settings owns it', async () => {
    await show();
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

  it('offers no way to clear an empty key', async () => {
    await show();
    expect(screen.queryByTestId('tap-clear')).toBeNull();
  });

  it('clears what was keyed', async () => {
    await show();
    await hold(100);
    expect(screen.getByTestId('tap-decoded')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tap-clear'));

    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('tap-clear')).toBeNull();
  });

  // The gap before the first press has no preceding letter to close, so a
  // long pause before starting again must not become a word break.
  it('does not carry the old silence into the next message', async () => {
    await show();
    await hold(100);
    await fireEvent.press(screen.getByTestId('tap-clear'));

    await wait(5000);
    await hold(100);

    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
  });

  it('speaks the interface language', async () => {
    await show('pt-BR');
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
  it('clears once the silence has closed the letter', async () => {
    await show();
    await hold(100);
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);

    // Three units at the 180ms default is 540ms.
    await wait(600);

    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
    // The letter itself is not lost — it is in the decoding.
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('holds the marks while the silence is still short enough', async () => {
    await show();
    await hold(100);

    await wait(400);

    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
  });

  it('starts showing again the moment the next key goes down', async () => {
    await show();
    await hold(100);
    await wait(600);
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);

    await hold(300);

    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
    expect(screen.queryAllByTestId('tap-mark-dot')).toHaveLength(0);
  });

  it('keeps showing a letter that is still being keyed', async () => {
    await show();
    await hold(100);
    await wait(200);
    await hold(300);
    await wait(400);

    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    expect(screen.getAllByTestId('tap-mark-dash')).toHaveLength(1);
  });

  it('empties when everything is cleared', async () => {
    await show();
    await hold(100);
    await fireEvent.press(screen.getByTestId('tap-clear'));

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
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports,
      },
    );
    await waitFor(() => {
      expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
    });

    // 250ms is a dash at the 180ms default and a dot at 300.
    await hold(250);

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
  const keyE = async (): Promise<void> => {
    await hold(100);
    await wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  it('offers nothing to read until something has been keyed', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    expect(screen.queryByTestId('tap-read')).toBeNull();
  });

  it('offers it once there is a decoded letter', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();
    expect(screen.getByTestId('tap-read')).toBeOnTheScreen();
  });

  it('speaks what was decoded, in the app language', async () => {
    const ports = createFakePorts();
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports,
        locale: 'pt-BR',
      },
    );
    await keyE();
    await fireEvent.press(screen.getByTestId('tap-read'));
    expect(ports.calls.spoken).toStrictEqual([{ text: 'E', locale: 'pt-BR' }]);
  });

  // The same switch that governs the Translator's control, because it is the
  // same promise: speaking is the one output that says the message in words.
  // Same race as the Translator's: the stored setting lands a tick after the
  // defaults have already rendered, so wait for it before keying anything.
  it('withholds it when the setting is off', async () => {
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports: holding({ 'settings.speakDecoded': 'false' }),
      },
    );
    await waitFor(() => {
      expect(screen.getByTestId('tap-screen')).toBeOnTheScreen();
    });

    await keyE();

    expect(screen.queryByTestId('tap-read')).toBeNull();
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
  });

  it('goes away again when the message is cleared', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();
    await fireEvent.press(screen.getByTestId('tap-clear'));
    expect(screen.queryByTestId('tap-read')).toBeNull();
  });
});

describe('undoing the last thing keyed', () => {
  /** Past the 540ms the letter needs to close at the 180ms default. */
  const settle = async (): Promise<void> => {
    await wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  it('offers nothing to undo on an empty screen', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    expect(screen.queryByTestId('tap-back')).toBeNull();
  });

  // One press, not one letter: everything here is derived from the press
  // list, so the last press is exactly what the operator did last.
  it('takes back one mark of a letter still being keyed', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await hold(100);
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('..');
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
  });

  it('takes back into a letter that has already been committed', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await settle();
    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('E');
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
  });

  // The row comes back, so a correction can be seen before it is continued.
  it('shows the letter again rather than leaving the row empty', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await hold(100);
    await settle();
    expect(screen.queryByTestId('tap-mark-dot')).toBeNull();
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
  });

  // And closes again on its own, exactly as it would have after a real press.
  it('closes the letter again once the silence has run', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await hold(100);
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getAllByTestId('tap-mark-dot')).toHaveLength(1);
    await settle();
    expect(screen.queryByTestId('tap-mark-dot')).toBeNull();
  });

  it('goes away once there is nothing left to undo', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.queryByTestId('tap-back')).toBeNull();
    expect(screen.getByTestId('tap-empty')).toBeOnTheScreen();
  });

  it('can be pressed repeatedly back to nothing', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await hold(100);
    await hold(300);
    await hold(100);
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.-.');
    await fireEvent.press(screen.getByTestId('tap-back'));
    await fireEvent.press(screen.getByTestId('tap-back'));
    expect(screen.getByTestId('tap-morse')).toHaveTextContent('.');
    await fireEvent.press(screen.getByTestId('tap-back'));
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
  const keyE = async (): Promise<void> => {
    await hold(100);
    await wait(UNITS.letterGap * DEFAULT_UNIT_MS + 60);
  };

  // Shown from the start, not once there is something to send. The complaint
  // was that the feature could not be FOUND; hiding it until the user had
  // already guessed it was there would repeat the mistake.
  it('shows all four channels before anything has been keyed', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);

    for (const channel of ['sound', 'light', 'screen', 'buzz']) {
      expect(screen.getByTestId(`channel-${channel}`)).toBeOnTheScreen();
    }
  });

  it('will not emit an empty message', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);

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
  it('flashes a surface when the Screen channel carries the message', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();

    expect(screen.queryByTestId('signal-surface')).toBeNull();

    await fireEvent.press(screen.getByTestId('channel-screen'));
    await fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();
    // The square IS the message while it carries it.
    expect(screen.queryByTestId('tap-decoded')).toBeNull();
  });

  it('emits what was keyed once there is something to emit', async () => {
    const ports = createFakePorts();
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports,
      },
    );
    await keyE();

    expect(screen.getByTestId('signal-button')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.played).toHaveLength(1);
  });

  /**
   * A 186pt disc is most of a phone's remaining height, and there is nothing
   * to key while the message is going out. Worse, a press would change the
   * decoded text — and so the message, and so the effect keyed on it — tearing
   * the run down halfway through.
   */
  it('takes the key off the screen while the message is going out', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();
    expect(screen.getByTestId('tap-key')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.queryByTestId('tap-key')).toBeNull();
  });

  it('gives the key back the moment the message stops', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();

    await fireEvent.press(screen.getByTestId('signal-button'));
    await fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('tap-key')).toBeOnTheScreen();
  });

  // Emit goes nowhere without it, and it is the control that ends the run.
  it('keeps Emit where it is, so there is still a way to stop', async () => {
    await renderWithProviders(<TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />);
    await keyE();

    await fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('signal-button')).toBeOnTheScreen();
  });

  /**
   * ⚠️ The cut-off and the playback speed are two different settings, and the
   * domain says so in as many words: one is how sloppy a HUMAN's keying may be
   * before a dot becomes a dash, the other is how fast the app reads a message
   * back. Keying slowly and listening quickly is a reasonable thing to want.
   */
  it('plays back at the playback speed, not at the keying cut-off', async () => {
    const ports = createFakePorts();
    await renderWithProviders(
      <TapScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
      {
        ports,
      },
    );
    await keyE();
    await fireEvent.press(screen.getByTestId('signal-button'));

    // E is one dot. At the default 10 wpm that is 120ms of tone, not the
    // 180ms the tap cut-off defaults to.
    // Inline rather than in a variable: `renderWav` starts with "render", and
    // testing-library's naming rule cannot tell it from a component render.
    expect((ports.calls.played[0] as Uint8Array).length).toBe(
      renderWav(toTimeline(encode('E')), { unitMs: unitMsForWpm(10) }).length,
    );
  });
});

/**
 * ⚠️ THE KEYING RULE WAS STANDING IN FOR THE MESSAGE.
 *
 * "Hold the key for a dash, tap it for a dot" filled the card while the
 * message was empty — a rule about the KEY where the MESSAGE goes. Worse, it
 * disappeared the moment the first dot was keyed, which is exactly when
 * someone is still working out which press makes which mark.
 *
 * It now sits below the play button, with the key it describes, and stays.
 * The card shows a placeholder for the text instead.
 */
describe('the keying rule sits with the key, not in the message', () => {
  it('shows a placeholder for the text in the empty card', async () => {
    await show('en');
    expect(screen.getByTestId('tap-empty')).toHaveTextContent(
      'What you key appears here.',
    );
  });

  it('shows the keying rule below the play button', async () => {
    await show('en');
    expect(screen.getByTestId('tap-hint')).toHaveTextContent(
      'Hold the key for a dash, tap it for a dot.',
    );
  });

  /**
   * The point of the move: the rule outlives the first press. Before this it
   * was replaced by the decoded text and could not be re-read.
   */
  it('keeps the rule on screen once something has been keyed', async () => {
    await show('en');
    await fireEvent(screen.getByTestId('tap-key'), 'pressIn');
    await fireEvent(screen.getByTestId('tap-key'), 'pressOut');

    expect(screen.getByTestId('tap-hint')).toBeOnTheScreen();
  });

  it('translates the placeholder and the rule', async () => {
    await show('pt-BR');
    expect(screen.getByTestId('tap-empty')).toHaveTextContent(
      'O que você digitar aparece aqui.',
    );
    expect(screen.getByTestId('tap-hint')).toBeOnTheScreen();
  });
});

/**
 * The speed the message was keyed at. The decoder has always measured each
 * press to tell a dot from a dash; this is the first time it says so.
 */
describe('the keying speed', () => {
  it('shows nothing before anything has been keyed', async () => {
    await show();
    expect(screen.queryByTestId('tap-wpm')).toBeNull();
  });

  // 1200 / 100ms is 12 words per minute.
  it('reports the speed of the first mark', async () => {
    await show();
    await hold(100);

    expect(screen.getByTestId('tap-wpm')).toHaveTextContent('12 WPM');
  });

  // A: a 100ms dot, 100ms of silence, a 300ms dash — five units in 500ms.
  it('measures across a whole letter', async () => {
    await show();
    await hold(100);
    await wait(100);
    await hold(300);

    expect(screen.getByTestId('tap-wpm')).toHaveTextContent('12 WPM');
  });

  // Pausing to think between letters is not keying slowly.
  it('does not count the pause between letters', async () => {
    await show();
    await hold(100);
    await wait(700);
    await hold(100);

    expect(screen.getByTestId('tap-decoded')).toHaveTextContent('EE');
    expect(screen.getByTestId('tap-wpm')).toHaveTextContent('12 WPM');
  });

  it('follows the hand as it slows down', async () => {
    await show();
    await hold(100);
    await wait(700);
    await hold(150);

    // Two dots in 250ms.
    expect(screen.getByTestId('tap-wpm')).toHaveTextContent('10 WPM');
  });

  it('goes with the message when it is cleared', async () => {
    await show();
    await hold(100);
    await fireEvent.press(screen.getByTestId('tap-clear'));

    expect(screen.queryByTestId('tap-wpm')).toBeNull();
  });

  it('is written the way each language abbreviates it', async () => {
    await show('pt-BR');
    await hold(100);

    expect(screen.getByTestId('tap-wpm')).toHaveTextContent('12 PPM');
  });
});
