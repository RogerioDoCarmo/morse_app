#!/usr/bin/env bash
#
# Uploads the newest App Store IPA to App Store Connect.
#
#   pnpm submit:ios                      # prompts for the password
#   pnpm submit:ios abcd-efgh-ijkl-mnop  # or takes it as an argument
#   ALTOOL_APP_PASSWORD=… pnpm submit:ios
#
# ⚠️ THE PASSWORD IS AN APP-SPECIFIC ONE, not the Apple ID password. altool
# cannot answer a two-factor prompt, which is the entire reason Apple issues
# these. Make one at appleid.apple.com → Sign-In and Security → App-Specific
# Passwords. It is shown once.
#
# ⚠️ PASSING IT AS AN ARGUMENT PUTS IT IN YOUR SHELL HISTORY. It is accepted
# because it is convenient, not because it is safe. Two better routes, both
# supported by altool itself:
#
#   Keychain, once:  security add-generic-password -a "$APPLE_ID" \
#                      -s omnimorse-altool -w '<the password>'
#                    …then this script finds it with no argument at all.
#   Environment:     ALTOOL_APP_PASSWORD=… pnpm submit:ios
#
# However it arrives, it is handed to altool through `@env:` so it never
# appears in the process list where any other process could read it.
set -euo pipefail

APPLE_ID=${APPLE_ID:-rogerio.carmo02@gmail.com}
KEYCHAIN_ITEM=${KEYCHAIN_ITEM:-omnimorse-altool}

# ── Which file ──────────────────────────────────────────────────────────────
# Newest by modification time rather than a name typed in: this directory
# accumulates a build per attempt, and the one you want is almost always the
# last one made.
IPA=${IPA:-$(ls -t build-*.ipa 2>/dev/null | head -1)}
[ -n "$IPA" ] || { echo "::error::No build-*.ipa in $PWD. Run pnpm build:ipa:local first." >&2; exit 1; }

# ⚠️ REFUSE AN AD-HOC BUILD. Both kinds land in this directory with
# indistinguishable names, and `build:ipa:adhoc:local` is the one run more
# often — it is what goes to Firebase. Apple rejects an ad-hoc upload after
# the transfer, with a message about the provisioning profile that reads like
# a signing problem rather than "you picked the wrong file".
#
# The tell is `ProvisionedDevices`: an ad-hoc profile lists the UDIDs it may
# install on, and an App Store profile has no such key.
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
unzip -q -o "$IPA" -d "$TMP" "Payload/*.app/Info.plist" "Payload/*.app/embedded.mobileprovision" 2>/dev/null || true
PLIST=$(find "$TMP/Payload" -maxdepth 2 -name Info.plist 2>/dev/null | head -1)
PROFILE=$(find "$TMP/Payload" -maxdepth 2 -name embedded.mobileprovision 2>/dev/null | head -1)
[ -n "$PLIST" ] || { echo "::error::$IPA does not look like an iOS app bundle." >&2; exit 1; }

if [ -n "$PROFILE" ]; then
  security cms -D -i "$PROFILE" > "$TMP/p.plist" 2>/dev/null || true
  if /usr/libexec/PlistBuddy -c 'Print :ProvisionedDevices' "$TMP/p.plist" >/dev/null 2>&1; then
    echo "::error::$IPA is AD-HOC signed — it carries a ProvisionedDevices list." >&2
    echo "  That build is for Firebase App Distribution. App Store Connect needs" >&2
    echo "  the one from 'pnpm build:ipa:local', not 'build:ipa:adhoc:local'." >&2
    exit 1
  fi
fi

VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")
BUILD=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")
BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")
printf 'Uploading %s\n  %s (%s)  %s\n  as %s\n' "$IPA" "$VERSION" "$BUILD" "$BUNDLE" "$APPLE_ID"

# ── The password ────────────────────────────────────────────────────────────
PASSWORD=${1:-${ALTOOL_APP_PASSWORD:-}}
if [ -z "$PASSWORD" ]; then
  PASSWORD=$(security find-generic-password -a "$APPLE_ID" -s "$KEYCHAIN_ITEM" -w 2>/dev/null || true)
  [ -n "$PASSWORD" ] && echo "  password from keychain item '$KEYCHAIN_ITEM'"
fi
if [ -z "$PASSWORD" ]; then
  # ⚠️ zsh and bash disagree about `read`: zsh puts the prompt inside the
  # variable spec and treats `-p` as a coprocess flag. This runs under sh via
  # pnpm, so the prompt is printed separately and read plainly.
  printf 'App-specific password: ' >&2
  stty -echo 2>/dev/null || true
  read -r PASSWORD
  stty echo 2>/dev/null || true
  printf '\n' >&2
fi
[ -n "$PASSWORD" ] || { echo "::error::No password given." >&2; exit 1; }

# `@env:` rather than the value: the password never reaches the process list.
export ALTOOL_PW="$PASSWORD"
xcrun altool --upload-app -f "$IPA" -t ios -u "$APPLE_ID" -p '@env:ALTOOL_PW'
