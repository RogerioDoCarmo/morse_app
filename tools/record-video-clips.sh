#!/usr/bin/env bash
#
# Records one screen capture per flow in `.maestro/video/`, on whatever device
# adb is currently talking to.
#
#   tools/record-video-clips.sh <output-dir>
#
# ⚠️ THIS FILE EXISTS BECAUSE OF ONE LINE IN A GITHUB ACTION.
#
# `reactivecircus/android-emulator-runner` does not run its `script:` as a
# script. It splits it on newlines and runs each line through its own
# `sh -c` — so a shell function, a loop, or anything else spanning more than
# one line is torn apart, and the failure reads:
#
#     /usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "}")
#
# ...attributed to the line AFTER the one that actually opened the brace. The
# screenshots job never hit this because both of its lines stand alone. The
# rule for that `script:` block is therefore: every line must be a complete
# command on its own. Multi-step logic goes in a file like this one and is
# invoked in a single line.
set -euo pipefail

OUT=${1:?usage: record-video-clips.sh <output-dir>}
FLOWS=${FLOWS:-.maestro/video}

# ⚠️ The tour goes LAST. It is the promo — the one clip whose opening seconds a
# stranger sees — so it should not be the flow that wears whatever driver
# warm-up is left over.
ORDER=(tab-translate tab-speak tab-tap tab-learn tour)

BIT_RATE=${BIT_RATE:-8000000}
# screenrecord's own ceiling is 180s and it stops dead at the limit.
TIME_LIMIT=${TIME_LIMIT:-180}

mkdir -p "$OUT"

# ⚠️ Warm the driver BEFORE any recording starts. Maestro installs and launches
# its own instrumentation APK on first use, which takes the better part of a
# minute — and recorded, that minute is the launcher sitting at the front of
# whichever flow happened to go first.
echo "--- warming the Maestro driver ---"
maestro hierarchy > /dev/null 2>&1 || true

record() {
  local name=$1
  echo "--- $name ---"

  adb shell screenrecord --bit-rate "$BIT_RATE" --time-limit "$TIME_LIMIT" \
    "/sdcard/$name.mp4" &
  local recorder=$!
  sleep 2

  maestro test "$FLOWS/$name.yaml" \
    || echo "::warning::$name.yaml did not finish; keeping what it recorded."

  # screenrecord writes on the DEVICE and only finalises the MP4 container when
  # it is interrupted. A -9 from the host leaves an unplayable file, so this
  # has to be an INT delivered on the device itself.
  adb shell pkill -INT screenrecord || true
  wait "$recorder" || true
  # The finalise is not instant and `adb pull` does not wait for it.
  sleep 3

  adb pull "/sdcard/$name.mp4" "$OUT/$name.mp4" \
    || echo "::warning::No recording pulled for $name."
  adb shell rm -f "/sdcard/$name.mp4" || true
}

for flow in "${ORDER[@]}"; do
  record "$flow"
done

echo "--- what was recorded ---"
ls -la "$OUT"
test -n "$(ls -A "$OUT")" || { echo "::error::No clips were recorded at all."; exit 1; }
