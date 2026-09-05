import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { encode } from '@/core/domain/morse';
import { DEFAULT_PLAYBACK_UNIT_MS, toTimeline } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
import type { Ports } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TranslatorScreen } from './TranslatorScreen';

/**
 * Light is gated on the camera permission now, so the toggle resolves a
 * promise before the channel changes. Flush it before asserting.
 */
/**
 * Light is gated on the camera permission now, so the toggle resolves a
 * promise before the channel changes. Wait for the change rather than
 * assuming it has already happened.
 */
const enableLight = async (): Promise<void> => {
  fireEvent.press(screen.getByTestId('channel-light'));
  await waitFor(() => {
    expect(screen.getByTestId('channel-light')).toBeSelected();
  });
};

const disableLight = async (): Promise<void> => {
  fireEvent.press(screen.getByTestId('channel-light'));
  await waitFor(() => {
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
  });
};

/** Presses it where the permission gate is expected to stop the toggle. */
const pressLight = (): void => {
  fireEvent.press(screen.getByTestId('channel-light'));
};

describe('TranslatorScreen', () => {
  it('encodes what is typed', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('... --- ...');
  });

  it('re-encodes as the text changes', () => {
    renderWithProviders(<TranslatorScreen />);
    const input = screen.getByTestId('translator-input');
    fireEvent.changeText(input, 'E');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.');
    fireEvent.changeText(input, 'T');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('-');
  });

  it('encodes accented input by the rule the domain settled on', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AÇÃO');
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.- -.-.. .- ---');
  });

  it('starts with sound on and light off', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('channel-sound')).toBeSelected();
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
  });

  it('offers every channel in the strip', () => {
    renderWithProviders(<TranslatorScreen />);
    for (const channel of ['sound', 'light', 'screen', 'buzz']) {
      expect(screen.getByTestId(`channel-${channel}`)).not.toBeDisabled();
    }
  });

  // The torch is no longer a switch you leave on — it carries the message.
  it('leaves the torch alone until a message runs', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('channel-light'));
    await waitFor(() => {
      expect(screen.getByTestId('channel-light')).toBeSelected();
    });
    expect(ports.calls.torchEnabled).toEqual([]);
  });

  it('renders in the selected locale', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByText('Emitir')).toBeOnTheScreen();
    expect(screen.getByText('Sonido')).toBeOnTheScreen();
  });
});

describe('TranslatorScreen — direction', () => {
  it('starts in text → Morse', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('segment-toMorse')).toBeSelected();
  });

  it('swaps the panes when the direction changes', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));

    expect(screen.getByTestId('segment-toText')).toBeSelected();
    // The decoded text and its read-aloud affordance only exist that way round.
    expect(screen.getByTestId('decoded-text')).toBeOnTheScreen();
    expect(screen.getByTestId('read-aloud')).toBeOnTheScreen();
  });

  it('offers speech in one direction and the tap key in the other', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('speak-input')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('segment-toText'));
    expect(screen.getByTestId('tap-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('speak-input')).toBeNull();
  });

  it('decodes typed Morse back to text', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));
    fireEvent.changeText(screen.getByTestId('translator-input'), '... --- ...');
    expect(screen.getByTestId('decoded-text')).toHaveTextContent('SOS');
  });

  it('reads the decoded text aloud in the active locale', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.press(screen.getByTestId('segment-toText'));
    fireEvent.changeText(screen.getByTestId('translator-input'), '... --- ...');
    fireEvent.press(screen.getByTestId('read-aloud'));

    await waitFor(() => {
      expect(ports.calls.spoken).toContainEqual({ text: 'SOS', locale: 'es' });
    });
  });
});

