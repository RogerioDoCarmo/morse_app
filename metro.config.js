const { getDefaultConfig } = require('expo/metro-config');
const { withBuildVariant } = require('./build-variant');

/**
 * Expo's default Metro config, unchanged for the store build.
 *
 * ⚠️ This file did not exist before the F-Droid variant, and for the store
 * build it still adds nothing: `withBuildVariant` hands the store variant its
 * config back as the very same object, so the store bundle is what Expo would
 * have built with no `metro.config.js` at all. `build-variant.test.ts` pins
 * that.
 *
 * For the F-Droid variant it removes what that build leaves out from the
 * JavaScript, the way `app.config.js` removes it from the native project. See
 * `build-variant.js`.
 */
module.exports = withBuildVariant(getDefaultConfig(__dirname));
