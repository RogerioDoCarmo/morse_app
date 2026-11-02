import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { COPIED_ICON_MS, useCopyConfirmation } from './useCopyConfirmation';

function Probe({ text }: Readonly<{ text: string }>): React.JSX.Element {
  const { copy, ticked, toast, dismissToast } = useCopyConfirmation();
  return (
    <>
      <Text testID="copy" onPress={() => copy(text)}>
        copy
      </Text>
      <Text testID="ticked">{ticked ? 'tick' : 'icon'}</Text>
      <Text testID="toast" onPress={dismissToast}>
        {toast ? 'shown' : 'hidden'}
      </Text>
    </>
  );
}

const withClipboard = (ok: boolean, written: string[]): FakePorts => {
  const ports = createFakePorts();
  ports.clipboard.write = async (text: string) => {
    written.push(text);
    return ok;
  };
  return ports;
};

const renderProbe = async (ports: FakePorts, text = 'HELLO'): Promise<void> => {
  await render(
    <PortsProvider ports={ports}>
      <Probe text={text} />
    </PortsProvider>,
  );
};

describe('useCopyConfirmation', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds the tick for two and a half seconds', () => {
    expect(COPIED_ICON_MS).toBe(2500);
  });

  it('writes the text and confirms it both ways', async () => {
    const written: string[] = [];
    await renderProbe(withClipboard(true, written));

    await fireEvent.press(screen.getByTestId('copy'));
    await waitFor(() => expect(screen.getByTestId('ticked')).toHaveTextContent('tick'));
    expect(written).toEqual(['HELLO']);
    expect(screen.getByTestId('toast')).toHaveTextContent('shown');
  });

  it('reverts the tick at COPIED_ICON_MS and leaves the toast to its own timer', async () => {
    jest.useFakeTimers();
    await renderProbe(withClipboard(true, []));
    await fireEvent.press(screen.getByTestId('copy'));
    await waitFor(() => expect(screen.getByTestId('ticked')).toHaveTextContent('tick'));

    await act(async () => {
      jest.advanceTimersByTime(COPIED_ICON_MS - 1);
    });
    expect(screen.getByTestId('ticked')).toHaveTextContent('tick');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('ticked')).toHaveTextContent('icon');
    expect(screen.getByTestId('toast')).toHaveTextContent('shown');
  });

  it('lets the toast be dismissed on its own', async () => {
    await renderProbe(withClipboard(true, []));
    await fireEvent.press(screen.getByTestId('copy'));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('shown'));

    await fireEvent.press(screen.getByTestId('toast'));
    expect(screen.getByTestId('toast')).toHaveTextContent('hidden');
    expect(screen.getByTestId('ticked')).toHaveTextContent('tick');
  });

  it('does not touch the clipboard when there is nothing to copy', async () => {
    const written: string[] = [];
    await renderProbe(withClipboard(true, written), '');

    await fireEvent.press(screen.getByTestId('copy'));
    expect(written).toEqual([]);
    expect(screen.getByTestId('ticked')).toHaveTextContent('icon');
  });

  it('claims nothing when the platform refuses', async () => {
    const written: string[] = [];
    await renderProbe(withClipboard(false, written));

    await fireEvent.press(screen.getByTestId('copy'));
    await waitFor(() => expect(written).toEqual(['HELLO']));
    expect(screen.getByTestId('ticked')).toHaveTextContent('icon');
    expect(screen.getByTestId('toast')).toHaveTextContent('hidden');
  });
});
