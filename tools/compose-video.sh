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

# ⚠️ THE AUDIO IS RE-RENDERED, NOT RECORDED.
#
# `adb shell screenrecord` cannot capture audio at all — there is no flag for
# it — so footage of an app whose headline feature is playing Morse as SOUND
# arrives mute. Rather than dub music over it, the soundtrack is produced by
# the APP'S OWN encoder, timeline and tone renderer, for the same message and
# speed the flow typed: see tools/render-morse-audio.ts. It is not a
# soundalike, it is the same code that drives the speaker.
#
# Where it goes is measured from the footage rather than predicted — see
# tools/detect-playback-start.sh — because everything about when a flow
# reaches the play button is variable, and a soundtrack half a second out is
# worse than silence.
#
# The fallback is still a silent track. A file with no audio STREAM at all is
# rejected or silently re-encoded by several upload pipelines, and diagnosing
# that from the far side of an upload form is miserable.
SILENT_AUDIO=(-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100)

# ⚠️ WHAT THE PUBLISHED FILE CARRIES, which is not what the app renders.
#
# `renderWav` produces 8 kHz MONO, and that is right for the app: a 600 Hz sine
# needs nothing more, and it keeps a saved message under a megabyte a minute.
# Passed through to a published video it is wrong for a different reason — 8 kHz
# mono is telephone quality, YouTube and LinkedIn re-encode it, and a viewer
# hears "bad audio" even though the tone itself is clean at any rate above
# 1.2 kHz.
#
# Resampled on the way out only. Nothing about the app changes, and the tone is
# still the app's own — the same samples, carried at a rate a video platform
# expects.
AUDIO_RATE=${AUDIO_RATE:-44100}
AUDIO_CHANNELS=${AUDIO_CHANNELS:-2}
AUDIO_BITRATE=${AUDIO_BITRATE:-128k}

# What each recorded flow types, and how slowly it plays it. ⚠️ These MUST
# match the flows; `video-assets.test.ts` fails the build if they drift, because
# audio of a different message than the one on screen is worse than none.
TOUR_TEXT=${TOUR_TEXT:-MORSE CODE}
TRANSLATE_TEXT=${TRANSLATE_TEXT:-OMNIMORSE ENCODE DECODE LEARN}
PLAYBACK_WPM=${PLAYBACK_WPM:-5}

# ⚠️ WHETHER A SILENT RESULT IS ALLOWED TO PASS. It is not, by default.
#
# `plan_audio` fails softly — if the flash cannot be located in the footage it
# returns nothing and the composition falls back to `SILENT_AUDIO`, which is a
# real, valid, completely silent stream. Every check downstream passes: the
# file has an audio stream, ffprobe is happy, the workflow is green, and the
# artifact is a mute demo of an app whose headline feature is sound.
#
# That is not hypothetical. Two promo videos were delivered exactly that way
# and had to be redone, which is why "does this need audio?" is now the first
# question asked about any video here. A pipeline that can quietly answer "no"
# on its own makes the question pointless.
#
# Set REQUIRE_AUDIO=0 only to deliberately produce a silent cut.
REQUIRE_AUDIO=${REQUIRE_AUDIO:-1}

# Stops the run when a soundtrack was expected and could not be produced.
#
# Loud and early: by the time the artifact is downloaded, the person looking at
# it has no way to tell a deliberate silent cut from a failed onset detection.
require_audio() {
  local name=$1 plan=$2
  [ -n "$plan" ] && return 0
  if [ "$REQUIRE_AUDIO" = "1" ]; then
    echo "::error::$name would be SILENT — playback could not be located in the footage." >&2
    echo "  The flash onset is measured from the clip, so this usually means the flow" >&2
    echo "  never reached the play button, or the recording stopped before it did." >&2
    echo "  Re-run with REQUIRE_AUDIO=0 only if a silent cut is what you actually want." >&2
    exit 1
  fi
  echo "    $name: no audio, and REQUIRE_AUDIO=0 — continuing with a silent track." >&2
}

AUDIO_DIR=$(mktemp -d)
trap 'rm -rf "$AUDIO_DIR" "${NORMALISED:-}"' EXIT

