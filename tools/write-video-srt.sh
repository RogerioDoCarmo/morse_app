#!/usr/bin/env bash
#
# Writes SRT subtitle sidecars for the composed store videos, in all three
# languages the app ships in.
#
#   tools/write-video-srt.sh <video-dir>
#
# ⚠️ SIDECARS, NOT BURNED-IN TEXT. YouTube and LinkedIn both accept SRT, it
# stays editable, a typo costs a text edit rather than a re-encode, and three
# languages are three small files rather than three renders of the video.
#
# ⚠️ EVERY CUE TIME IS MEASURED OR STRUCTURAL. NONE ARE GUESSED. The card
# length is a constant this script shares with the composer; the playback onset
# is found the same way the audio placement finds it. A caption that drifts is
# the same failure as a tone that drifts — see the sync check in
# compose-video.sh — and the honest response to a time we cannot establish is
# to write no cue there.
#
# ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: name each tab as the tour reaches it.
# Those moments are not derivable from the footage — the app's tabs share a
# palette and layout shell, so a tab switch is not a scene change. Measured on
# promo-youtube.mp4: at thresholds 0.25, 0.12 and 0.06 ffmpeg finds the same
# THREE changes, all of them card boundaries. Per-tab cues would need the
# Maestro flow to record its own timestamps as it goes, which it does not do
# today. Until it does, this writes fewer cues and every one of them is true.
set -euo pipefail

DIR=${1:?usage: write-video-srt.sh <video-dir>}
CARD_SECONDS=${CARD_SECONDS:-2}
COMPOSED_MIN_SPREAD=${COMPOSED_MIN_SPREAD:-3}

command -v ffprobe >/dev/null || { echo "::error::ffprobe is required" >&2; exit 1; }

# HH:MM:SS,mmm — SRT's format, comma for the decimal separator.
stamp() { python3 -c "
s = float('$1')
h, s = divmod(max(0.0, s), 3600); m, s = divmod(s, 60)
print('%02d:%02d:%02d,%03d' % (h, m, int(s), round((s - int(s)) * 1000)))
"; }

duration_of() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

# cue <file> <index> <start> <end> <text>
cue() { printf '%s\n%s --> %s\n%s\n\n' "$2" "$(stamp "$3")" "$(stamp "$4")" "$5" >> "$1"; }

write_set() {
  local video=$1 lang=$2 out total body_end onset
  [ -f "$video" ] || return 0
  total=$(duration_of "$video")
  body_end=$(python3 -c "print(f'{max(0.0, $total - $CARD_SECONDS):.3f}')")
  out="${video%.mp4}.$lang.srt"
  : > "$out"

  # Measured, not assumed — the same detector the audio placement uses, at the
  # threshold the composed frame needs.
  onset=$(MIN_SPREAD=$COMPOSED_MIN_SPREAD tools/detect-playback-start.sh "$video" 2>/dev/null | tail -1 || true)

  local n=1
  case "$lang" in
    en) opening="OmniMorse — encode, decode, learn Morse code" ;;
    pt) opening="OmniMorse — codifique, decodifique e aprenda código Morse" ;;
    es) opening="OmniMorse — codifica, descodifica y aprende código morse" ;;
  esac
  cue "$out" "$n" 0 "$CARD_SECONDS" "$opening"; n=$((n + 1))

  if [ "$(basename "$video")" = "linkedin-fourup.mp4" ]; then
    # The four panels are on screen together for the whole body, so one cue
    # describing them is true for its entire duration.
    case "$lang" in
      en) body="Four ways in: type it, speak it, tap it out, or learn the alphabet" ;;
      pt) body="Quatro caminhos: digite, fale, toque o ritmo ou aprenda o alfabeto" ;;
      es) body="Cuatro caminos: escribe, habla, toca el ritmo o aprende el alfabeto" ;;
    esac
    cue "$out" "$n" "$CARD_SECONDS" "$body_end" "$body"; n=$((n + 1))
  else
    case "$lang" in
      en) body="Type a message and it becomes Morse, letter by letter" ;;
      pt) body="Digite uma mensagem e ela vira Morse, letra por letra" ;;
      es) body="Escribe un mensaje y se convierte en morse, letra a letra" ;;
    esac
    if [ -n "$onset" ]; then
      cue "$out" "$n" "$CARD_SECONDS" "$onset" "$body"; n=$((n + 1))
      case "$lang" in
        en) play="Sound, torch, screen and vibration — it plays the message out loud" ;;
        pt) play="Som, lanterna, tela e vibração — a mensagem sai de verdade" ;;
        es) play="Sonido, linterna, pantalla y vibración — el mensaje suena de verdad" ;;
      esac
      cue "$out" "$n" "$onset" "$body_end" "$play"; n=$((n + 1))
    else
      cue "$out" "$n" "$CARD_SECONDS" "$body_end" "$body"; n=$((n + 1))
    fi
  fi

  case "$lang" in
    en) closing="Nothing you type, say or key ever leaves your phone" ;;
    pt) closing="Nada do que você digita, fala ou toca sai do aparelho" ;;
    es) closing="Nada de lo que escribes, dices o tocas sale de tu teléfono" ;;
  esac
  cue "$out" "$n" "$body_end" "$total" "$closing"

  echo "  $(basename "$out")  $((n)) cues"
}

for v in "$DIR"/promo-youtube.mp4 "$DIR"/linkedin-fourup.mp4; do
  [ -f "$v" ] || continue
  echo "$(basename "$v"):"
  for lang in en pt es; do write_set "$v" "$lang"; done
done
