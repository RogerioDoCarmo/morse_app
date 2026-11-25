import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { encode } from '@/core/domain/morse';
import { toTimeline } from '@/core/domain/timeline';
import { renderWav } from '@/core/domain/tone';
import type { ShareSoundResult } from '@/core/ports';
import { createFakePorts, type FakePorts } from '@/testing/fakePorts';
import { PortsProvider } from './providers/PortsProvider';
import { useShareSound } from './useShareSound';

function Probe({
  text,
  unitMs,
}: Readonly<{ text: string; unitMs: number }>): React.JSX.Element {
  const { share, canShare, sharing, failed, dismissFailed } = useShareSound(
    encode(text),
    unitMs,
    'Share as sound',
  );
  return (
    <>
      <Text testID="share" onPress={share}>
        share
      </Text>
      <Text testID="can">{canShare ? 'can' : 'cannot'}</Text>
      <Text testID="sharing">{sharing ? 'sharing' : 'idle'}</Text>
      <Text testID="failed" onPress={dismissFailed}>
        {failed ? 'failed' : 'fine'}
      </Text>
    </>
  );
}

const renderProbe = async (
  ports: FakePorts,
  text = 'SOS',
  unitMs = 120,
): Promise<void> => {
  await render(
    <PortsProvider ports={ports}>
      <Probe text={text} unitMs={unitMs} />
    </PortsProvider>,
  );
};

/** Ports whose share sheet answers `result`, recording what it was offered. */
const answering = (result: ShareSoundResult): FakePorts => {
  const ports = createFakePorts();
  ports.shareSound.share = async (wav, title) => {
    ports.calls.shared.push({ wav, title });
    return result;
  };
  return ports;
};

const ascii = (bytes: Uint8Array, from: number): string =>
  String.fromCharCode(...bytes.slice(from, from + 4));

/** The one sound offered to the sheet; fails the test if there was none. */
const firstShared = (ports: FakePorts): { wav: Uint8Array; title: string } => {
  const shared = ports.calls.shared[0];
  if (shared === undefined) throw new Error('nothing was shared');
  return shared;
};

/** The WAV data chunk's length field, little-endian at byte 40. */
const dataBytes = (wav: Uint8Array): number =>
  new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getUint32(40, true);

describe('useShareSound', () => {
  it('offers a WAV file of the message under the title', async () => {
    const ports = createFakePorts();
    await renderProbe(ports);

    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(ports.calls.shared).toHaveLength(1));

    const { wav, title } = firstShared(ports);
    expect(title).toBe('Share as sound');
    expect(ascii(wav, 0)).toBe('RIFF');
    expect(ascii(wav, 8)).toBe('WAVE');
  });

  // The same renderer and speed as Emit, so the recipient hears what was sent.
  it('renders exactly what playback renders at the given unit', async () => {
    const ports = createFakePorts();
    await renderProbe(ports, 'SOS', 120);

    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(ports.calls.shared).toHaveLength(1));

    expect(firstShared(ports).wav).toEqual(
      renderWav(toTimeline(encode('SOS')), { unitMs: 120 }),
    );
  });

  // "E" is a single dot: one unit of tone. At 8 kHz and 16 bits that is
  // unit ms × 8 samples × 2 bytes. Pinned with literals, so a change to what is
  // rendered cannot pass by moving both sides of a comparison together.
  it('renders one dot as one unit of 16-bit samples at 8 kHz', async () => {
    const ports = createFakePorts();
    await renderProbe(ports, 'E', 120);

    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(ports.calls.shared).toHaveLength(1));

    expect(dataBytes(firstShared(ports).wav)).toBe(120 * 8 * 2);
  });

  it('clamps an out-of-range speed rather than rendering minutes of one dot', async () => {
    const ports = createFakePorts();
    await renderProbe(ports, 'E', 100_000);

    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(ports.calls.shared).toHaveLength(1));

    expect(dataBytes(firstShared(ports).wav)).toBeLessThan(100_000 * 8 * 2);
  });

  it.each([
    ['an empty field', ''],
    ['only text with no Morse', '#'],
  ])('cannot share %s', async (_case, text) => {
    const ports = createFakePorts();
    await renderProbe(ports, text);

    expect(screen.getByTestId('can')).toHaveTextContent('cannot');
    await fireEvent.press(screen.getByTestId('share'));
    expect(ports.calls.shared).toEqual([]);
  });

  it('can share a message with Morse in it', async () => {
    await renderProbe(createFakePorts(), 'HI');
    expect(screen.getByTestId('can')).toHaveTextContent('can');
  });

  it('opens one sheet for a double press', async () => {
    let release: (result: ShareSoundResult) => void = () => undefined;
    const ports = createFakePorts();
    ports.shareSound.share = (wav, title) => {
      ports.calls.shared.push({ wav, title });
      return new Promise<ShareSoundResult>((resolve) => {
        release = resolve;
      });
    };
    await renderProbe(ports);

    await fireEvent.press(screen.getByTestId('share'));
    await fireEvent.press(screen.getByTestId('share'));
    expect(screen.getByTestId('sharing')).toHaveTextContent('sharing');
    expect(ports.calls.shared).toHaveLength(1);

    release('shared');
    await waitFor(() => expect(screen.getByTestId('sharing')).toHaveTextContent('idle'));
    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(ports.calls.shared).toHaveLength(2));
  });

  it('says nothing when the sheet opened', async () => {
    await renderProbe(answering('shared'));

    await fireEvent.press(screen.getByTestId('share'));
    await waitFor(() => expect(screen.getByTestId('sharing')).toHaveTextContent('idle'));
    expect(screen.getByTestId('failed')).toHaveTextContent('fine');
  });

  it.each<ShareSoundResult>(['failed', 'unavailable'])(
    'says it could not share when the port answers %s, until dismissed',
    async (result) => {
      await renderProbe(answering(result));

      await fireEvent.press(screen.getByTestId('share'));
      await waitFor(() =>
        expect(screen.getByTestId('failed')).toHaveTextContent('failed'),
      );

      await fireEvent.press(screen.getByTestId('failed'));
      expect(screen.getByTestId('failed')).toHaveTextContent('fine');
    },
  );
});
