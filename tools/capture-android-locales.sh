#!/usr/bin/env bash
#
# Runs the store-screenshot flow once per published language and files each set
# under its STORE tag.
#
#   tools/capture-android-locales.sh
#
# ⚠️ THIS EXISTS BECAUSE THE LOOP CANNOT LIVE IN THE WORKFLOW.
# `reactivecircus/android-emulator-runner` runs its `script:` block ONE LINE AT
# A TIME, each in its own `sh -c`. A multi-line `for` loop is therefore split
# across shells and dies immediately:
#
#     /usr/bin/sh -c for pair in "en:en-US" ...; do
#     /usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "done")
#
# Every line that workflow had before was self-contained, so nothing had ever
# revealed it. A `set -e` on its own line is equally useless there — it applies
# to a shell that exits on the next line.
#
# ⚠️ And the failure was nearly invisible: the emulator step carries
# `continue-on-error: true`, so the job kept going and failed two minutes later
# at "no screenshots for en-US", pointing at the collector rather than the
# thing that never ran.
set -euo pipefail

FLOW=${FLOW:-.maestro/screenshots.yaml}
OUT=${OUT:-screenshots}

# ⚠️ THE APP'S TAG IS NOT THE STORE'S. The app speaks `en`, `pt-BR` and `es`;
# Play's folders are `en-US`, `pt-BR` and `es-419`. Only the middle one is the
# same string, which is what makes the other two easy to get wrong — and a set
# filed under the wrong tag is found at upload, not here.
#
# The app tag is typed into a testID by the flow; the store tag names the
# folder. Keep them in this order: <app>:<store>.
for pair in "en:en-US" "pt-BR:pt-BR" "es:es-419"; do
  app=${pair%%:*}
  store=${pair##*:}
  echo "::group::${store} (app locale ${app})"

  # ⚠️ Maestro reuses its run directory. Without clearing it, the second
  # locale's folder collects the first one's images too — an English set filed
  # as Portuguese, at dimensions that look perfectly right and would be found
  # by nobody. `capture-ios-screenshots.sh` learned this between devices.
  rm -rf "$HOME/.maestro/tests"

  maestro test -e LOCALE="$app" "$FLOW"

  mkdir -p "$OUT/$store"
  # ⚠️ A LETTER PREFIX, not digits. The captures are named `a-` … `f-` so that
  # Play Console's upload ordering matches the order they were taken; a
  # `[0-9][0-9]-*` glob here would match nothing and report an empty set after
  # a full twenty-minute run.
  find "$HOME/.maestro/tests" -name '[a-z]-*.png' -exec cp {} "$OUT/$store/" \;

  count=$(ls -1 "$OUT/$store" | wc -l | tr -d ' ')
  echo "${store}: ${count} images"
  # A language that captured nothing silently keeps whatever is already on the
  # listing, so it fails here rather than later.
  test "$count" -gt 0 || {
    echo "::error::The flow produced no screenshots for ${store}."
    exit 1
  }
  echo "::endgroup::"
done
