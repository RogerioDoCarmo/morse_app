import type { BuildVariant } from '@/core/domain/buildFeatures';

/**
 * The variant this JavaScript was bundled for: the F-Droid build.
 *
 * Metro picks this file over `buildVariant.ts` only when the F-Droid variant
 * is being bundled. See that file.
 */
export const BUILD_VARIANT: BuildVariant = 'fdroid';
