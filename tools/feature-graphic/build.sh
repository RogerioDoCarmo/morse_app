#!/usr/bin/env bash
#
# Rebuilds the pt-BR and es-419 Play feature graphics from the English original.
#
#   tools/feature-graphic/build.sh
#
# ⚠️ THERE IS NO DESIGN SOURCE. The 1024x500 PNG is the only artifact, so the
# logo and the "OmniMorse" wordmark are kept as the ORIGINAL'S OWN PIXELS and
# only the tagline strip is rebuilt. Redrawing the mark would mean matching it
# by eye and it would drift from the English one. The top 280px band of every
# output is checked byte-identical to the original before this script exits.
#
# ⚠️ THE TAGLINE IS LEFT-ALIGNED WITH THE WORDMARK, NOT CENTRED. Measured from
# the original: wordmark x 563..993 (centre 778), tagline x 566..951 (centre
# 758.5). Centring it would put it 20px right of where the designer put it.
#
# ⚠️ EACH LANGUAGE NEEDS ITS OWN SIZE. At English's 34px the translations are
# 545px and 499px wide and run off a 1024px canvas. The rule: left edge at 566,
# never past the wordmark's right edge at 993, largest size that fits.
set -euo pipefail

cd "$(dirname "$0")/../.."
WORK=.work/feature-graphic
HERE=tools/feature-graphic
SRC=store-assets/listing/graphics/play-feature-graphic.png
OUT=store-assets/listing/graphics
mkdir -p "$WORK"

# ⚠️ A MISSING FONT DOES NOT FAIL `drawtext`. It prints "Fontconfig error" to
# stderr, substitutes a default face, EXITS 0, and produces a graphic that
# looks entirely plausible in the wrong typeface. That happened once here and
# was caught only because the rebuilt file differed byte-for-byte from the one
# it was replacing. So the font is resolved explicitly and its absence is fatal.
FONT_SRC=$(node -p "require('path').join(require('path').dirname(require.resolve('@expo-google-fonts/plus-jakarta-sans/package.json')),'500Medium','PlusJakartaSans_500Medium.ttf')" | tr -dc '[:print:]')
test -f "$FONT_SRC" || {
  echo "::error::Plus Jakarta Sans 500 not found at $FONT_SRC — run pnpm install" >&2
  exit 1
}
# Copied to a plain name: the resolved path runs through node_modules/.pnpm and
# contains `@` and `+`, which ffmpeg's filter parser reads as syntax.
FONT="$WORK/jakarta-500.ttf"
cp "$FONT_SRC" "$FONT"

INK_LEFT=566        # where the English tagline's ink starts
INK_TOP=296         # and its top, both measured from the original
WORDMARK_RIGHT=993
BOX_X=545; BOX_Y=285; BOX_W=470; BOX_H=56

# Ink bounding box of an image, so the pen can be solved for rather than
# guessed. `tr -d '\r'` because python on Windows prints CRLF, and the second
# value would otherwise arrive as `60\r` and die inside the arithmetic below
# carriage return, die inside the arithmetic, and point at the arithmetic
# rather than at the invisible character. A delete-list escape was tried first
# and kept collapsing into a literal CR as this file was rewritten.
ink_box() {
  ffmpeg -hide_banner -loglevel error -i "$1" -f rawvideo -pix_fmt gray - |
    python3 -c "
import sys
w,h=$2,$3
d=sys.stdin.buffer.read()
xs=[x for y in range(h) for x in range(w) if d[y*w+x]>128]
ys=[y for y in range(h) for x in range(w) if d[y*w+x]>128]
print(min(xs), min(ys), max(xs)-min(xs)+1)
" | tr -dc '0-9 '
}

