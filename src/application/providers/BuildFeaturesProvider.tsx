import React, { createContext, useContext, type ReactNode } from 'react';
import { BUILD_VARIANT } from '@/buildVariant';
import { featuresFor, type BuildFeatures } from '@/core/domain/buildFeatures';

/** What this bundle was built with. Decided at bundle time, never at runtime. */
export const BUNDLED_FEATURES: BuildFeatures = featuresFor(BUILD_VARIANT);

/**
 * ⚠️ The default IS the bundled answer, not a missing value. The app root does
 * not need to wrap itself in a provider to get the right features — and a
 * component mounted outside one cannot end up showing a feature the build
 * left out. The provider exists so tests can render both builds.
 */
const BuildFeaturesContext = createContext<BuildFeatures>(BUNDLED_FEATURES);

/** Overrides the features below it. Used by tests to render the F-Droid build. */
export function BuildFeaturesProvider({
  features,
  children,
}: Readonly<{ features: BuildFeatures; children: ReactNode }>): React.JSX.Element {
  return (
    <BuildFeaturesContext.Provider value={features}>
      {children}
    </BuildFeaturesContext.Provider>
  );
}

/** The features this build contains. */
export function useBuildFeatures(): BuildFeatures {
  return useContext(BuildFeaturesContext);
}