describe('TranslatorScreen — letter selection', () => {
  it('selects nothing to begin with', () => {
    renderWithProviders(<TranslatorScreen />);
    for (const cell of screen.getAllByTestId('morse-letter')) {
      expect(cell).not.toBeSelected();
    }
  });

  it('selects the letter that was tapped, and only that one', () => {
    renderWithProviders(<TranslatorScreen />);
    const cells = screen.getAllByTestId('morse-letter');
    const target = cells[2];
    expect(target).toBeDefined();
    fireEvent.press(target);

    const after = screen.getAllByTestId('morse-letter');
    expect(after[2]).toBeSelected();
    expect(after[0]).not.toBeSelected();
  });

  it('counts the index across word boundaries, not per word', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AB CD');
    const cells = screen.getAllByTestId('morse-letter');
    // Fourth cell overall is D — the second letter of the second word.
    const fourth = cells[3];
    expect(fourth).toBeDefined();
    fireEvent.press(fourth);
    expect(screen.getAllByTestId('morse-letter')[3]).toBeSelected();
    expect(screen.getAllByTestId('morse-letter')[2]).not.toBeSelected();
  });
});

describe('TranslatorScreen — seed content', () => {
  it('seeds the input in the active locale, not always English', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByTestId('translator-input')).toHaveProp('value', 'Hola mundo');
  });

  it('seeds Portuguese without accents the encoder would fold', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'pt-BR' });
    expect(screen.getByTestId('translator-input')).toHaveProp('value', 'Boa noite');
  });

  it('derives the Morse seed from the same sample, so the directions agree', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.press(screen.getByTestId('segment-toText'));
    // Round-trips back to the very sample the other direction started from.
    expect(screen.getByTestId('decoded-text')).toHaveTextContent('HOLA MUNDO');
  });

  it('separates words with the ITU slash, which survives a copy', () => {
    renderWithProviders(<TranslatorScreen />);
    expect(screen.getByTestId('morse-string')).toHaveTextContent(
      '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
    );
  });
});

/**
 * An audio port whose playback stays in flight until the test ends it, so the
 * playing state can be observed. The real adapter resolves on finish OR stop;
 * `finish` and `stop` here are the two ways that happens.
 */
function pendingAudio(): Readonly<{
  played: Uint8Array[];
  stops: number;
  finish: () => void;
  port: Ports['audio'];
}> {
  const played: Uint8Array[] = [];
  const state = { stops: 0, resolve: (): void => undefined };
  return {
    played,
    get stops(): number {
      return state.stops;
    },
    finish: (): void => {
      state.resolve();
    },
    port: {
      play: (wav) => {
        played.push(wav);
        return new Promise<void>((resolve) => {
          state.resolve = resolve;
        });
      },
      stop: () => {
        state.stops += 1;
        state.resolve();
        return Promise.resolve();
      },
    },
  };
}

const withAudio = (port: Ports['audio']): FakePorts => createFakePorts({ audio: port });

describe('TranslatorScreen — audio playback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Advances both the clock the hook reads and the timer it ticks on. */
  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  it('hands the port a real WAV of the message on screen', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('signal-button'));

    expect(audio.played).toHaveLength(1);
    // "RIFF" — the port takes bytes, and these are the bytes of a WAV file.
    expect(Array.from(audio.played[0]?.slice(0, 4) ?? [])).toEqual([82, 73, 70, 70]);
  });

  it('shows the message playing, with a clock that runs', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();
    // "Hello world" is 111 units; at the 120ms playback default that is 13.3s.
    expect(screen.getByTestId('playback-clock')).toHaveTextContent('0:00 / 0:13');

    await advance(5000);
    expect(screen.getByTestId('playback-clock')).toHaveTextContent('0:05 / 0:13');
  });

  it('replaces the hint with the playing state, and puts it back after', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    expect(screen.queryByTestId('playing-badge')).toBeNull();
    fireEvent.press(screen.getByTestId('signal-button'));
    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(screen.queryByTestId('playing-badge')).toBeNull();
  });

  it('lights the letter the playhead is on, and moves it along', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.press(screen.getByTestId('signal-button'));

    const output = (): ReturnType<typeof within> =>
      within(screen.getByTestId('morse-output'));

    // H starts the message and holds through the gap that follows it.
    expect(output().getAllByRole('button', { selected: true })).toHaveLength(1);
    expect(
      output().getByRole('button', { selected: true, name: 'morse-letter-H' }),
    ).toBeOnTheScreen();

    // E begins 10 units in — 1200ms at the playback default.
    await advance(1300);
    expect(
      output().getByRole('button', { selected: true, name: 'morse-letter-E' }),
    ).toBeOnTheScreen();
    expect(output().getAllByRole('button', { selected: true })).toHaveLength(1);
  });

  it('stops through the port when the button is pressed again', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(audio.stops).toBeGreaterThan(0);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
  });

  // The clock ends the run, not the audio. A run with sound switched off has
  // no audio to end it, and the clock is already what the bar and chips follow.
  it('ends the run when the clock reaches the end, not when the audio does', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    fireEvent.press(screen.getByTestId('signal-button'));

    // Resolving the audio early changes nothing: SOS is 27 units, 3.24s.
    await act(async () => {
      audio.finish();
      await Promise.resolve();
    });
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();

    await advance(3300);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
    expect(screen.queryByTestId('playing-badge')).toBeNull();
  });

  // The audio was rendered from the old text and cannot be edited in flight.
  it('stops when the message is edited mid-playback', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.press(screen.getByTestId('signal-button'));

    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    expect(screen.queryByTestId('playback-progress')).toBeNull();
    expect(audio.stops).toBeGreaterThan(0);
  });

  it('plays nothing at all when there is nothing to play', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.changeText(screen.getByTestId('translator-input'), '');
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(audio.played).toHaveLength(0);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
  });
});

