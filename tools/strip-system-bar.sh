#!/usr/bin/env bash
#
# Crops the system taskbar off the bottom of an Android screenshot, in place.
#
#   tools/strip-system-bar.sh shot.png
#
# ⚠️ WHY THIS EXISTS. Android 13+ tablets draw a persistent taskbar, and it
# lands in every captured screenshot carrying Gmail, Chrome, YouTube and Photos
# icons. Third-party branding in a store listing is a metadata risk, and it
# makes a product shot look like an emulator capture — which is what it is.
#
# ⚠️ MEASURED, NOT HARDCODED. The bar is 120px on both a 1200x1920 7-inch and a
# 2560x1600 10-inch, but that is a coincidence of density rather than a rule,
# and hardcoding it would silently mangle the next profile someone adds.
#
# The measurement samples a COLUMN TWO PIXELS FROM THE LEFT EDGE, walking up
# from the bottom while the colour matches the bottom-left corner. The edge is
# chosen because the taskbar's icons sit in the middle: a row average is thrown
# by them, and the corner is guaranteed to be bar background.
#
# ⚠️ DO NOT RUN THIS ON A PHONE CAPTURE. A phone has no taskbar, and its own
# bottom tab bar is white — the same colour the scan is following — so the walk
# runs straight through the app and reports 226px of "bar" on a 1080x2400
# shot. The caller decides; this script only refuses the obvious runaways.
set -euo pipefail

IMG=${1:?usage: strip-system-bar.sh <image.png>}
# Above this fraction of the height, the measurement is not a taskbar and
# something has gone wrong. Both real tablets measure 6-8%.
MAX_FRACTION=${MAX_FRACTION:-0.12}

read -r W H < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height -of csv=p=0 "$IMG" | tr ',' ' ')

BAR=$(ffmpeg -hide_banner -loglevel error -i "$IMG" -f rawvideo -pix_fmt gray - 2>/dev/null |
  W="$W" H="$H" python3 -c "
import os, sys
w = int(os.environ['W']); h = int(os.environ['H'])
d = sys.stdin.buffer.read()
px = lambda x, y: d[y * w + x]
edge = 2
bg = px(edge, h - 2)
y = h - 2
while y > 0 and abs(px(edge, y) - bg) <= 2:
    y -= 1
print(h - 1 - y)
")

if [ "$BAR" -eq 0 ]; then
  echo "    $(basename "$IMG"): no system bar found, left alone" >&2
  exit 0
fi

LIMIT=$(python3 -c "print(int($H * $MAX_FRACTION))")
if [ "$BAR" -gt "$LIMIT" ]; then
  echo "::error::$(basename "$IMG"): measured a ${BAR}px bar on a ${W}x${H} shot," \
       "past the ${LIMIT}px sanity limit. That is not a taskbar — refusing to crop." >&2
  exit 1
fi

ffmpeg -hide_banner -loglevel error -y -i "$IMG" -vf "crop=$W:$((H - BAR)):0:0" "$IMG.cropped.png"
mv "$IMG.cropped.png" "$IMG"
echo "    $(basename "$IMG"): cropped ${BAR}px of taskbar -> ${W}x$((H - BAR))" >&2
