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

function Interpolated({
  values,
}: Readonly<{
  // Explicitly `| undefined`: exactOptionalPropertyTypes is on, and the point of
  // one of these tests is to pass nothing at all.
  values: Readonly<Record<string, string>> | undefined;
}>): React.JSX.Element {
  const { t } = useLocale();
  return <Text testID="value">{t('translator.unsupported', values)}</Text>;
}

const renderInterpolated = (
  values?: Readonly<Record<string, string>>,
): ReturnType<typeof render> =>
  render(
    <PortsProvider ports={createFakePorts()}>
      <LocaleProvider initialLocale="en">
        <Interpolated values={values} />
      </LocaleProvider>
    </PortsProvider>,
  );

describe('LocaleProvider — interpolation', () => {
  it('fills a hole from the values it is given', () => {
    renderInterpolated({ chars: '# ~' });
    expect(screen.getByTestId('value')).toHaveTextContent('No code for: # ~');
  });

  // Blanking it would hide the bug; leaving it visible does not.
  it('leaves a hole alone when nothing was supplied for it', () => {
    renderInterpolated({ other: 'x' });
    expect(screen.getByTestId('value')).toHaveTextContent('No code for: {{chars}}');
  });

  it('leaves the string untouched when no values are passed at all', () => {
    renderInterpolated();
    expect(screen.getByTestId('value')).toHaveTextContent('No code for: {{chars}}');
  });

  it('interpolates in whichever locale is active', () => {
    render(
      <PortsProvider ports={createFakePorts()}>
        <LocaleProvider initialLocale="pt-BR">
          <Interpolated values={{ chars: '@' }} />
        </LocaleProvider>
      </PortsProvider>,
    );
    expect(screen.getByTestId('value')).toHaveTextContent('Sem código: @');
  });
});
