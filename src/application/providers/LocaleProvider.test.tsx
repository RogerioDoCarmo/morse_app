import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import type { Ports } from '@/core/ports';
import { createFakePorts } from '@/testing/fakePorts';
import { LocaleProvider, useLocale } from './LocaleProvider';
import { PortsProvider } from './PortsProvider';

function Probe() {
  const { t, locale, setLocale } = useLocale();
  return (
    <>
      <Text testID="value">{t('nav.translate')}</Text>
      <Text testID="locale">{locale}</Text>
      <Text testID="switch" onPress={() => setLocale('es')}>
        switch
      </Text>
    </>
  );
}

const renderProbe = (ports: Ports) =>
  render(
    <PortsProvider ports={ports}>
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    </PortsProvider>,
  );

describe('LocaleProvider', () => {
  it('seeds from the device locale', () => {
    renderProbe(createFakePorts({ locale: { getDeviceLocale: () => 'pt-BR' } }));
    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
    expect(screen.getByTestId('value')).toHaveTextContent('Traduzir');
  });

  it('lets the user override the device locale', () => {
    renderProbe(createFakePorts());
    expect(screen.getByTestId('value')).toHaveTextContent('Translate');
    act(() => {
      screen.getByTestId('switch').props.onPress();
    });
    expect(screen.getByTestId('value')).toHaveTextContent('Traducir');
  });

  it('throws rather than rendering half an app outside the provider', () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/LocaleProvider/u);
    quiet.mockRestore();
  });
});
