import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { createFakePorts } from '@/testing/fakePorts';
import { PortsProvider, usePorts } from './PortsProvider';

function Probe() {
  const ports = usePorts();
  return <Text testID="locale">{ports.locale.getDeviceLocale()}</Text>;
}

describe('PortsProvider', () => {
  it('injects the ports', async () => {
    await render(
      <PortsProvider ports={createFakePorts()}>
        <Probe />
      </PortsProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('throws rather than handing back a half-built app', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Probe />)).rejects.toThrow(/PortsProvider/u);
    quiet.mockRestore();
  });
});