# Renders the tone for one flow and reports where it belongs in the OUTPUT
# timeline, or nothing at all when playback cannot be found in the clip.
#
#   plan_audio <normalised clip> <text> <trim start> -> "<wav>|<offset seconds>"
plan_audio() {
  local clip=$1 text=$2 trim_start=$3
  local onset wav offset
  onset=$(tools/detect-playback-start.sh "$clip" 2>/dev/null || true)
  [ -n "$onset" ] || { echo "    no playback found in $(basename "$clip") — leaving it silent" >&2; return 1; }

  wav="$AUDIO_DIR/$(basename "$clip" .mp4).wav"
  npx -y tsx tools/render-morse-audio.ts "$text" "$PLAYBACK_WPM" "$wav" >/dev/null || return 1

  # Where the flash lands once the clip has been trimmed and a card put in
  # front of it.
  #
  # ⚠️ A NEGATIVE result does not mean "no audio", and clamping it to zero is
  # wrong. It means the window opens PART-WAY THROUGH the message — which is
  # exactly what the four-up does, taking the last sixteen seconds of a clip
  # whose playback began ninety seconds earlier. The tone then has to start
  # part-way through too, or the sound is minutes out of step with the flashing
  # it is supposed to match.
  #
  # ⚠️ AND THE SAME CLAMP WAS STILL ON THE OFFSET, one line below that
  # warning. `max(0, CARD + (onset - trim))` collapses to 0 whenever the flash
  # precedes the window — which is the four-up's normal case — and swallows
  # CARD_SECONDS with it. The tone then started at output 0.000s, over the
  # intro card, two seconds before the footage it belongs to.
  #
  # The offset is where the audio starts IN THE OUTPUT, and the earliest that
  # can ever be is the end of the card. Only the part inside the window is
  # allowed to push it later; the part before the window belongs in `seek`.
  local seek
  seek=$(python3 -c "print(f'{max(0.0, $trim_start - $onset):.3f}')")
  offset=$(python3 -c "print(f'{$CARD_SECONDS + max(0.0, $onset - $trim_start):.3f}')")
  echo "    $(basename "$clip"): flash at ${onset}s -> audio at ${offset}s of the output, from ${seek}s into the tone" >&2
  echo "$wav|$offset|$seek"
}

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
duration_of() {
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"
}

echo "--- normalising to $FPS fps ---"
NORMALISED=$(mktemp -d)
for name in tour "${TABS[@]}"; do
  ffmpeg -hide_banner -loglevel error -y -i "$CLIPS/$name.mp4" \
    -vf "fps=$FPS,tpad=stop_mode=clone:stop_duration=$TAIL_PAD" \
    -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p \
    "$NORMALISED/$name.mp4"
  printf '  %-16s %ss\n' "$name" \
    "$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$NORMALISED/$name.mp4")"
done
CLIPS=$NORMALISED

echo "--- audio, re-rendered from the app's own tone ---"
tour_norm_s=$(duration_of "$CLIPS/tour.mp4")
tour_trim=$(python3 -c "print(max(0.0, $tour_norm_s - $TOUR_SECONDS))")
tour_audio=$(plan_audio "$CLIPS/tour.mp4" "$TOUR_TEXT" "$tour_trim") || tour_audio=""
require_audio promo-youtube "$tour_audio"

grid_norm_s=$(duration_of "$CLIPS/tab-translate.mp4")
grid_trim=$(python3 -c "print(max(0.0, $grid_norm_s - $GRID_SECONDS))")
grid_audio=$(plan_audio "$CLIPS/tab-translate.mp4" "$TRANSLATE_TEXT" "$grid_trim") || grid_audio=""
require_audio linkedin-fourup "$grid_audio"

# ⚠️ `adelay` then `apad`: the delay puts the tone where the flash is, and the
# pad keeps the stream alive to the end of the video. Without the pad the audio
# stream ends when the tone does, and `-shortest` then truncates the outro card
# with it.
#
# The audio is always the LAST input, so its index is the same whether it is a
# rendered tone or the silent fallback — which is what lets one encode command
# serve both.
plan_to_args() {
  local plan=$1 index=$2
  if [ -z "$plan" ]; then
    AUDIO_IN=("${SILENT_AUDIO[@]}")
    AUDIO_FILTER=""
    AUDIO_MAP="$index:a"
    return
  fi
  local wav offset seek ms
  IFS='|' read -r wav offset seek <<<"$plan"
  ms=$(python3 -c "print(int(float('$offset') * 1000))")
  # ⚠️ `-ss` BEFORE `-i`, so it seeks the input rather than decoding and
  # discarding — and so the delay below measures from the seeked position.
  AUDIO_IN=(-ss "$seek" -i "$wav")
  # ⚠️ `apad` alone pads FOREVER, and `-shortest` does not reliably stop a
  # filter_complex output — the first version of this ran ffmpeg at 98% CPU for
  # forty-four minutes on a two-minute encode, generating silence it would
  # never stop generating. `whole_dur` bounds it to the video it accompanies.
  AUDIO_FILTER=";[$index:a]adelay=${ms}|${ms},apad=whole_dur=${AUDIO_WHOLE_DUR}[aout]"
  AUDIO_MAP="[aout]"
}

