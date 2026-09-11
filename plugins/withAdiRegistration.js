const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Writes the Android Developer Verification token into the release APK, so
 * Google can confirm we hold the private key behind `com.rogeriodocarmo.morse`.
 *
 * Play Console hands out a token, asks for an APK containing it at
 * `assets/adi-registration.properties`, and checks that the APK's signature
 * matches the public certificate already registered. Token plus signature
 * proves ownership; neither half is enough alone.
 *
 * ⚠️ THE TOKEN IS NOT COMMITTED, and that is deliberate. This repository is
 * public, and the token identifies Rogério's developer ACCOUNT rather than
 * this app. It is harmless on its own — without the signing key it proves
 * nothing, which is the whole point of the pairing — but an account
 * identifier published on GitHub is still an account identifier published on
 * GitHub. It arrives from the environment for the one build that needs it:
 *
 *     ADI_REGISTRATION_TOKEN=... pnpm build:apk:local
 *
 * ⚠️ A plugin rather than a file dropped into `android/`. That directory is
 * generated and gitignored — `expo prebuild` rebuilds it from nothing, and a
 * hand-placed file is gone by the time Gradle runs. The same reason the
 * permission cleaner is a plugin.
 *
 * The file is a BARE TOKEN on one line. Not `key=value`, despite the
 * extension — checked against Google's own sample rather than assumed.
 */
const FILE = 'adi-registration.properties';
const VARIABLE = 'ADI_REGISTRATION_TOKEN';

/**
 * The token, or null when this build is not a verification build.
 *
 * @param {Record<string, string | undefined>} [environment]
 * @returns {string | null}
 */
function tokenFromEnvironment(environment = process.env) {
  const value = environment[VARIABLE];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const assets = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
      );
      const target = path.join(assets, FILE);
      const token = tokenFromEnvironment();

      if (token === null) {
        // Every other build ships without it. Removing rather than skipping,
        // so a verification build followed by an ordinary one cannot leave
        // the token inside a binary that goes to testers or to a store.
        fs.rmSync(target, { force: true });
        return cfg;
      }

      fs.mkdirSync(assets, { recursive: true });
      fs.writeFileSync(target, `${token}\n`);
      return cfg;
    },
  ]);
};

module.exports.FILE = FILE;
module.exports.VARIABLE = VARIABLE;
module.exports.tokenFromEnvironment = tokenFromEnvironment;
