#!/usr/bin/env bash
#
# Fails if a two-column welcome screenshot has a blank left half.
#
#   tools/check-two-column-art.sh shot.png [...]
#
# ⚠️ WHY THIS EXISTS. Every tablet and iPad welcome slide in 0.3.6 shipped with
# the SOS illustration missing — `alignItems: 'center'` sized the row's children
# to their content height, the pager's ScrollView was left with no definite
# height, and `stage: { flex: 1 }` inside it collapsed to zero. The copy column
# was unaffected, so the images had the right dimensions, the right names, the
# right count and the right text. Nothing automated objected. They were caught
# by a human opening one.
#
# ⚠️ AND NO UNIT TEST CAN CATCH IT. React Native Testing Library resolves the
# tree without laying anything out, so `getByTestId('first-run-art-chips')`
# passes on a zero-height element. All 35 FirstRun tests were green throughout.
# The only evidence that layout happened is a pixel.
#
# So this measures the picture: in the left 45% of the frame, between 20% and
# 80% of the height, how many pixels differ from the background? A rendered
# illustration is a card, a line of sample text and three Morse chips — tens of
# thousands of them. Blank ground is a few hundred from edge noise.
#
# ⚠️ TWO-COLUMN SLOTS ONLY. Below 1024dp the app is single column and puts the
# art at the TOP, so this band is legitimately empty copy and every phone and
# 7-inch shot would fail. The caller decides which images are two-column.
set -euo pipefail

# ⚠️ THESE TWO NUMBERS WERE MEASURED, AND THE FIRST GUESS AT THEM WAS WRONG.
# The illustration is a WHITE card on a near-white ground -- grey 255 on grey
# 246. A difference threshold of 12, which sounds conservative, steps straight
# over the card and sees only the teal chips: it scored a correctly rendered
# tablet shot at 0.0065 and called it blank. Measured across thresholds on a
# known-broken and a known-fixed capture of the same screen:
#
#            t=2      t=4      t=6      t=8      t=12
#   broken   0.0000   0.0000   0.0000   0.0000   0.0000
#   fixed    0.2463   0.2327   0.2223   0.2140   0.0065
#
# The broken frame is UNIFORM -- not faint, not low-contrast, zero at every
# threshold -- so anything up to 8 separates them by a factor of forty. Raising
# DIFF above 8 loses the card; the gap is the card's own contrast with the
# ground, and it is narrow because the design is deliberately quiet.
DIFF=${DIFF:-8}
MIN_INK=${MIN_INK:-0.05}

status=0
for IMG in "$@"; do
  # `tr -d '\r'` — ffprobe ends its lines with CRLF on Windows, and `1600\r`
  # survives every comparison before dying inside the arithmetic. Same reason
  # strip-system-bar.sh carries it.
  read -r W H < <(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=p=0 "$IMG" | tr -d '\r' | tr ',' ' ')

  # ⚠️ The measurement lives in its own file rather than in a `python3 -c`
  # string here, so that it can be tested WITHOUT rendering a PNG. ubuntu-latest
  # has no ffmpeg -- screenshots.yml apt-gets it before using it -- so a test
  # that needed one would have quietly skipped in CI. A check that does not run
  # is the exact shape of every other check that let these images through.
  ink=$(ffmpeg -hide_banner -loglevel error -i "$IMG" -f rawvideo -pix_fmt gray - 2>/dev/null |
    WIDTH="$W" HEIGHT="$H" DIFF="$DIFF" python3 "$(dirname "$0")/measure-left-band-ink.py" | tr -d '')

  if python3 -c "import sys; sys.exit(0 if $ink >= $MIN_INK else 1)"; then
    echo "    $(basename "$(dirname "$IMG")")/$(basename "$IMG"): art present (ink=$ink)"
  else
    echo "::error::$(basename "$(dirname "$IMG")")/$(basename "$IMG"): LEFT COLUMN IS BLANK" \
         "(ink=$ink, need >=$MIN_INK at diff>$DIFF) — the illustration did not render." >&2
    status=1
  fi
done
exit $status
