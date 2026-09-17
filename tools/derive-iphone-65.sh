#!/usr/bin/env bash
#
# Derives the 6.5-inch iPhone screenshot set from the 6.9-inch captures.
#
#   tools/derive-iphone-65.sh <source-dir> <target-dir>
#
# ⚠️ THIS EXISTS BECAUSE THE SLOT CANNOT BE CAPTURED. Xcode 26 ships no
# 6.5-inch simulator — the XS Max, 11 Pro Max and 12/13 Pro Max are all gone —
# so 1284x2778 cannot come off a device at all. App Store Connect still offers
# the slot, so the only honest options are to derive it or to leave it empty.
#
# ⚠️ AND IT EXISTS AS A SCRIPT rather than as a paragraph. BEFORE-THE-DROP-OFF
# said this set was recoverable "only if someone remembers the conversion,
# which is scaling on height and padding 5px". A recipe nobody can run is one
# bad week from being lost; this is the same recipe, executable.
#
# The two slots differ by 0.4% in shape: 1320x2868 is 2.1727, 1284x2778 is
# 2.1636. Scaling on HEIGHT lands the width at 1278.58 -> 1279, and the
# remaining 5px is `ground` (#f2f4f7 from theme.ts), split by the pad filter so
# the join is invisible rather than a bar down one edge.
#
# ⚠️ Prefer the 6.9-inch slot wherever a choice exists: there the capture is
# exact and nothing is derived.
set -euo pipefail

SRC=${1:?usage: derive-iphone-65.sh <source-dir> <target-dir>}
DST=${2:?usage: derive-iphone-65.sh <source-dir> <target-dir>}

# The two sizes App Store Connect names for these slots, as literals. Deriving
# them from the source would silently accept a source that is not 6.9-inch.
SRC_W=1320 SRC_H=2868
DST_W=1284 DST_H=2778
GROUND=0xf2f4f7

# ⚠️ COMMAND SUBSTITUTION, not `read < <(...)`. The reader emits no trailing
# newline, so `read` returns non-zero on EOF — and under `set -e` that killed
# this script silently, mid-loop, having produced nothing and having printed
# nothing at all. It looked like success.
#
# ⚠️ ffprobe, NOT `sips`. `sips` ships only with macOS, so this script could not
# run on the Windows machine at all — for a set that exists precisely because
# no simulator can capture it, on the platform that has no simulator either.
# ffprobe comes with the ffmpeg this script already requires, so it costs no
# new dependency and works on both.
dimensions() {
  # ⚠️ `csv=p=0` then `tr`, rather than `csv=p=0:s=' '`. ffprobe 9 rejects a
  # space as the separator — "Failed to parse option string" — and the failure
  # is not fatal: it prints nothing, the caller reads empty dimensions, and the
  # size check then reports the file as "x" instead of saying what went wrong.
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
    -of csv=p=0 "$1" | tr ',' ' '
}

command -v ffmpeg >/dev/null || { echo "::error::ffmpeg is required" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "::error::ffprobe is required" >&2; exit 1; }
[ -d "$SRC" ] || { echo "::error::no such directory: $SRC" >&2; exit 1; }
mkdir -p "$DST"

shopt -s nullglob
shots=("$SRC"/*.png)
[ ${#shots[@]} -gt 0 ] || { echo "::error::no PNGs in $SRC" >&2; exit 1; }

for f in "${shots[@]}"; do
  # ⚠️ Refuse a source that is not the 6.9-inch capture. Deriving from the
  # wrong size would produce files of the right DIMENSIONS and the wrong
  # content scale, which nothing downstream would catch.
  read -r w h <<<"$(dimensions "$f")"
  if [ "$w" != "$SRC_W" ] || [ "$h" != "$SRC_H" ]; then
    echo "::error::$(basename "$f") is ${w}x${h}, expected ${SRC_W}x${SRC_H} (6.9-inch)" >&2
    exit 1
  fi

  out="$DST/$(basename "$f")"
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "scale=-1:${DST_H},pad=${DST_W}:${DST_H}:(ow-iw)/2:0:color=${GROUND}" \
    "$out"

  read -r ow oh <<<"$(dimensions "$out")"
  if [ "$ow" != "$DST_W" ] || [ "$oh" != "$DST_H" ]; then
    echo "::error::$(basename "$out") came out ${ow}x${oh}, expected ${DST_W}x${DST_H}" >&2
    exit 1
  fi
  echo "  $(basename "$out")  ${ow}x${oh}"
done

echo "Derived ${#shots[@]} shots into $DST"
