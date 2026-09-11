#!/usr/bin/env bash
#
# Composes the two store/social videos from raw device recordings.
#
#   tools/compose-video.sh <clips-dir> <output-dir>
#
# Expects five recordings in <clips-dir>, named for the flow that produced
# them: tour.mp4, tab-translate.mp4, tab-speak.mp4, tab-tap.mp4, tab-learn.mp4.
#
# Produces two files, both 1920x1080 H.264:
#
#   promo-youtube.mp4    the Play Console promo — Play takes a YOUTUBE URL, not
#                        an upload, so this is what gets uploaded to YouTube
#   linkedin-fourup.mp4  all four tabs running side by side in one frame
#
# ⚠️ No text is drawn on either. The cards at each end are the real feature
# graphic, which is already a designed asset with the wordmark and the
# punchline on it. Drawing text here instead would mean depending on a font
# being installed, and the font that exists on a GitHub runner is not the font
# that exists on the machine someone re-runs this on — so the output would
# quietly differ between the two.
set -euo pipefail

CLIPS=${1:?usage: compose-video.sh <clips-dir> <output-dir>}
OUT=${2:?usage: compose-video.sh <clips-dir> <output-dir>}

CARD=${CARD:-docs/store-listing/graphics/play-feature-graphic.png}
# theme.ts `ink`. The letterboxing around a portrait phone is most of the
# frame, so it may as well be the app's own colour.
GROUND=${GROUND:-0x101820}
FPS=${FPS:-30}
CARD_SECONDS=${CARD_SECONDS:-2}
# Height of the phone in the promo, inside a 1080 frame — the difference is
# the margin above and below it.
PHONE_H=${PHONE_H:-1000}

# ⚠️ Both clips are trimmed from the END, not the front, and that is the whole
# trick. Everything variable happens at the FRONT of a recording — emulator
# boot, Maestro's driver, the app launch, and any retries a flow needed — while
# what is worth watching is at the end, where each flow holds still on purpose.
# The first attempt trimmed a fixed six seconds off the front and was wrong by
# fifty, because a flow that retried twice pushed all its content later.
#
# Trimming from the end makes startup time irrelevant, and it degrades kindly:
# ask for more seconds than a clip has and ffmpeg gives you the whole clip.
GRID_SECONDS=${GRID_SECONDS:-16}

# ⚠️ Tuned to land just AFTER the app launches, not to cover the whole file.
#
# There are about twenty seconds of rubbish at the head of every tour clip:
# the previous flow's last screen, the launcher, and the splash. Recording
# starts before Maestro does, and Maestro's first act is to relaunch the app.
#
# At 150 — larger than the whole clip — the promo opened on the Learn tab left
# over from the flow before it and sat there for fifteen seconds. At 60 it
# took only the last minute, which on a tour that spends its middle playing a
# message was one screen and nothing else. This sits between: it clears the
# head and keeps the entire journey from the welcome carousel onward.
TOUR_SECONDS=${TOUR_SECONDS:-120}

# ⚠️ Seconds of the final frame CLONED onto the end of every clip.
#
# The device's own rest cannot be relied on to reach the file: screenrecord
# emits frames only when the screen changes, so a still screen may contribute
# no frames AND no duration — tab-learn's 55-second recording produced a file
# ending at 38s. Cloning the last frame here guarantees the tail exists, so the
# trim below always lands on the screen the flow arrived at rather than on
# whatever happened to be on screen earlier.
#
# It is belt and braces with REST_SECONDS in the recorder, deliberately: the
# real rest is what captures a message still playing, and this is what
# guarantees a tail when there was no motion to record.
# ⚠️ Deliberately SMALLER than GRID_SECONDS. Defaulting it to the same value
# meant the trim window was exactly the cloned still, so every cell was a
# freeze-frame no matter what the device had recorded. It is insurance against
# a clip whose static tail never reached the file, not the tail itself.
TAIL_PAD=${TAIL_PAD:-4}

# One cell of the four-up. Four of these side by side is 1712 wide, which
# leaves a margin inside 1920 and 130px of headroom inside 1080.
CELL_W=${CELL_W:-428}
CELL_H=${CELL_H:-950}

TABS=(tab-translate tab-speak tab-tap tab-learn)

# ⚠️ A SILENT audio track, added deliberately, on both outputs.
#
# `adb shell screenrecord` cannot capture audio at all — there is no flag for
# it — so the footage of an app whose headline feature is playing Morse as
# SOUND arrives mute, and nothing here can change that. What this does avoid is
# the second problem: a file with no audio STREAM at all is rejected or
# silently re-encoded by several upload pipelines, and diagnosing that from the
# other side of an upload form is miserable. A track that exists and is silent
# costs a few kilobytes.
#
# If the promo wants music, add it on YouTube rather than here: Play takes a
# YouTube URL, so the soundtrack is a property of the upload, not of this file.
SILENT_AUDIO=(-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100)

command -v ffmpeg >/dev/null || { echo "::error::ffmpeg is not installed." >&2; exit 1; }
[ -f "$CARD" ] || { echo "::error::No card image at $CARD" >&2; exit 1; }
mkdir -p "$OUT"

missing=()
for name in tour "${TABS[@]}"; do
  [ -f "$CLIPS/$name.mp4" ] || missing+=("$name.mp4")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "::error::Missing recordings in $CLIPS: ${missing[*]}" >&2
  exit 1
