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

# ⚠️ Seconds trimmed off the front of each tab clip. The four are recorded as
# four separate runs and played simultaneously, so this is what hides the
# launch, the guide dismissal and the tab tap they all share. Raise it if the
# grid opens on the welcome carousel; lower it if a cell has finished its
# business before the others start.
LEAD_IN=${LEAD_IN:-6}
GRID_SECONDS=${GRID_SECONDS:-16}

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
  -i "$CLIPS/tour.mp4" \
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
  $(for t in "${TABS[@]}"; do printf -- '-ss %s -t %s -i %s ' "$LEAD_IN" "$GRID_SECONDS" "$CLIPS/$t.mp4"; done) \
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
