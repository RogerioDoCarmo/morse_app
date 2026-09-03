import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OutputChannels, type ChannelCell } from './OutputChannels';

const cells = (overrides: Partial<ChannelCell>[] = []): ChannelCell[] => {
  const base: ChannelCell[] = [
    { channel: 'sound', icon: 'volume', label: 'Sound', on: true, onToggle: jest.fn() },
    { channel: 'light', icon: 'zap', label: 'Light', on: false, onToggle: jest.fn() },
    { channel: 'screen', icon: 'screen', label: 'Screen', on: false },
    { channel: 'buzz', icon: 'vibrate', label: 'Vibrate', on: false },
  ];
  return base.map((cell, index) => ({ ...cell, ...(overrides[index] ?? {}) }));
};

describe('OutputChannels', () => {
  it('renders one cell per output', () => {
    render(<OutputChannels cells={cells()} />);
    expect(screen.getByTestId('channel-sound')).toBeOnTheScreen();
    expect(screen.getByTestId('channel-light')).toBeOnTheScreen();
    expect(screen.getByTestId('channel-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('channel-buzz')).toBeOnTheScreen();
  });

  // Several outputs can carry the message at once, which is why this is not a
  // segmented control.
  it("shows each cell's own on or off state", () => {
    render(<OutputChannels cells={cells()} />);
    expect(screen.getByTestId('channel-sound')).toBeSelected();
    expect(screen.getByTestId('channel-light')).not.toBeSelected();
  });

  it('reports a press to the cell that was pressed', () => {
    const list = cells();
    render(<OutputChannels cells={list} />);

    fireEvent.press(screen.getByTestId('channel-light'));

    expect(list[1]?.onToggle).toHaveBeenCalledTimes(1);
    expect(list[0]?.onToggle).not.toHaveBeenCalled();
  });

  // A cell with no handler is one that is designed but not built. Better grey
  // than a press that answers with nothing.
  it('disables a cell that has nothing to toggle', () => {
    render(<OutputChannels cells={cells()} />);
    expect(screen.getByTestId('channel-screen')).toBeDisabled();
    expect(screen.getByTestId('channel-buzz')).toBeDisabled();
  });

  it('keeps every cell at the 44pt touch-target floor', () => {
    render(<OutputChannels cells={cells()} />);
    for (const cell of ['sound', 'light', 'screen', 'buzz']) {
      expect(screen.getByTestId(`channel-${cell}`)).toHaveStyle({ height: 58 });
    }
  });

  it('labels each cell in whatever words it was given', () => {
    render(
      <OutputChannels
        cells={cells([{ label: 'Som' }, { label: 'Luz' }, { label: 'Tela' }])}
      />,
    );
    expect(screen.getByText('Som')).toBeOnTheScreen();
    expect(screen.getByText('Luz')).toBeOnTheScreen();
    expect(screen.getByText('Tela')).toBeOnTheScreen();
  });
});