describe('TranslatorScreen — characters Morse cannot carry', () => {
  it('says nothing when everything typed can be encoded', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  // The defect this exists for: these characters are dropped, and were dropped
  // without a word to the sender.
  it('names the characters it had to drop', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'HI #');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent('No code for: #');
    // And the rest of the message still encodes.
    expect(screen.getByTestId('morse-string')).toHaveTextContent('.... ..');
  });

  it('lists each one once, however often it was typed', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), '#a~b#c~');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent(
      'No code for: # ~',
    );
  });

  it('says nothing about accents it folds onto a letter', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AÇÃO');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  it('replaces the hint, and gives it back once the text is encodable', () => {
    renderWithProviders(<TranslatorScreen />);
    const input = screen.getByTestId('translator-input');

    fireEvent.changeText(input, '#');
    expect(screen.getByTestId('unsupported-notice')).toBeOnTheScreen();

    fireEvent.changeText(input, 'OK');
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });

  it('warns in the interface language', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    fireEvent.changeText(screen.getByTestId('translator-input'), '#');
    expect(screen.getByTestId('unsupported-notice')).toHaveTextContent('Sin código: #');
  });

  // What is happening now outranks a warning about what was typed.
  it('yields the slot to playback while a message is playing', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });

    fireEvent.changeText(screen.getByTestId('translator-input'), 'HI #');
    expect(screen.getByTestId('unsupported-notice')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();
  });

  // Morse in, text out: an untranslatable token already shows as the
  // undecodable glyph, which is a different signal on a different pane.
  it('stays out of the way in the other direction', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('segment-toText'));
    expect(screen.queryByTestId('unsupported-notice')).toBeNull();
  });
});

describe('TranslatorScreen — hearing one letter', () => {
  /** The bytes the domain would render for `text` on its own. */
  const wavFor = (text: string): Uint8Array =>
    renderWav(toTimeline(encode(text)), { unitMs: DEFAULT_PLAYBACK_UNIT_MS });

  it('plays only the letter that was tapped', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(audio.played).toHaveLength(1);
    // Exactly O on its own — not the message, and not O's position in it.
    expect(Array.from(audio.played[0] ?? [])).toEqual(Array.from(wavFor('O')));
  });

  it('plays a different letter when a different one is tapped', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'AT');

    fireEvent.press(screen.getByLabelText('morse-letter-A'));
    fireEvent.press(screen.getByLabelText('morse-letter-T'));

    expect(Array.from(audio.played[0] ?? [])).toEqual(Array.from(wavFor('A')));
    expect(Array.from(audio.played[1] ?? [])).toEqual(Array.from(wavFor('T')));
  });

  it('still selects the letter it plays', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(
      within(screen.getByTestId('morse-output')).getAllByRole('button', {
        selected: true,
      }),
    ).toHaveLength(1);
  });

  it('replays on every tap, including the same letter twice', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');

    fireEvent.press(screen.getByLabelText('morse-letter-E'));
    fireEvent.press(screen.getByLabelText('morse-letter-E'));

    expect(audio.played).toHaveLength(2);
  });

  // While a message is running the letters are a progress display, not a
  // keyboard. A tap must not replace the audio mid-transmission.
  it('ignores a tap while a message is playing', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(audio.played).toHaveLength(1);

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    // Nothing new played, and the message is still running.
    expect(audio.played).toHaveLength(1);
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();
    expect(screen.getByTestId('playing-badge')).toBeOnTheScreen();
  });

  it('leaves the highlight to the playhead, rather than to the tap', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    fireEvent.press(screen.getByTestId('signal-button'));

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    // Still the first letter, where the playhead is — not the one tapped.
    expect(
      within(screen.getByTestId('morse-output')).getByRole('button', {
        selected: true,
        name: 'morse-letter-S',
      }),
    ).toBeOnTheScreen();
  });

  it('takes taps again once the message is stopped', () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('signal-button'));

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(Array.from(audio.played[1] ?? [])).toEqual(Array.from(wavFor('O')));
  });
});

