#!/usr/bin/env bash
# Copies a prepared source tree into a build-only snapshot for F-Droid.
#
#   tools/fdroid-assemble-mirror.sh <source-dir> <mirror-dir> <versionCode> <versionName>
#
# <source-dir> must already have had the excluded packages removed, its
# package.json marked (tools/fdroid-mirror.js package) and `expo prebuild`
# run for the F-Droid variant. Run by .github/workflows/android-mirror.yml;
# also runnable by hand to reproduce a mirror locally (see notes/FDROID.md).
#
# node_modules is deliberately NOT copied: F-Droid installs it at build time
# with `pnpm install --frozen-lockfile`, pinned by the mirrored lockfile.
set -euo pipefail

source_dir="$1"
mirror_dir="$2"
version_code="$3"
version_name="$4"

mkdir -p "$mirror_dir"

items=(
  android
  src
  modules
  plugins
  patches
  assets
  App.tsx
  index.ts
  app.json
  app.config.js
  build-variant.js
  metro.config.js
  package.json
  pnpm-lock.yaml
  tsconfig.json
  LICENSE
  PRIVACY.md
)
for item in "${items[@]}"; do
  if [ -e "$source_dir/$item" ]; then
    cp -R "$source_dir/$item" "$mirror_dir/$item"
  fi
done

# Build-only: tests, stories and local Gradle state have no place in a tree
# F-Droid's scanner reads.
find "$mirror_dir/src" \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.stories.tsx' \) -delete
rm -rf "$mirror_dir"/modules/*/android/build "$mirror_dir"/modules/*/android/.gradle
rm -rf "$mirror_dir/android/.gradle" "$mirror_dir/android/app/build" "$mirror_dir/android/build"
rm -f "$mirror_dir/android/gradle/gradle-daemon-jvm.properties"

# prebuild outside EAS writes a placeholder versionCode; F-Droid needs the real one.
sed -i "s/versionCode [0-9][0-9]*/versionCode $version_code/" "$mirror_dir/android/app/build.gradle"
sed -i "s/versionName \"[^\"]*\"/versionName \"$version_name\"/" "$mirror_dir/android/app/build.gradle"
grep -q "versionCode $version_code$" "$mirror_dir/android/app/build.gradle"

# F-Droid's scanner resolves real paths; pnpm's default layout symlinks every
# package through node_modules/.pnpm/<name@version_hash>/, which no recipe can
# name stably. Hoisted gives a flat node_modules with plain paths.
echo "node-linker=hoisted" > "$mirror_dir/.npmrc"

node "$source_dir/tools/fdroid-mirror.js" fastlane "$mirror_dir" "$version_code" "$version_name" > /dev/null