# The finished length: a card at each end around however much of the tour the
# window actually holds. `apad` is bounded to exactly this.
AUDIO_WHOLE_DUR=$(python3 -c "print(f'{2*$CARD_SECONDS + min($TOUR_SECONDS, $tour_norm_s):.3f}')")
plan_to_args "$tour_audio" 2
echo "--- promo-youtube.mp4 (${AUDIO_WHOLE_DUR}s) ---"
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
  "${AUDIO_IN[@]}" \
  -filter_complex "
    [0:v]$card_chain[card];
    [card]split=2[intro][outro];
    [1:v]fps=$FPS,scale=-2:$PHONE_H,
         pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=$GROUND,
         setsar=1,format=yuv420p[body];
    [intro][body][outro]concat=n=3:v=1:a=0[v]$AUDIO_FILTER
  " \
  -map "[v]" -map "$AUDIO_MAP" -shortest \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -ar "$AUDIO_RATE" -ac "$AUDIO_CHANNELS" -b:a "$AUDIO_BITRATE" \
  -movflags +faststart "$OUT/promo-youtube.mp4"

# hstack ends with its shortest input, so the grid body is the shortest cell.
shortest_tab=$(for t in "${TABS[@]}"; do duration_of "$CLIPS/$t.mp4"; done | sort -n | head -1)
AUDIO_WHOLE_DUR=$(python3 -c "print(f'{2*$CARD_SECONDS + min($GRID_SECONDS, $shortest_tab):.3f}')")
plan_to_args "$grid_audio" 5
echo "--- linkedin-fourup.mp4 (${AUDIO_WHOLE_DUR}s) ---"
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
  "${AUDIO_IN[@]}" \
  -filter_complex "
    [0:v]$card_chain[card];
    [card]split=2[intro][outro];
    $chain
    ${cells}hstack=inputs=4:shortest=1[row];
    [row]pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=$GROUND,setsar=1,format=yuv420p[body];
    [intro][body][outro]concat=n=3:v=1:a=0[v]$AUDIO_FILTER
  " \
  -map "[v]" -map "$AUDIO_MAP" -shortest \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -ar "$AUDIO_RATE" -ac "$AUDIO_CHANNELS" -b:a "$AUDIO_BITRATE" \
  -movflags +faststart "$OUT/linkedin-fourup.mp4"

echo "--- what came out ---"
for f in promo-youtube linkedin-fourup; do
  printf '%-22s %s' "$f.mp4" \
    "$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height -show_entries format=duration \
        -of csv=p=0:s=x "$OUT/$f.mp4" | tr '\n' ' ')"

  # The rate and channel count too: 8 kHz mono is what the app renders, and
  # letting it through to a published file is the mistake this reports on.
  printf '%s ' "$(ffprobe -v error -select_streams a:0 \
    -show_entries stream=sample_rate,channels -of csv=p=0:s=/ "$OUT/$f.mp4")"

  # ⚠️ MEAN VOLUME, not "has an audio stream". The silent fallback IS a valid
  # stream — ffprobe reports it as aac, stereo, 44.1kHz, exactly like a real
  # one. Only the level tells them apart: true silence reads as -91dB or the
  # literal string `-inf`.
  level=$(ffmpeg -hide_banner -nostats -i "$OUT/$f.mp4" -map 0:a:0 -af volumedetect \
    -f null - 2>&1 | sed -n 's/.*mean_volume: \(.*\) dB/\1/p' | tail -1)
  if [ -z "$level" ]; then
    printf '  ⚠️ NO AUDIO STREAM\n'
  elif [ "$level" = "-inf" ] || [ "${level%.*}" -le -90 ] 2>/dev/null; then
    printf '  ⚠️ AUDIO IS SILENT (mean %s dB)\n' "$level"
  else
    printf '  audio mean %s dB\n' "$level"
  fi
done