describe('TranslatorScreen — output channels', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  const typeE = (): void => {
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
  };

  it('leaves the torch alone when light is off', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    typeE();

    fireEvent.press(screen.getByTestId('signal-button'));
    await advance(60);

    expect(ports.calls.torchEnabled).toEqual([]);
  });

  // E is one dot: on at the start, off one unit (120ms) later.
  it('carries the message on the torch when light is on', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    typeE();
    await enableLight();

    fireEvent.press(screen.getByTestId('signal-button'));
    await advance(30);
    expect(ports.calls.torchEnabled).toEqual([true]);

    await advance(300);
    expect(ports.calls.torchEnabled).toEqual([true, false]);
  });

  it('never leaves the torch on when the run is stopped part-way', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    await enableLight();

    fireEvent.press(screen.getByTestId('signal-button'));
    await advance(30);
    expect(ports.calls.torchEnabled).toEqual([true]);

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(ports.calls.torchEnabled).toEqual([true, false]);
  });

  // The promise of one run, several channels: the light joins what is already
  // going out rather than starting a second run beside it.
  it('lets the light join a message already in progress', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    await advance(200);
    expect(ports.calls.torchEnabled).toEqual([]);

    await enableLight();
    await advance(60);
    expect(ports.calls.torchEnabled.length).toBeGreaterThan(0);
  });

  it('stops the sound when its channel is switched off mid-message', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(audio.played).toHaveLength(1);

    fireEvent.press(screen.getByTestId('channel-sound'));
    expect(audio.stops).toBeGreaterThan(0);

    // The run itself carries on — the message is still being transmitted, just
    // not audibly.
    await advance(60);
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();
  });

  it('plays only what is left when sound is switched back on mid-message', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('channel-sound'));
    await advance(1000);
    fireEvent.press(screen.getByTestId('channel-sound'));

    expect(audio.played).toHaveLength(2);
    // The tail is shorter than the whole message, because it starts part-way.
    expect(audio.played[1]?.length ?? 0).toBeLessThan(audio.played[0]?.length ?? 0);
  });

  it('runs on the torch alone, with no sound at all', async () => {
    const audio = pendingAudio();
    renderWithProviders(<TranslatorScreen />, { ports: withAudio(audio.port) });
    typeE();

    await enableLight();
    fireEvent.press(screen.getByTestId('channel-sound'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(audio.played).toHaveLength(0);
    await advance(30);
    expect(screen.getByTestId('playback-progress')).toBeOnTheScreen();

    // And the clock still ends it, with no audio to do so.
    await advance(300);
    expect(screen.queryByTestId('playback-progress')).toBeNull();
  });

  it('has nothing to signal with when every channel is off', () => {
    renderWithProviders(<TranslatorScreen />);
    typeE();

    fireEvent.press(screen.getByTestId('channel-sound'));

    expect(screen.getByTestId('signal-button')).toBeDisabled();
  });

  it('has nothing to signal when there is no message', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), '');

    expect(screen.getByTestId('signal-button')).toBeDisabled();
  });

  it('offers the button again as soon as a channel comes back', async () => {
    renderWithProviders(<TranslatorScreen />);
    typeE();

    fireEvent.press(screen.getByTestId('channel-sound'));
    expect(screen.getByTestId('signal-button')).toBeDisabled();

    await enableLight();
    expect(screen.getByTestId('signal-button')).not.toBeDisabled();
  });
});

