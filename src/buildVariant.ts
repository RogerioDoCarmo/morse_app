import type { BuildVariant } from '@/core/domain/buildFeatures';

/**
 * The variant this JavaScript was bundled for: the store build.
 *
 * ⚠️ `buildVariant.fdroid.ts` beside this file replaces it in the F-Droid
 * bundle. `metro.config.js` puts `fdroid.ts` ahead of `ts` in the resolver's
 * extensions for that build only (see `build-variant.js`), so the choice is
 * made once, at bundle time, by the same table that removes the native code.
 * Jest, TypeScript and the store bundle all see this file.
 */
export const BUILD_VARIANT: BuildVariant = 'store';
