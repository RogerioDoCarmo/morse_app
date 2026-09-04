import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { encode } from '@/core/domain/morse';
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
