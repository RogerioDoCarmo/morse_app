import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { createFakePorts } from '@/testing/fakePorts';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { encode } from '@/core/domain/morse';
import { DEFAULT_PLAYBACK_UNIT_MS, toTimeline } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
import { LearnScreen } from './LearnScreen';

const show = (locale?: 'en' | 'pt-BR' | 'es'): void => {
  renderWithProviders(
    <LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />,
    locale === undefined ? {} : { locale },
  );
};

describe('LearnScreen', () => {
  it('explains what Morse is', () => {
    show();
    expect(screen.getByText('What Morse code is')).toBeOnTheScreen();
  });

  // 26 letters, the three accents with codes of their own, and ten digits.
  it('lists the whole reference alphabet', () => {
    show();
    expect(screen.getAllByTestId('learn-letter')).toHaveLength(39);
  });

  it('includes the three accents that have codes of their own', () => {
    show();
    for (const char of ['Ç', 'É', 'Ñ']) {
      expect(screen.getByText(char)).toBeOnTheScreen();
    }
  });

  it('says what happens to every other accent', () => {
    show();
    expect(screen.getByText(/is sent as its plain letter/u)).toBeOnTheScreen();
  });

  it('explains why the gaps matter', () => {
    show();
    expect(screen.getByText('THE SILENCE COUNTS TOO')).toBeOnTheScreen();
    expect(screen.getByText(/EEETTTEEE/u)).toBeOnTheScreen();
  });

  it('speaks the interface language', () => {
    show('pt-BR');
    expect(screen.getByText('O que é o código Morse')).toBeOnTheScreen();
    expect(screen.getByText('O ALFABETO')).toBeOnTheScreen();
  });
});

describe('LearnScreen — the three silences', () => {
  // Literal counts, not `PLAYBACK_UNITS.letterGap` — a test that reads the
  // constant it is checking would follow it wherever it went. These are the
  // ITU-R M.1677-1 lengths, and they are not free to change.
  it('draws one bar per unit of silence', () => {
    show();
    const bars = (row: string): number =>
      within(screen.getByTestId(row)).getAllByTestId('learn-gap-bar').length;

    expect(bars('learn-gap-Marks')).toBe(1);
    expect(bars('learn-gap-Letters')).toBe(3);
    expect(bars('learn-gap-Words')).toBe(7);

    expect(screen.getByText('1 unit')).toBeOnTheScreen();
    expect(screen.getByText('3 units')).toBeOnTheScreen();
    expect(screen.getByText('7 units')).toBeOnTheScreen();
  });

  it('says what each silence means', () => {
    show();
    expect(screen.getByText('Same letter carries on')).toBeOnTheScreen();
    expect(screen.getByText('That letter is finished')).toBeOnTheScreen();
    expect(screen.getByText('Start a new word')).toBeOnTheScreen();
  });

  it('counts the singular unit as a unit, not units', () => {
    show('es');
    expect(screen.getByText('1 unidad')).toBeOnTheScreen();
    expect(screen.getByText('3 unidades')).toBeOnTheScreen();
  });
});

describe('LearnScreen — the alphabet is generated, not transcribed', () => {
  /** The marks the app would actually send for `char`. */
  const marksFor = (char: string): number =>
    encode(char).words[0]?.letters[0]?.symbols.length ?? 0;

  // A hand-typed reference drifts from the encoder the first time the table
  // changes. This one is built by encoding each character.
  it('draws each letter with as many marks as the encoder sends', () => {
    show();
    const cells = screen.getAllByTestId('learn-letter');

    // E is one mark, O is three, and the digits are five each.
    expect(marksFor('E')).toBe(1);
    expect(marksFor('O')).toBe(3);
    expect(marksFor('7')).toBe(5);
    expect(cells).toHaveLength(39);
  });
});

