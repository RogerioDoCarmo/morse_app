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

# ⚠️ THE RECORDING IS WHAT PROVIDES THE DWELL, not the flow.
#
# `waitForAnimationToEnd: timeout: N` does NOT hold for N. N is a MAXIMUM: on a
# screen that is not animating, it returns in under a second. Flows written
# with 18-second "holds" therefore raced through and stopped, and the tail of
# each clip was whatever came next rather than the screen it had reached —
# tab-speak's last frames were the app relaunching.
#
# So the recorder runs for a FIXED length and is never stopped early. A flow
# finishes, the app rests on its final screen, and screenrecord keeps rolling.
# That rest is the footage the four-up uses, and it is why a flow now ends the
# moment it has arrived somewhere worth looking at.
#
# screenrecord's own ceiling is 180s and it stops dead at the limit, so these
# must stay under it AND over the longest a flow can take.
CLIP_SECONDS=${CLIP_SECONDS:-55}
TOUR_CLIP_SECONDS=${TOUR_CLIP_SECONDS:-130}

mkdir -p "$OUT"

# ⚠️ HIDE SYSTEM ERROR DIALOGS. The first successful run of this script
# recorded five clips with "Pixel Launcher isn't responding" sitting on top of
# every frame: a pixel_6 profile at 1080p through swiftshader, with animations
# on, is heavy enough to ANR the launcher. The dialog then covered the app, so
# Maestro could not see `first-run` and every flow failed through its retries.
#
# The step still reported success, because `continue-on-error` is what keeps
# partial footage — so the only evidence was in the footage itself.
echo "--- suppressing system error dialogs ---"
adb shell settings put global hide_error_dialogs 1 || true
# That stops the NEXT one; anything already up needs dismissing.
adb shell input keyevent KEYCODE_BACK || true
adb shell input keyevent KEYCODE_HOME || true

# ⚠️ Animations are turned on HERE rather than in the workflow, so the emulator
# boots and settles the launcher cheaply and only the recording pays for them.
# They are the subject of a video — an app recorded with its transitions off
# looks broken rather than fast — but they are also what tipped the launcher
# into an ANR when they were on for the whole job.
echo "--- enabling animations for the recording ---"
for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
  adb shell settings put global "$scale" 1 || true
done

# ⚠️ Warm the driver BEFORE any recording starts. Maestro installs and launches
# its own instrumentation APK on first use, which takes the better part of a
# minute — and recorded, that minute is the launcher sitting at the front of
# whichever flow happened to go first.
echo "--- warming the Maestro driver ---"
maestro hierarchy > /dev/null 2>&1 || true

record() {
  local name=$1
  echo "--- $name ---"

  local limit=$CLIP_SECONDS
  [ "$name" = tour ] && limit=$TOUR_CLIP_SECONDS

  adb shell screenrecord --bit-rate "$BIT_RATE" --time-limit "$limit" \
    "/sdcard/$name.mp4" &
  local recorder=$!
  sleep 2

  maestro test "$FLOWS/$name.yaml" \
    || echo "::warning::$name.yaml did not finish; keeping what it recorded."

  # ⚠️ The recorder is NOT stopped here. It runs to its own time limit while the
  # app rests on whatever screen the flow left it on, and that rest is the
  # footage. Stopping it the moment the flow returned is what made the first
  # four-up show a relaunching app instead of the Speak tab.
  #
  # screenrecord also only finalises the MP4 container when it ends of its own
  # accord or is INTerrupted; a -9 from the host leaves an unplayable file.
  echo "    flow done; letting the recorder run out its ${limit}s"
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
