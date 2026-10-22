import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { AppLocale } from '@/core/domain/locale';
import { ALL_BUILD_FEATURES, type BuildFeatures } from '@/core/domain/buildFeatures';
import { BuildFeaturesProvider } from '@/application/providers/BuildFeaturesProvider';
import { LocaleProvider } from '@/application/providers/LocaleProvider';
import { PermissionGate } from '@/application/providers/PermissionGate';
import { PortsProvider } from '@/application/providers/PortsProvider';
import { SettingsProvider } from '@/application/providers/SettingsProvider';
import { createFakePorts, type FakePorts } from './fakePorts';

/**
 * A fixed device frame, so insets are deterministic instead of whatever the
 * host reports. Roughly an iPhone 14: 47pt notch, 34pt home indicator.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders a subtree with fake ports, a fixed locale and deterministic insets.
 *
 * `features` defaults to every feature on — the store build — so a test that
 * does not mention build variants tests the app the stores ship. Pass
 * `featuresFor('fdroid')` to render the F-Droid build instead.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: Readonly<{
    ports?: FakePorts;
    locale?: AppLocale;
    features?: BuildFeatures;
  }> = {},
): RenderResult & Readonly<{ ports: FakePorts }> {
  const ports: FakePorts = options.ports ?? createFakePorts();
  const features = options.features ?? ALL_BUILD_FEATURES;

  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <BuildFeaturesProvider features={features}>
        <PortsProvider ports={ports}>
          <LocaleProvider initialLocale={options.locale ?? 'en'}>
            <SettingsProvider>
              <PermissionGate>{children}</PermissionGate>
            </SettingsProvider>
          </LocaleProvider>
        </PortsProvider>
      </BuildFeaturesProvider>
    </SafeAreaProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), ports };
}
