#!/usr/bin/env bash
# Build a Play-ready AAB with Gradle directly, no EAS builder.
#
# ⚠️ WHY THIS EXISTS. `eas build --local` refuses to run on Windows —
# "Unsupported platform, macOS or Linux is required to build apps for Android"
# — and EAS cloud credits do not reset until 1 October. Gradle itself runs
# natively on Windows, so the app can still be built; what EAS does INSIDE its
# builder has to be done here instead. That is three things, and missing any
# one of them produces a file Play refuses:
#
#   1. versionCode. `appVersionSource: "remote"` keeps it on EAS's servers, so
#      `expo prebuild` writes `versionCode 1` every time. Play requires it to be
#      strictly greater than anything already uploaded.
#   2. versionName. Prebuild takes this from app.json correctly, but it is
#      asserted here anyway — a stale android/ directory is the likelier bug.
#   3. ⚠️ SIGNING. The Expo template sets `release { signingConfig
#      signingConfigs.debug }`, with a comment admitting it. A debug-signed AAB
#      is not merely unsigned-looking: its certificate does not match the upload
#      certificate Play has on file, and the upload is rejected.
#
# ⚠️ NO SECRET IS READ BY THIS SCRIPT, PASSED ON A COMMAND LINE, OR WRITTEN INTO
# THE REPOSITORY, WHICH IS PUBLIC. The keystore and its passwords live in a
# properties file outside the tree; Gradle reads it directly. Nothing here ever
# holds the values, so nothing here can leak them into a log or a shell history.
#
# Usage:
#   tools/build-aab-local.sh [versionCode]
#
# Prerequisites, once:
#   1. Download the upload keystore from EAS. It is interactive by design:
#        eas credentials --platform android
#      → production → Keystore → Download. It prints the alias and both
#      passwords; keep that window.
#   2. Put the .jks somewhere outside this repository:
#        ~/.secrets/morse_app/upload-keystore.jks
#   3. Write ~/.secrets/morse_app/upload-keystore.properties with the four
#      values it printed:
#        storeFile=C:/Users/<you>/.secrets/morse_app/upload-keystore.jks
#        storePassword=...
#        keyAlias=...
#        keyPassword=...
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SECRETS="${MORSE_KEYSTORE_PROPERTIES:-$HOME/.secrets/morse_app/upload-keystore.properties}"
VERSION_NAME="$(node -p "require('./app.json').expo.version")"
VERSION_CODE="${1:-}"

if [ ! -f "$SECRETS" ]; then
  echo "✗ No keystore properties at: $SECRETS" >&2
  echo "  Download the keystore first — see the header of this script." >&2
  exit 1
fi

# ⚠️ Read for PRESENCE only. The values are never echoed, never exported and
# never interpolated into a command; Gradle opens this file itself.
for key in storeFile storePassword keyAlias keyPassword; do
  grep -q "^${key}=" "$SECRETS" || { echo "✗ $SECRETS is missing '$key'" >&2; exit 1; }
done
KEYSTORE_FILE="$(grep '^storeFile=' "$SECRETS" | cut -d= -f2-)"
[ -f "$KEYSTORE_FILE" ] || { echo "✗ storeFile does not exist: $KEYSTORE_FILE" >&2; exit 1; }

if [ -z "$VERSION_CODE" ]; then
  echo "✗ No versionCode given." >&2
  echo "  Ask EAS what it holds, and pass a number greater than anything on Play:" >&2
  echo "    eas build:version:get --platform android" >&2
  exit 1
fi

echo "▸ ${VERSION_NAME} (${VERSION_CODE})"

# ⚠️ --clean, always. A stale android/ is how a build silently ships the
# previous version's native config: the directory is gitignored, so nothing
# else notices it is out of date.
echo "▸ prebuild"
npx expo prebuild --platform android --clean --no-install

# ⚠️ A RELATIVE path, on purpose. Under Git Bash `$ROOT` is `/c/Github/...`,
# which Node on Windows reads as `C:\c\Github\...`. MSYS rewrites such a path
# when it is a bare argument, but not when it is embedded in a string — the
# first version of this patched build.gradle through `node -e` and died on
# exactly that. The script resolves its own paths from `__dirname`.
echo "▸ versionCode, versionName and release signing"
node tools/patch-android-release.js "$VERSION_CODE"

echo "▸ bundleRelease"
cd android
./gradlew bundleRelease --no-daemon

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$AAB" ] || { echo "✗ No AAB at $AAB" >&2; exit 1; }

OUT="$ROOT/../omnimorse-${VERSION_NAME}-${VERSION_CODE}-play.aab"
cp "$AAB" "$OUT"

echo
echo "✓ $OUT"
echo
# ⚠️ READ THE VERSION BACK OFF THE ARTEFACT, never off the build log. A failed
# build still consumes a number, which is how 0.3.5's good ad-hoc IPA ended up
# at 15 while its log said 14.
echo "▸ what the file actually says:"
unzip -p "$OUT" BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties 2>/dev/null || true
if command -v aapt2 >/dev/null 2>&1; then
  aapt2 dump badging "$OUT" 2>/dev/null | head -2 || true
fi
echo "  (verify the signature with: jarsigner -verify -verbose -certs \"$OUT\" | head)"