describe('TranslatorScreen — the screen channel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  it('shows the Morse chips, not a surface, while the channel is off', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('morse-output')).toBeOnTheScreen();
    expect(screen.queryByTestId('signal-surface')).toBeNull();
  });

  // The chips are a reading aid; while the screen carries the message the
  // square IS the message, and the chips would only compete with it.
  it('gives the chips over to the surface while it is carrying the message', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('channel-screen'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();
    expect(screen.queryByTestId('morse-output')).toBeNull();
  });

  it('gives the chips back when the message ends', async () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
    fireEvent.press(screen.getByTestId('channel-screen'));
    fireEvent.press(screen.getByTestId('signal-button'));
    expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();

    await advance(300);

    expect(screen.getByTestId('morse-output')).toBeOnTheScreen();
    expect(screen.queryByTestId('signal-surface')).toBeNull();
  });

  it('lights the surface on the signal and darkens it between marks', async () => {
    renderWithProviders(<TranslatorScreen />);
    // E is one dot: lit for one unit, 120ms.
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
    fireEvent.press(screen.getByTestId('channel-screen'));
    fireEvent.press(screen.getByTestId('signal-button'));

    await advance(30);
    expect(screen.getByTestId('signal-surface')).toBeSelected();

    await advance(300);
    expect(screen.queryByTestId('signal-surface')).toBeNull();
  });

  it('runs on the screen alone, with neither sound nor light', async () => {
    const audio = pendingAudio();
    const { ports } = renderWithProviders(<TranslatorScreen />, {
      ports: withAudio(audio.port),
    });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');

    fireEvent.press(screen.getByTestId('channel-screen'));
    fireEvent.press(screen.getByTestId('channel-sound'));
    fireEvent.press(screen.getByTestId('signal-button'));

    await advance(30);
    expect(screen.getByTestId('signal-surface')).toBeSelected();
    expect(audio.played).toHaveLength(0);
    expect(ports.calls.torchEnabled).toEqual([]);
  });

  it('counts as something to signal with on its own', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');

    fireEvent.press(screen.getByTestId('channel-sound'));
    expect(screen.getByTestId('signal-button')).toBeDisabled();

    fireEvent.press(screen.getByTestId('channel-screen'));
    expect(screen.getByTestId('signal-button')).not.toBeDisabled();
  });

  it('lets the screen join a message already in progress', async () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    expect(screen.queryByTestId('signal-surface')).toBeNull();

    fireEvent.press(screen.getByTestId('channel-screen'));
    await advance(30);

    expect(screen.getByTestId('signal-surface')).toBeOnTheScreen();
  });
});

describe('TranslatorScreen — keeping the screen awake', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // A message is minutes long at slow speeds, and the idle timer sees no
  // touches for the whole of it.
  it('holds the screen awake for the length of a message', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.awake).toEqual([true]);
  });

  it('lets it sleep again when the message ends', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
    fireEvent.press(screen.getByTestId('signal-button'));

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(ports.calls.awake).toEqual([true, false]);
  });

  it('lets it sleep when the message is stopped part-way', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.awake).toEqual([true, false]);
  });

  it('never holds it for a letter preview', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByLabelText('morse-letter-O'));

    expect(ports.calls.awake).toEqual([]);
  });
});