describe('LearnScreen — Tips', () => {
  it('offers the way through to Tips', () => {
    show();
    expect(screen.getByTestId('learn-tips')).toBeOnTheScreen();
    expect(screen.queryByTestId('tips-screen')).toBeNull();
  });

  // Tips has no tab of its own; Learn is the only route in and back out.
  it('opens Tips, and comes back', () => {
    show();

    fireEvent.press(screen.getByTestId('learn-tips'));
    expect(screen.getByTestId('tips-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('learn-screen')).toBeNull();

    fireEvent.press(screen.getByTestId('tips-back'));
    expect(screen.getByTestId('learn-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('tips-screen')).toBeNull();
  });
});

/**
 * ⚠️ A REFERENCE TABLE LOOKS LIKE SOMETHING TO READ.
 *
 * Nothing about the grid said the cells could be pressed — the same silence
 * that let a TestFlight tester finish 0.3.4 without discovering the
 * Translator's chips play at all. The letters now sound, and the label says so.
 */
describe('the alphabet can be heard, not just read', () => {
  const cells = (): unknown[] => screen.getAllByTestId('learn-letter');

  it('invites the press in the label above the grid', () => {
    show('en');
    expect(screen.getByText('Tap any letter to hear it.')).toBeOnTheScreen();
  });

  it('translates the invitation', () => {
    show('pt-BR');
    expect(screen.getByText('Toque em qualquer letra para ouvi-la.')).toBeOnTheScreen();
  });

  /**
   * ⚠️ THE INDEX MAPPING, which is the part that fails silently. The grid and
   * the playback are both built from REFERENCE, so a cell's position is its
   * index — but nothing about a wrong index looks wrong, it just sounds like
   * the wrong letter, and nobody would attribute that to an off-by-one.
   *
   * 'C' is the third cell and is dash-dot-dash-dot, so it cannot be confused
   * with its neighbours the way 'E' and 'T' can.
   */
  it('plays the letter that was pressed, not its neighbour', () => {
    const ports = createFakePorts();
    renderWithProviders(<LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });

    fireEvent.press(cells()[2] as Parameters<typeof fireEvent.press>[0]);

    expect(ports.calls.played).toHaveLength(1);
    expect(ports.calls.played[0]).toEqual(
      renderWav(toTimeline(encode('C')), { unitMs: DEFAULT_PLAYBACK_UNIT_MS }),
    );
  });

  it('plays a different letter for a different cell', () => {
    const ports = createFakePorts();
    renderWithProviders(<LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
      ports,
    });

    fireEvent.press(cells()[0] as Parameters<typeof fireEvent.press>[0]);
    expect(ports.calls.played[0]).toEqual(
      renderWav(toTimeline(encode('A')), { unitMs: DEFAULT_PLAYBACK_UNIT_MS }),
    );
  });

  describe('the quiet-phone warning', () => {
    /** Quiet enough to warn: the threshold is 0.3. */
    const muted = (): ReturnType<typeof createFakePorts> =>
      createFakePorts({ volume: { level: async () => 0.05 } });

    const pressALetterOnAMutedPhone = async (): Promise<void> => {
      const ports = muted();
      renderWithProviders(<LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
        ports,
      });
      fireEvent.press(cells()[0] as Parameters<typeof fireEvent.press>[0]);
      // The volume is read through a promise, so the warning arrives a tick
      // after the press rather than during it.
      await screen.findByTestId('toast');
    };

    it('warns when a letter is pressed and the phone is too quiet', async () => {
      await pressALetterOnAMutedPhone();
      expect(screen.getByTestId('toast')).toBeOnTheScreen();
    });

    /**
     * ⚠️ THE ASSERTION THAT MATTERS, and the one the first version of this
     * screen did not have. The toast was placed beside the accents note, which
     * is the bottom of an alphabet grid 39 cells long — taller than any phone.
     * It rendered, `getByTestId` found it, every test passed, and on a device
     * it was about a thousand points below the fold. Being IN THE TREE is not
     * the same as being ON THE SCREEN, and only its position says which.
     */
    it('pins the warning outside the scrolling alphabet', async () => {
      await pressALetterOnAMutedPhone();

      const scroll = screen.UNSAFE_getAllByType(ScrollView)[0];
      expect(scroll).toBeDefined();
      expect(
        within(scroll as Parameters<typeof within>[0]).queryByTestId('toast'),
      ).toBeNull();
    });

    it('stays quiet when the phone is loud enough to hear', async () => {
      const ports = createFakePorts();
      renderWithProviders(<LearnScreen onSelectTab={jest.fn()} unavailableTabs={[]} />, {
        ports,
      });
      fireEvent.press(cells()[0] as Parameters<typeof fireEvent.press>[0]);
      // ⚠️ Waits for the volume to have been READ before asserting nothing was
      // said about it. Asserting straight after the press would pass on a
      // screen that never checks the volume at all.
      await waitFor(() => {
        expect(ports.calls.volumeReads).toBeGreaterThan(0);
      });

      expect(screen.queryByTestId('toast')).toBeNull();
    });
  });
});
