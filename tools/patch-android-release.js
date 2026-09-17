#!/usr/bin/env node
/**
 * Teach a freshly prebuilt `android/` the three things EAS would have done
 * inside its own builder. Called by `tools/build-aab-local.sh`; see that
 * script's header for why building this way is necessary at all.
 *
 * ⚠️ THIS FILE RESOLVES ITS OWN PATHS rather than taking them as arguments.
 * The shell wrapper runs under Git Bash, where the repository is
 * `/c/Github/morse_app` — and Node on Windows reads that as `C:\c\Github\...`
 * and fails with ENOENT. Passing the path in was the first version and it
 * broke immediately. `__dirname` is already a Windows path.
 *
 * ⚠️ NO SECRET PASSES THROUGH HERE. The signing block this writes tells Gradle
 * to open the properties file itself at build time. The passwords are never
 * read by Node, never held in a variable, and never written into `android/`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ⚠️ The override exists so this is TESTABLE. Resolving only from `__dirname`
// meant the only way to exercise it was to patch the real `android/`, which a
// test cannot do without destroying a build directory it does not own.
const GRADLE =
  process.env.MORSE_GRADLE_FILE ??
  path.join(__dirname, '..', 'android', 'app', 'build.gradle');

/** app.json sits beside this script's parent whichever gradle file is targeted. */
const APP_JSON = path.join(__dirname, '..', 'app.json');

const versionCode = process.argv[2];
if (!/^\d+$/.test(versionCode ?? '')) {
  console.error('usage: node tools/patch-android-release.js <versionCode>');
  process.exit(1);
}

let text = fs.readFileSync(GRADLE, 'utf8');

/** Fail loudly rather than writing a file that looks patched and is not. */
function must(next, what) {
  if (next === text) {
    console.error(`x ${what} — build.gradle does not look like the Expo template`);
    process.exit(1);
  }
  text = next;
}

// 1. versionCode. `appVersionSource: "remote"` keeps this on EAS's servers, so
//    prebuild writes 1 every single time.
//
// ⚠️ Checked by PRESENCE, not by whether the text changed. Asking for the
// versionCode it already has is a no-op, and the first version of this treated
// that as "the file is not the Expo template" and aborted a correct build.
if (!/versionCode\s+\d+/.test(text)) {
  console.error(
    'x versionCode not found — build.gradle does not look like the Expo template',
  );
  process.exit(1);
}
text = text.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);

// ⚠️ A stale `android/` is the likelier bug than a wrong app.json: the
// directory is gitignored, so nothing else in the repository notices when it
// is a version behind. Prebuild should have just refreshed it.
const expected = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).expo.version;
const found = /versionName\s+"([^"]+)"/.exec(text)?.[1];
if (found !== expected) {
  console.error(`x versionName is "${found}" but app.json says "${expected}"`);
  console.error(
    '  android/ is stale — re-run `expo prebuild --platform android --clean`',
  );
  process.exit(1);
}

// 2. The properties loader. Gradle opens the file; this script does not.
const LOADER = [
  '',
  '// Injected by tools/build-aab-local.sh — see that script for why.',
  "def keystorePropertiesFile = file(System.getenv('MORSE_KEYSTORE_PROPERTIES')",
  '    ?: "${System.properties[\'user.home\']}/.secrets/morse_app/upload-keystore.properties")',
  'def keystoreProperties = new Properties()',
  'keystoreProperties.load(new FileInputStream(keystorePropertiesFile))',
  '',
].join('\n');

if (!text.includes('keystorePropertiesFile')) {
  must(text.replace(/^android \{/m, `${LOADER}\nandroid {`), 'no android block');
}

// 3. ⚠️ A NEW signingConfig, not an edit of the debug one. Debug builds have to
//    keep using the debug keystore — repointing it makes every local install
//    fail on a signature mismatch against what is already on the device.
const UPLOAD = [
  '',
  '        upload {',
  "            storeFile file(keystoreProperties['storeFile'])",
  "            storePassword keystoreProperties['storePassword']",
  "            keyAlias keystoreProperties['keyAlias']",
  "            keyPassword keystoreProperties['keyPassword']",
  '        }',
].join('\n');

if (!text.includes('upload {')) {
  must(
    text.replace(/signingConfigs \{/, `signingConfigs {${UPLOAD}`),
    'no signingConfigs block',
  );
}

// ⚠️ The template ships `release { signingConfig signingConfigs.debug }`, with a
// comment admitting it. A debug-signed AAB does not match the upload
// certificate Play holds, and the upload is refused.
if (!/release \{[\s\S]*?signingConfig signingConfigs\.upload/.test(text)) {
  must(
    text.replace(
      /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.upload',
    ),
    'release signingConfig not rewritten',
  );
}

fs.writeFileSync(GRADLE, text);

const check = fs.readFileSync(GRADLE, 'utf8');
const signedWithUpload = /release \{[\s\S]*?signingConfig signingConfigs\.upload/.test(
  check,
);
const stillDebug = /release \{[\s\S]*?signingConfig signingConfigs\.debug/.test(check);
if (!signedWithUpload || stillDebug) {
  console.error('x release block is still not signed with the upload keystore');
  process.exit(1);
}

console.log(`  versionCode ${versionCode}, release signed with signingConfigs.upload`);