build() {
  local locale=$1 size=$2 text=$3 out=$4
  local tf="$WORK/tagline-$locale.txt"
  # A file, not an inline `text=`: the pt-BR line contains commas, which the
  # filter parser reads as argument separators, and both carry accents.
  printf '%s' "$text" > "$tf"

  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=black:s=1400x160" \
    -vf "drawtext=fontfile=$FONT:textfile=$tf:fontcolor=white:fontsize=$size:x=100:y=60" \
    -frames:v 1 "$WORK/probe-$locale.png"
  # ⚠️ NOT `read`. `tr -dc` strips the trailing newline, so `read` reaches EOF
  # without a delimiter and returns non-zero -- which `set -e` turns into a
  # SILENT exit 1, no output, no error, and the outputs simply never appear.
  # Word-splitting a command substitution does not care about the newline.
  set -- $(ink_box "$WORK/probe-$locale.png" 1400 160)
  local ink_l=$1 ink_t=$2 width=$3

  local pen_x=$(( INK_LEFT - (ink_l - 100) ))
  local pen_y=$(( INK_TOP  - (ink_t - 60) ))
  local right=$(( INK_LEFT + width - 1 ))
  echo "  $locale: size=$size width=${width}px right=${right} pen=(${pen_x},${pen_y})"

  if [ "$right" -gt "$WORDMARK_RIGHT" ]; then
    echo "::error::$locale tagline reaches ${right}, past the wordmark's ${WORDMARK_RIGHT} — reduce the size" >&2
    exit 1
  fi

  python3 "$HERE/erase.py" "$SRC" "$WORK/erased-$locale.png" "$BOX_X" "$BOX_Y" "$BOX_W" "$BOX_H"
  ffmpeg -hide_banner -loglevel error -y -i "$WORK/erased-$locale.png" \
    -vf "drawtext=fontfile=$FONT:textfile=$tf:fontcolor=white:fontsize=$size:x=$pen_x:y=$pen_y" \
    -frames:v 1 "$out"

  # ⚠️ VERIFY THE PICTURE, not that a file appeared. Right name, right size and
  # exit 0 is exactly what a wrong-typeface render also produces.
  ffmpeg -hide_banner -loglevel error -y -i "$SRC" -vf "crop=1024:280:0:0" "$WORK/top-a.png"
  ffmpeg -hide_banner -loglevel error -y -i "$out" -vf "crop=1024:280:0:0" "$WORK/top-b.png"
  cmp -s "$WORK/top-a.png" "$WORK/top-b.png" || {
    echo "::error::$locale disturbed the logo/wordmark band" >&2
    exit 1
  }
  # ⚠️ MEASURE THE TAGLINE REGION, not the whole frame. The first version
  # of this check read the full image and found the LOGO's left edge at x=193,
  # then failed a correct graphic for not starting at 566.
  set -- $(
    ffmpeg -hide_banner -loglevel error -i "$out" -f rawvideo -pix_fmt gray - |
      python3 -c "
import sys
w,h=1024,500
d=sys.stdin.buffer.read()
xs=[x for y in range(285,340) for x in range(500,w) if d[y*w+x]>128]
ys=[y for y in range(285,340) for x in range(500,w) if d[y*w+x]>128]
print(min(xs), min(ys))
" | tr -dc '0-9 '
  )
  local got_l=$1 got_t=$2
  [ "$got_l" = "$INK_LEFT" ] && [ "$got_t" = "$INK_TOP" ] || {
    echo "::error::$locale tagline ink at (${got_l},${got_t}), expected (${INK_LEFT},${INK_TOP})" >&2
    exit 1
  }
  echo "    verified: logo band identical, ink at (${got_l},${got_t})"
}

# The taglines are the approved listing copy, not new wording.
# ⚠️ pt-BR uses the SUBTITLE rendering. "Codifique. Decodifique. Aprenda." is
# the full punchline but runs 545px here; store-assets/listing/pt-BR.md records
# that cifrar/decifrar is what a Brazilian would say about a code anyway.
build pt-BR  32 'Codifique, decifre, aprenda'    "$OUT/play-feature-graphic.pt-BR.png"
build es-419 29 'Codifica. Decodifica. Aprende.' "$OUT/play-feature-graphic.es-419.png"
echo "  done"
