import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { FirstRunScreen } from './FirstRunScreen';

const next = (): void => {
  fireEvent.press(screen.getByTestId('first-run-next'));
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
    expect(screen.getByText('Choose how it goes out')).toBeOnTheScreen();
    next();
    expect(screen.getByText('Hear one letter at a time')).toBeOnTheScreen();
  });

  it('marks how far through it is', () => {
    renderWithProviders(<FirstRunScreen onDone={jest.fn()} />);
    expect(screen.getAllByTestId('first-run-dot')).toHaveLength(2);
    expect(screen.getAllByTestId('first-run-dot-on')).toHaveLength(1);
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

  // Skip jumps to the last slide rather than dismissing, so Start stays the
  // single way out and nobody leaves by a door they did not mean.
  it('skips to the last slide rather than straight out', () => {
    const onDone = jest.fn();
    renderWithProviders(<FirstRunScreen onDone={onDone} />);

    fireEvent.press(screen.getByTestId('first-run-skip'));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Hear one letter at a time')).toBeOnTheScreen();
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
