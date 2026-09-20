#!/usr/bin/env bash
#
# Boots the first available simulator from a list, installs the app, runs the
# screenshot flow, and collects what it produced.
#
#   tools/capture-ios-screenshots.sh <output-dir> <device> [fallback device...]
#
# Devices are tried in order, so the first name is the one whose dimensions the
# store actually wants and the rest are what a runner might have instead.
#
# ⚠️ This exists because App Store Connect wants TWO sets — a 6.9-inch iPhone
# and a 13-inch iPad — and `supportsTablet` is true, so the iPad one is not
# optional. Capturing them is the same twelve steps twice.
set -euo pipefail

OUT=${1:?usage: capture-ios-screenshots.sh <output-dir> <device> [fallback...]}
shift
[ $# -gt 0 ] || { echo "::error::No simulator names given." >&2; exit 1; }

APP=${APP:?APP must point at the built .app}
FLOW=${FLOW:-.maestro/screenshots.yaml}

# ⚠️ A LITERAL match, not a regex. The old inline version interpolated the
# wanted name straight into an awk pattern, which is fine for "iPhone 17 Pro
# Max" and silently wrong for "iPad Pro 13-inch (M4)" — those parentheses are
# a regex group, so it would match nothing and fall through to the warning.
#
# ⚠️ And a PREFIX, not the whole name. The first version asked for
# "iPad Pro 13-inch (M4)" on a runner that had "iPad Pro 13-inch (M5)" and
# found nothing. The chip revision is not the part that decides the screen
# size, so it is not the part to match on — asking for "iPad Pro 13-inch"
# survives Apple shipping an M6.
udid=""
chosen=""
for want in "$@"; do
  line=$(xcrun simctl list devices available | grep -F "$want" | head -1) || true
  udid=$(printf '%s' "$line" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')
  if [ -n "$udid" ] && [ "$udid" != "$line" ]; then
    # The full name as simctl reports it, so the log says which chip it got.
    chosen=$(printf '%s' "$line" | sed -E 's/^ *(.*) \([0-9A-Fa-f-]{36}\).*/\1/')
    break
  fi
  udid=""
done

if [ -z "$udid" ]; then
  echo "::error::None of these simulators are available: $*"
  xcrun simctl list devices available
  exit 1
fi
echo "Using $chosen ($udid)"

# ⚠️ Maestro writes screenshots into its own per-run directory under
# ~/.maestro/tests, and this script is called more than once per job. Without
# clearing it, the second capture collects the first one's images as well and
# the iPad artifact quietly contains iPhone screenshots.
rm -rf "$HOME/.maestro/tests"

xcrun simctl boot "$udid" || true
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$APP"

# ⚠️ ONE PASS PER LOCALE, and the mapping is NOT the identity. The app speaks
# `en`, `pt-BR` and `es`; the stores want `en-US`, `pt-BR` and `es-419`. Only
# the middle one is the same string. The app tag goes into a testID, the store
# tag names the folder, and confusing the two is found at upload.
#
# ⚠️ `rm -rf` between passes as well as before the first. Maestro reuses its
# run directory, so without it the second locale's folder collects the first
# one's images — an English set filed as Portuguese, at dimensions that look
# perfectly right.
for pair in "en:en-US" "pt-BR:pt-BR" "es:es-419"; do
  app=${pair%%:*}
  store=${pair##*:}
  echo "--- $chosen · $store (app locale $app) ---"

  rm -rf "$HOME/.maestro/tests"
  maestro --device "$udid" -e LOCALE="$app" test "$FLOW"

  mkdir -p "$OUT/$store"
  # ⚠️ A LETTER PREFIX, not digits. This read `[0-9][0-9]-*.png` and matched
  # nothing the moment the captures were renamed `a-` … `f-` for Play's upload
  # ordering — a silent empty set after a full simulator build. The shape is
  # asserted in screenshots-capture.test.ts so this and the flow stay in step.
  find "$HOME/.maestro/tests" -name '[a-z]-*.png' -exec cp {} "$OUT/$store/" \;

  # ⚠️ The size the store actually wants, REPORTED rather than assumed. A run
  # that quietly produced the wrong dimensions is worse than one that failed,
  # because it is only found at upload — which is how a full set of Android
  # screenshots reached the listing at 320x640.
  for f in "$OUT/$store"/*.png; do
    printf '%s  %s\n' \
      "$(sips -g pixelWidth -g pixelHeight "$f" | awk -F': ' '/pixel/{printf "%sx", $2}')" \
      "$store/$(basename "$f")"
  done

  test -n "$(ls -A "$OUT/$store")" || {
    echo "::error::The flow produced no screenshots for $store."; exit 1;
  }
done

xcrun simctl shutdown "$udid" || true
