import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import type { AppLocale } from '@/core/domain/locale';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { createFakePorts, type FakePorts } from './fakePorts';

/** Renders a subtree with fake ports and a fixed locale. */
export function renderWithProviders(
  ui: ReactElement,
  options: Readonly<{ ports?: FakePorts; locale?: AppLocale }> = {},
): RenderResult & Readonly<{ ports: FakePorts }> {
  const ports: FakePorts = options.ports ?? createFakePorts();

  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <PortsProvider ports={ports}>
      <LocaleProvider initialLocale={options.locale ?? 'en'}>{children}</LocaleProvider>
    </PortsProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), ports };
}