describe('TranslatorScreen — the vibration channel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const advance = async (ms: number): Promise<void> => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  it('does not vibrate while the channel is off', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.vibrated).toEqual([]);
  });

  // A is dot(1) gap(1) dash(3): two marks, the second three times the first.
  it('hands the port every mark, with the dashes marked as long', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'A');
    fireEvent.press(screen.getByTestId('channel-buzz'));

    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.vibrated).toEqual([
      [
        { atMs: 0, durationMs: 120, long: false },
        { atMs: 240, durationMs: 360, long: true },
      ],
    ]);
  });

  it('stops the motor when the message is stopped', () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');
    fireEvent.press(screen.getByTestId('channel-buzz'));

    fireEvent.press(screen.getByTestId('signal-button'));
    fireEvent.press(screen.getByTestId('signal-button'));

    expect(ports.calls.vibrationStops).toBeGreaterThan(0);
  });

  // Handed a whole sequence rather than driven tick by tick, so joining a run
  // means handing it a new sequence that starts where the run already is.
  it('hands over only the marks still to come when it joins mid-message', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'SOS');

    fireEvent.press(screen.getByTestId('signal-button'));
    await advance(1000);
    fireEvent.press(screen.getByTestId('channel-buzz'));

    const joined = ports.calls.vibrated[0] ?? [];
    expect(joined.length).toBeGreaterThan(0);
    // Fewer marks than the whole message, because part of it has gone.
    expect(joined.length).toBeLessThan(9);
  });

  it('counts as something to signal with on its own', () => {
    renderWithProviders(<TranslatorScreen />);
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');

    fireEvent.press(screen.getByTestId('channel-sound'));
    expect(screen.getByTestId('signal-button')).toBeDisabled();

    fireEvent.press(screen.getByTestId('channel-buzz'));
    expect(screen.getByTestId('signal-button')).not.toBeDisabled();
  });
});

describe('what Settings changes here', () => {
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

  const decodeSomething = (): void => {
    fireEvent.press(screen.getByTestId('segment-toText'));
    fireEvent.changeText(screen.getByTestId('translator-input'), '... --- ...');
  };

  it('offers read-aloud while the setting is on', async () => {
    renderWithProviders(<TranslatorScreen />);
    decodeSomething();
    await waitFor(() => {
      expect(screen.getByTestId('read-aloud')).toBeOnTheScreen();
    });
  });

  it('withholds read-aloud once the setting is off', async () => {
    renderWithProviders(<TranslatorScreen />, {
      ports: holding({ 'settings.speakDecoded': 'false' }),
    });
    decodeSomething();
    await waitFor(() => {
      expect(screen.queryByTestId('read-aloud')).toBeNull();
    });
  });

  // 5 WPM is a 240 ms dot against the default 120, so the rendered audio is
  // twice as long — the check that the stored speed actually reaches playback.
  it('plays at the stored speed rather than the default', async () => {
    const ports = holding({ 'settings.playbackWpm': '5' });
    renderWithProviders(<TranslatorScreen />, { ports });
    fireEvent.changeText(screen.getByTestId('translator-input'), 'E');
    await waitFor(() => {
      expect(screen.getByTestId('signal-button')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('signal-button'));
    await waitFor(() => {
      expect(ports.calls.played.length).toBe(1);
    });
    expect(ports.calls.played[0]).toStrictEqual(
      renderWav(toTimeline(encode('E')), { unitMs: 240 }),
    );
  });
});

describe('the camera permission stands in front of the light channel', () => {
  const DENIED = { granted: false, canAskAgain: true } as const;

  it('asks why before the OS does, and leaves the channel off meanwhile', async () => {
    const ports = createFakePorts({}, DENIED);
    renderWithProviders(<TranslatorScreen />, { ports });
    pressLight();
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
    expect(ports.calls.requested).toEqual([]);
  });

  it('turns the channel on once the permission is granted', async () => {
    const ports = createFakePorts({}, DENIED);
    renderWithProviders(<TranslatorScreen />, { ports });
    pressLight();
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-primary'));
    await waitFor(() => {
      expect(screen.getByTestId('channel-light')).toBeSelected();
    });
  });

  it('leaves the channel off when the rationale is dismissed', async () => {
    renderWithProviders(<TranslatorScreen />, { ports: createFakePorts({}, DENIED) });
    pressLight();
    await waitFor(() => {
      expect(screen.getByTestId('permission-camera')).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('permission-dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('permission-camera')).toBeNull();
    });
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
  });

  // Turning it back off is not a permission question — the app already has it.
  it('asks nothing when switching the channel off again', async () => {
    const ports = createFakePorts();
    renderWithProviders(<TranslatorScreen />, { ports });
    await enableLight();
    await disableLight();
    expect(screen.queryByTestId('permission-camera')).toBeNull();
  });
});
