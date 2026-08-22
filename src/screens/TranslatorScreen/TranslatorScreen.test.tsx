import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { TranslatorScreen } from './TranslatorScreen';

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

  it('drives the torch through the port, not a library', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
  });

  it('turns the torch back off on a second press', async () => {
    const { ports } = renderWithProviders(<TranslatorScreen />);
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true]);
    });
    fireEvent.press(screen.getByTestId('flash-button'));
    await waitFor(() => {
      expect(ports.calls.torchEnabled).toEqual([true, false]);
    });
  });

  it('renders in the selected locale', () => {
    renderWithProviders(<TranslatorScreen />, { locale: 'es' });
    expect(screen.getByText('Destellar')).toBeOnTheScreen();
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
