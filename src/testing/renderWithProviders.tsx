import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { AppLocale } from '@/core/domain/locale';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { createFakePorts, type FakePorts } from './fakePorts';

/**
 * A fixed device frame, so insets are deterministic instead of whatever the
 * host reports. Roughly an iPhone 14: 47pt notch, 34pt home indicator.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renders a subtree with fake ports, a fixed locale and deterministic insets. */
export function renderWithProviders(
  ui: ReactElement,
  options: Readonly<{ ports?: FakePorts; locale?: AppLocale }> = {},
): RenderResult & Readonly<{ ports: FakePorts }> {
  const ports: FakePorts = options.ports ?? createFakePorts();

  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <PortsProvider ports={ports}>
        <LocaleProvider initialLocale={options.locale ?? 'en'}>{children}</LocaleProvider>
      </PortsProvider>
    </SafeAreaProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), ports };
}