fi

echo "--- what came in ---"
for name in tour "${TABS[@]}"; do
  printf '%-16s %s\n' "$name" \
    "$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height -show_entries format=duration \
        -of csv=p=0:s=x "$CLIPS/$name.mp4" | tr '\n' ' ')"
done

# ⚠️ Every clip that reaches `concat` has to agree on size, pixel format, frame
# rate AND sample aspect ratio. A mismatch in any one of them fails the filter
# graph with a message that names none of them.
card_chain="scale=1920:1080:force_original_aspect_ratio=decrease,\
pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=$GROUND,setsar=1,fps=$FPS,format=yuv420p"

SILENT_INDEX=2
# ⚠️ NORMALISE TO A CONSTANT FRAME RATE FIRST. This is not tidiness; without
# it the four-up comes out EMPTY.
#
# `adb shell screenrecord` encodes surface updates, not wall-clock time: a
# screen that is not changing produces NO FRAMES AT ALL. Every flow here ends
# by resting on its destination — which is the entire point, it is the footage
# the grid uses — so the tail of a static clip contains nothing to show. Two of
# the four cells decoded zero frames after `-sseof`, `hstack` had nothing to
# stack, and the grid collapsed to its two end cards.
#
# It is visible in the durations too: tab-learn's file ended at 38s despite a
# 55-second recording, because the container's duration is just the timestamp
# of the last frame anything bothered to emit.
#
# `fps=$FPS` duplicates frames across the gaps, so a resting screen becomes a
# still image that actually exists on the timeline and can be seeked into.
echo "--- normalising to $FPS fps ---"
NORMALISED=$(mktemp -d)
trap 'rm -rf "$NORMALISED"' EXIT
for name in tour "${TABS[@]}"; do
  ffmpeg -hide_banner -loglevel error -y -i "$CLIPS/$name.mp4" \
    -vf "fps=$FPS,tpad=stop_mode=clone:stop_duration=$TAIL_PAD" \
    -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p \
    "$NORMALISED/$name.mp4"
  printf '  %-16s %ss\n' "$name" \
    "$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$NORMALISED/$name.mp4")"
done
CLIPS=$NORMALISED

echo "--- promo-youtube.mp4 ---"
# ⚠️ The sides are the flat ink ground, NOT a blurred copy of the footage.
# The blur was tried first and is the obvious thing to reach for, but this app
# is a white UI: blowing a portrait frame up to cover 1920x1080 crops a thin
# band out of the middle of a mostly-white card and blurs it to near-white, so
# the phone loses its edge and the frame reads as a white rectangle on white.
# A dark ground gives the phone a hard edge and matches the four-up.
#
# `-2` in the scale, not `-1`: H.264 needs even dimensions, and 1000px of a
# 1080x2400 phone is 450 either way only by luck. A profile change that made it
# odd would fail the encode rather than the scale, some minutes later.
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t "$CARD_SECONDS" -i "$CARD" \
  -sseof -"$TOUR_SECONDS" -i "$CLIPS/tour.mp4" \
  "${SILENT_AUDIO[@]}" \
  -filter_complex "
    [0:v]$card_chain[card];
    [card]split=2[intro][outro];
    [1:v]fps=$FPS,scale=-2:$PHONE_H,
         pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=$GROUND,
         setsar=1,format=yuv420p[body];
    [intro][body][outro]concat=n=3:v=1:a=0[v]
  " \
  -map "[v]" -map "$SILENT_INDEX:a" -shortest \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 96k \
  -movflags +faststart "$OUT/promo-youtube.mp4"

SILENT_INDEX=5
echo "--- linkedin-fourup.mp4 ---"
cells=""
chain=""
for i in "${!TABS[@]}"; do
  # ⚠️ `force_original_aspect_ratio` and a pad, not a bare scale to the cell
  # size. A bare scale silently stretches the phone if the emulator profile
  # ever changes shape, and a stretched UI in a published video is the kind of
  # thing only the person who designed it notices.
  chain="$chain[$((i + 1)):v]fps=$FPS,scale=$CELL_W:$CELL_H:force_original_aspect_ratio=decrease,\
pad=$CELL_W:$CELL_H:(ow-iw)/2:(oh-ih)/2:color=$GROUND,setsar=1[c$i];"
  cells="$cells[c$i]"
done

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t "$CARD_SECONDS" -i "$CARD" \
  $(for t in "${TABS[@]}"; do printf -- '-sseof -%s -i %s ' "$GRID_SECONDS" "$CLIPS/$t.mp4"; done) \
  "${SILENT_AUDIO[@]}" \
  -filter_complex "
    [0:v]$card_chain[card];
    [card]split=2[intro][outro];
    $chain
    ${cells}hstack=inputs=4:shortest=1[row];
    [row]pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=$GROUND,setsar=1,format=yuv420p[body];
    [intro][body][outro]concat=n=3:v=1:a=0[v]
  " \
  -map "[v]" -map "$SILENT_INDEX:a" -shortest \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 96k \
  -movflags +faststart "$OUT/linkedin-fourup.mp4"

echo "--- what came out ---"
for f in promo-youtube linkedin-fourup; do
  printf '%-22s %s\n' "$f.mp4" \
    "$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height -show_entries format=duration \
        -of csv=p=0:s=x "$OUT/$f.mp4" | tr '\n' ' ')"
done
