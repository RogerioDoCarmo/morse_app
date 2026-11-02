/**
 * What a build that leaves a feature out SHOWS of it: nothing.
 *
 * Every screen that mentions a removable feature is rendered twice here, once
 * as the store build (every feature on) and once with the feature off. The
 * store half is the regression guard — it is the app as it shipped before
 * build variants existed — and the other half is the "no dead ends" rule: no
 * tab, row, button or footnote for something the APK does not contain.
 */
import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  ALL_BUILD_FEATURES,
  featuresFor,
  type BuildFeatures,
} from '@/core/domain/buildFeatures';
import { NavRail } from '@/components/NavRail';
import { TabBar, hasTab, tabsFor } from '@/components/TabBar';
import { LanguageScreen } from '@/screens/LanguageScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TranslatorScreen } from '@/screens/TranslatorScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';

const NO_SPEECH: BuildFeatures = { ...ALL_BUILD_FEATURES, speechInput: false };
const FDROID = featuresFor('fdroid');

const settings = async (features: BuildFeatures) =>
  await renderWithProviders(
    <SettingsScreen
      onBack={jest.fn()}
      onOpenLearn={jest.fn()}
      onOpenLanguage={jest.fn()}
      onShowGuide={jest.fn()}
    />,
    { features },
  );

describe('which destinations a build has', () => {
  it('has all four in the store build', () => {
    expect(tabsFor(ALL_BUILD_FEATURES).map((tab) => tab.name)).toStrictEqual([
      'translate',
      'speak',
      'tap',
      'learn',
    ]);
    expect(hasTab('speak', ALL_BUILD_FEATURES)).toBe(true);
  });

  // Speech is kept in the F-Droid build, so its bar is the store bar.
  it('has all four in the F-Droid build too', () => {
    expect(tabsFor(FDROID).map((tab) => tab.name)).toStrictEqual([
      'translate',
      'speak',
      'tap',
      'learn',
    ]);
  });

  it('loses Speak, and only Speak, without speech input', () => {
    expect(tabsFor(NO_SPEECH).map((tab) => tab.name)).toStrictEqual([
      'translate',
      'tap',
      'learn',
    ]);
    expect(hasTab('speak', NO_SPEECH)).toBe(false);
    expect(hasTab('translate', NO_SPEECH)).toBe(true);
    expect(hasTab('tap', NO_SPEECH)).toBe(true);
    expect(hasTab('learn', NO_SPEECH)).toBe(true);
  });

  it.each([
    ['the tab bar', () => <TabBar active="translate" />],
    ['the tablet rail', () => <NavRail active="translate" />],
  ])('%s draws Speak only when the build can listen', async (_label, ui) => {
    const view = await renderWithProviders(ui(), { features: ALL_BUILD_FEATURES });
    expect(screen.getByTestId('tab-speak')).toBeOnTheScreen();
    await view.unmount();

    await renderWithProviders(ui(), { features: NO_SPEECH });
    // Gone, not greyed: a disabled tab is the shape for "not built yet".
    expect(screen.queryByTestId('tab-speak')).toBeNull();
    expect(screen.getByTestId('tab-translate')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-tap')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-learn')).toBeOnTheScreen();
  });
});

describe('Settings in each build', () => {
  it('offers crash reports in the store build', async () => {
    await settings(ALL_BUILD_FEATURES);
    expect(screen.getByTestId('settings-privacy')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-crash-reports')).toBeOnTheScreen();
    expect(screen.getByText('Send crash reports')).toBeOnTheScreen();
  });

  // The F-Droid build has no crash reporter at all. A switch for one would be
  // a setting that does nothing, and the section heading with it.
  it('has no privacy section at all in the F-Droid build', async () => {
    await settings(FDROID);
    expect(screen.queryByTestId('settings-privacy')).toBeNull();
    expect(screen.queryByTestId('settings-crash-reports')).toBeNull();
    expect(screen.queryByText('Send crash reports')).toBeNull();
    expect(screen.queryByText('PRIVACY')).toBeNull();
    // The rest of the screen is untouched.
    expect(screen.getByTestId('settings-cutoff')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-read-aloud')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-version')).toBeOnTheScreen();
  });

  it('keeps the recogniser row while the build can listen', async () => {
    await settings(FDROID);
    expect(screen.getByTestId('settings-speech-locale')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-language')).toBeOnTheScreen();
  });

  it('drops the recogniser row, and keeps the language one, without speech input', async () => {
    await settings(NO_SPEECH);
    expect(screen.queryByTestId('settings-speech-locale')).toBeNull();
    expect(screen.queryByText('Speech recognition')).toBeNull();
    expect(screen.getByTestId('settings-language')).toBeOnTheScreen();
  });
});

describe('Language in each build', () => {
  it('offers the recogniser and its footnote when the build can listen', async () => {
    await renderWithProviders(<LanguageScreen onBack={jest.fn()} />, {
      features: FDROID,
    });
    expect(screen.getByTestId('language-recogniser')).toBeOnTheScreen();
    expect(screen.getByText('SPEECH RECOGNITION')).toBeOnTheScreen();
  });

  it('has only the interface language without speech input', async () => {
    await renderWithProviders(<LanguageScreen onBack={jest.fn()} />, {
      features: NO_SPEECH,
    });
    expect(screen.queryByTestId('language-recogniser')).toBeNull();
    expect(screen.queryByText('SPEECH RECOGNITION')).toBeNull();
    expect(screen.queryByText(/microphone/u)).toBeNull();
    expect(screen.getByTestId('language-interface')).toBeOnTheScreen();
    expect(screen.getByTestId('interface-pt-BR')).toBeOnTheScreen();
  });
});

describe('the Translator in each build', () => {
  it('offers Speak when the build can listen', async () => {
    await renderWithProviders(<TranslatorScreen />, { features: FDROID });
    expect(screen.getByTestId('speak-input')).toBeOnTheScreen();
  });

  it('offers no Speak button without speech input, and still translates', async () => {
    await renderWithProviders(<TranslatorScreen />, { features: NO_SPEECH });
    expect(screen.queryByTestId('speak-input')).toBeNull();
    expect(screen.getByTestId('translator-input')).toBeOnTheScreen();
    expect(screen.getByTestId('morse-output')).toBeOnTheScreen();
  });
});
