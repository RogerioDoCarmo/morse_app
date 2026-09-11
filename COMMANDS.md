# Development Commands Reference

Quick reference for the CLI commands used in this project.

> Package manager: **pnpm** (not npm/yarn). CI, EAS, and every command below assume pnpm.
> The version is pinned in `package.json` → `packageManager`; CI reads it from there.

## Common Commands

```bash
pnpm start                   # Start Metro only (app must already be installed)
pnpm android                 # Build, install and run on Android + start Metro
pnpm ios                     # Build, install and run on iOS + start Metro
pnpm web                     # Run in a browser via react-native-web

pnpm test:coverage           # Tests with coverage report
pnpm test:e2e                # Maestro E2E flows (needs a booted device)
pnpm mutation                # Stryker mutation tests
pnpm lint                    # ESLint
pnpm typecheck               # tsc --noEmit
pnpm format:check            # Check formatting without writing
pnpm format                  # Auto-fix formatting
```

## Local Development — build vs. connect

The thing that is easy to forget: **which command rebuilds the native app, and which one
only talks to an already-installed app.**

```bash
pnpm android   # expo run:android — builds the native app, installs it, AND starts Metro.
               # Use this the FIRST time, and any time NATIVE code changed: new native
               # deps, app.json/plugins, permissions, icons, splash screen.

pnpm ios       # expo run:ios — same, for the iOS simulator/device.

pnpm start     # expo start — Metro ONLY. Use when the native binary is already installed
               # and only JS changed. Fast Refresh handles the rest.
```

Target a specific device when more than one is booted:

```bash
pnpm run:android                  # picker
pnpm run:ios                      # picker

xcrun simctl list devices booted  # find a UDID
npx expo run:ios --device "<UDID>"
```

**Known gotcha (iOS/CocoaPods):** if `pnpm ios` fails during `pod install` with a Ruby
`Encoding::CompatibilityError`, the shell is not in a UTF-8 locale:

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
pnpm ios
```

## Testing — four tiers

| Tier | Command | Proves |
| --- | --- | --- |
| Unit / integration | `pnpm test` | each unit behaves |
| Property-based | (inside Jest, fast-check) | invariants hold for **any** input |
| Mutation | `pnpm mutation` | the tests actually catch injected bugs |
| End-to-end | `pnpm test:e2e` | the real app works on a real device |

```bash
pnpm test                      # all tests once
pnpm test:watch                # watch mode
pnpm test:coverage             # with coverage
pnpm test:ci                   # coverage + CI flags (what the workflow runs)
pnpm test -- src/core/domain   # a single path
```

Thresholds: Jest **80%** branches/functions/lines/statements. Stryker `high: 80`,
`low: 60`, **`break: 60`**.

### Mutation tests

Config `stryker.config.json`; HTML report lands in `reports/`. Scoped to `src/core/**`, excluding
ports and tests — the pure logic, where mutation testing earns its keep.

```bash
pnpm mutation                                       # full run
pnpm exec stryker run --mutate "src/core/domain/morse.ts"  # one file, far faster while iterating
```

⚠️ **CI runs it on the DIFF, not on everything.** The job is PR-only, and a full run
takes minutes while a PR here is often merged inside one — so the check that exists to
review a change was finishing after the change had already landed. `ci.yml` now mutates
only the `src/core/**` files a PR touches, which takes seconds. A changed **test** maps
back to its source, because gutting assertions while leaving the source alone is the one
change mutation testing exists to catch.

### E2E (Maestro)

```bash
pnpm test:e2e                                # all flows
maestro test .maestro/flows/translator.yaml  # a single flow
maestro studio                               # interactive selector inspector
```

Selectors are **stable `accessibilityLabel`/`testID` values, never localised text** — the
app ships in three languages and the CI device locale is not guaranteed.

**CI lessons that cost four rounds to learn — do not regress these:**

- **Android needs a KVM udev rule** on `ubuntu-latest`, or the emulator is software
  rendered: boot took 10.7 min and Maestro's driver timed out. With KVM it boots in ~42 s.
- **Never hardcode a simulator model.** `iPhone 16` was absent from the runner image. The
  job enumerates `simctl list devices available` and passes a UDID.
- **E2E builds RELEASE, not debug.** A debug build fetches its JS bundle from Metro, which
  is not running in CI, so the app opens to an error screen and every `assertVisible`
  fails. The tell is an *identical* failure on both platforms. Expo's generated release
  buildType signs with the **debug keystore**, so this needs no secrets.
- **Dismiss the keyboard before asserting on anything below a text input.** The Android
  soft keyboard genuinely covers it; the iOS simulator defaults to a hardware keyboard and
  never shows the problem.

## Code Quality

```bash
pnpm lint          # ESLint (flat config, eslint.config.js)
pnpm lint:fix      # ESLint with --fix
pnpm lint:md       # markdownlint
pnpm format        # Prettier write
pnpm format:check  # Prettier check
pnpm typecheck     # tsc --noEmit
```

Prettier does **not** touch markdown — `markdownlint` owns it, and letting both format
`.md` produces a fight neither wins.

TypeScript runs `strict` **plus** `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`. Indexed access yields `T | undefined` — that is deliberate.

## Native builds & permission verification

```bash
npx expo prebuild --clean                 # regenerate android/ and ios/
cd android && ./gradlew assembleRelease   # release APK (signs with the debug keystore)
```

**Always verify the permission surface on the BUILT artifact, never from manifest source,
and never via `strings`:**

```bash
aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk
bundletool dump manifest --bundle=app.aab                       # AAB is protobuf
unzip -p app.ipa "Payload/*.app/Info.plist" | plutil -p -       # iOS
```

Expected surface: `CAMERA`, `INTERNET`, `RECORD_AUDIO`, and
`…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. That last one is androidx declaring a
signature-level permission for its own receivers — it is not user-facing and **must not be
stripped**. Anything else appearing means `plugins/withCleanAndroidPermissions.js` needs a
look.

⚠️ **`INTERNET` is required by Crashlytics** and was deliberately taken off the strip list.
Putting it back makes crash reporting fail **silently** — the build succeeds, the app runs,
and reports never arrive. If crash reporting is ever dropped, strip it again.

## Firebase

Crashlytics and App Distribution need a Firebase project. Drop the credential files in the
repo root — they are gitignored, being per-project:

| Platform | File |
| --- | --- |
| Android | `google-services.json` |
| iOS | `GoogleService-Info.plist` |

**Their presence is the switch** — for the *config plugins*. `app.config.js` adds them
only when a file is there, and `createPorts` picks the no-op crash reporter to match.
With a plugin listed and the file missing, `expo prebuild` fails outright; that is why
the config is dynamic rather than static.

⚠️ **The switch does not reach the pods.** The `@react-native-firebase/*` packages are
autolinked from `node_modules`, so their pods are in the build whenever the packages are
INSTALLED — credential files or not. Anything that configures those pods therefore has to
be unconditional too, which is why `plugins/withRNFirebaseDisableSPM.js` and the
`expo-build-properties` linkage are pushed outside the credential branch. On iOS the
pod's autolinked Crashlytics build phase also reads `GOOGLE_APP_ID` out of
`GoogleService-Info.plist`, so an iOS build cannot succeed without that file at all. CI
writes both files from secrets before prebuilding, so it builds the configuration that
actually ships.

### Repository secrets

Nothing distributes until these exist. Set with `gh secret set <NAME>`:

| Secret | Where it comes from |
| --- | --- |
| `EXPO_TOKEN` | expo.dev → Account → Access tokens |
| `FIREBASE_ANDROID_APP_ID` | `mobilesdk_app_id` in `google-services.json` |
| `FIREBASE_IOS_APP_ID` | `GOOGLE_APP_ID` in `GoogleService-Info.plist` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → Project settings → Service accounts → generate a private key, then paste the whole JSON |
| `GOOGLE_SERVICES_JSON` | `base64 -i google-services.json \| pbcopy` — E2E writes it back before prebuilding Android |
| `GOOGLE_SERVICE_INFO_PLIST` | `base64 -i GoogleService-Info.plist \| pbcopy` — E2E writes it back before prebuilding iOS |

The app ids and the two config files are not really secret — they all ship inside the
binary — but they live alongside the service account so one place governs distribution,
and keeping them out of a public repo costs nothing.

⚠️ **These are not the EAS variables.** The GitHub secrets above hold base64
**content**, which the E2E workflow decodes to a file. The EAS variables
(`GOOGLE_SERVICES_JSON_PATH`, `GOOGLE_SERVICE_INFO_PLIST_PATH`) hold a **path**
on the builder. The `_PATH` suffix exists so that one stray job-level `env:`
cannot hand `app.config.js` a base64 blob to treat as a filename. See
[Building for the stores](#building-for-the-stores-eas).

### Tester channels

| Platform | Channel | Trigger |
| --- | --- | --- |
| Android | Firebase App Distribution | a `package.json` version bump on `develop` |
| iOS | Firebase App Distribution | same |
| iOS | TestFlight | `eas-build.yml` → Run workflow (opt-in only) |

⚠️ **iOS via Firebase is an ad-hoc build.** Every tester device must be registered
with `eas device:create` before it can install, and adding a device needs a
rebuild — the UDID list is signed into the IPA. TestFlight has no such limit, which
is why both channels exist rather than one replacing the other.

The distribution group is named **`testers`** in the Firebase console; the workflow
matches on that name.

## Building for the stores (EAS)

```bash
pnpm build:apk        # preview APK — installable, Firebase App Distribution
pnpm build:aab        # production AAB — NOT installable, Play upload only
pnpm build:ipa        # production IPA — TestFlight / App Store
```

Every one has a `:local` twin that compiles on this machine instead of EAS's
builders — no queue, no build quota:

```bash
pnpm build:apk:local
pnpm build:aab:local
pnpm build:ipa:local
```

`:local` needs Xcode, CocoaPods and fastlane on the PATH for iOS. Signing still
comes from EAS, so stay logged in. Set `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` to keep
the generated native project when a build fails and you want to look at it.

⚠️ **A local build proving nothing about a remote one.** Your machine carries
state a clean builder does not — that divergence is what once hid three iOS
build failures here. Run one remote build before a real release.

### Credentials reach the builder through the environment

An EAS builder never sees untracked files, so `google-services.json` and
`GoogleService-Info.plist` are handed over as **file** environment variables and
`app.config.js` takes a path from them before looking on disk:

```bash
eas env:create --environment production --name GOOGLE_SERVICE_INFO_PLIST_PATH \
  --type file --visibility secret --value ./GoogleService-Info.plist
eas env:create --environment production --name GOOGLE_SERVICES_JSON_PATH \
  --type file --visibility secret --value ./google-services.json
```

⚠️ **Variables are per environment, and a profile picks one.** `production` and
`preview` are separate: setting them for `production` leaves `pnpm build:apk`
without credentials, and the iOS build then fails on Crashlytics' build phase —
it reads `GOOGLE_APP_ID` straight out of the plist, whatever the Expo plugins
decide. Create them for every environment you build.

#### A local build cannot read them either

This line used to say local builds need none of it, because the files are
already in the working tree. They are, and it does not help.

`eas build --local` archives the project **from git**, so a gitignored file is
no more present in the copy it builds than on a remote builder — and the file
variables above are `--visibility secret`, which `eas env:list` describes as
"can only be accessed on EAS builder". Neither half of the arrangement reaches
your own machine.

What the build then does is the whole failure in one line: `app.config.js`
finds nothing, reports no Firebase, skips both plugins — and the pods autolink
anyway, because the packages are dependencies, so Crashlytics' build phase
reads `GOOGLE_APP_ID` out of a plist that is not there:

```text
[!] Error building the application - see the log above
Could not get GOOGLE_APP_ID in Google Services file from build environment
```

Hand the path over yourself. It may be absolute, and here it must be — the
build runs from a copy of the project, and only an absolute path still points
at the real file from inside one:

```bash
GOOGLE_SERVICE_INFO_PLIST_PATH="$PWD/GoogleService-Info.plist" pnpm build:ipa:local
GOOGLE_SERVICES_JSON_PATH="$PWD/google-services.json" pnpm build:apk:local
```

#### Or archive in Xcode, which never had the problem

`expo prebuild` run by hand runs in the REAL working tree, where the plist is
sitting untracked, so `app.config.js` finds it on disk and the plugin copies it
into `ios/` before Xcode ever opens. The whole failure above is a consequence of
building from a copy, and this does not build from one.

```bash
npx expo prebuild --platform ios --clean
open ios/Morse.xcworkspace
```

Then Any iOS Device → Product → Archive → Distribute App → App Store Connect.

⚠️ **You take over the two things EAS was doing.** Signing is the first:
`--local` fetches the certificate and profile from EAS into a throwaway
keychain and destroys it afterwards, and Xcode instead uses whatever is in your
login keychain and your Apple account.

The BUILD NUMBER is the second, and it is the one that bites quietly.
`appVersionSource: remote` means EAS owns that counter and `app.json` declares
nothing, so a prebuilt `Info.plist` carries whatever the template left there.
App Store Connect rejects a build number it has already seen for a version, and
it does so after the upload. Set it deliberately, above anything EAS has
issued, and tell EAS afterwards so its counter does not hand out the same one:

```bash
eas build:version:set --platform ios
```

### Submitting

```bash
eas submit --platform ios     --profile production --latest
eas submit --platform android --profile production --latest
eas submit --platform ios --profile production --id <build-id>   # a specific one
```

⚠️ **The first submit must be interactive.** `--non-interactive` cannot set up
an App Store Connect API key and fails with exactly that message. Run it without
the flag once, choose *App Store Connect API Key*, and let EAS create and store
one — CI needs that same key, so doing it now is what makes `eas-build.yml`'s
submit job work later.

Keys and certificates are per **team**, not per app, so they are shared with
every other app on the account. Only the provisioning profile is per bundle ID.

Store submission is **manual only** — never automatic on merge.

### After ANY eas command: check app.json

```bash
git diff app.json
```

EAS rewrites `app.json` without saying so. `eas update:configure` has
**appended a duplicate copy of every `ios.privacyManifests` entry** — leaving
eight declared APIs where there are four. That does not fail a build; it fails
the upload, after Apple has processed it, by email.

It no longer writes build numbers: `appVersionSource: remote` keeps those on
EAS, and `app.json` declares neither. Anything EAS writes there now is
something to look at, not something to commit.

Repair by reverting and re-applying the legitimate part:

```bash
git checkout app.json     # then add back what EAS was right to write
```

A rejected build number is spent — Apple will not take it again, so a fix means
a new build, not a re-upload.

### Every EAS command this project has actually needed

Not the whole CLI — the ones a release here has genuinely called for, with what
each was learnt from.

```bash
eas whoami                       # which account the CLI is acting as
```

**Building.** The profile decides everything else; `eas.json` holds the rest.

```bash
eas build --platform all --profile production --non-interactive --no-wait
eas build --platform ios --profile preview --non-interactive --wait --json
eas build --platform ios --profile preview        # interactive — see credentials
```

`--no-wait` queues on EAS and returns, which is what CI wants; `--wait` blocks
until the artifact exists, which is what a script that needs the binary wants.

⚠️ **`--output` is refused for anything but `--local`.** The Firebase workflow
carried it from the day it was written and died in seconds every time — and
nothing fired that workflow until the first version bump, months later. A cloud
build is fetched from the URL it reports:

```bash
eas build --platform android --profile preview --non-interactive --wait --json > build.json
jq -r '[.. | objects | (.applicationArchiveUrl? // .buildUrl?) | select(. != null)] | first' build.json
```

**Looking at builds.**

```bash
eas build:list --platform ios --limit 3
eas build:list --platform ios --limit 3 --non-interactive --json    # scriptable
```

**Build numbers.** They live on EAS, not in `app.json` — see below.

```bash
eas build:version:get --platform ios
eas build:version:set --platform ios      # interactive; takes no value flag
```

**Environment variables**, per environment, per the section above.

```bash
eas env:list production
eas env:create --environment preview --name GOOGLE_SERVICES_JSON_PATH \
  --type file --visibility secret --value ./google-services.json
```

**Devices**, for iOS ad-hoc builds only — the `preview` profile's
`distribution: internal`. A device registered after a build is not in it: the
UDID list is baked into the IPA at signing time.

```bash
eas device:create                                     # register one
eas device:list --apple-team-id <TEAM_ID>             # what EAS holds
```

⚠️ **Registering a device is not enough on its own.** The ad-hoc *provisioning
profile* still has to exist, and EAS will not mint credentials
non-interactively — a CI build refuses with "couldn't find any credentials
suitable for internal distribution". One interactive `eas build --profile
preview` creates it; every CI build afterwards reuses it.

**Submitting.** ⚠️ Costs **no build quota** — it uploads a binary that already
exists, so a build sitting on EAS can reach TestFlight at any time.

```bash
eas submit --platform ios --latest --profile production --non-interactive
```

### The free plan allows fifteen iOS builds a month

Five merges to `main` in one evening cost **seven** of them, and the account
reached 80% of its limit in a day. Six were superseded by the next merge before
anyone submitted them: they existed, cost quota, and nobody ever installed
them.

So a store build runs on a **release tag** now, not on a merge. Three things
worth knowing before spending one:

- **`eas submit` is free.** There is never a reason to rebuild in order to
  submit.
- **`--local` is free too**, and compiles on this machine. It needs the
  credential paths passed in — see [A local build cannot read them
  either](#a-local-build-cannot-read-them-either).
- **TestFlight beats ad-hoc for iOS testers.** Firebase's iOS channel is an
  ad-hoc build: every tester device must be registered *before* it, and adding
  one phone later means a whole new build. TestFlight has neither limit. Spend
  the quota on Android's Firebase channel, which has no such constraint, and
  send iOS testers to TestFlight.

⚠️ **It is a shared credit pool, and running it out blocks EVERYTHING.** Not
just iOS, and not just store builds: once the credits are gone, EAS refuses the
build before it starts —

```text
You've reached your included build credits this billing period.
New builds are blocked until your billing period resets.
```

— which takes the tester distribution with it, since
`firebase-distribution.yml` builds through EAS like everything else. A refused
build costs nothing, so nothing is lost by trying, but a version bump then
lands a red run next to a release nobody can install. Until the period resets,
`--local` is the only way to produce a binary at all.

### Build numbers live on EAS, not in app.json

`eas.json` sets `appVersionSource: remote`, so EAS owns `ios.buildNumber` and
`android.versionCode`, and `autoIncrement` advances them per build. `app.json`
declares neither — the same shape Miroji uses.

⚠️ It was `local` once, and that quietly broke every CI build. With `local`,
`autoIncrement` reads the number out of `app.json`, uses the next one, and
writes it back — which on a runner is thrown away with the workspace. **Four
consecutive iOS builds all came out as build 4**, and 0.1.0 had produced two 4s
before that. Only the first of each could ever be submitted; App Store Connect
rejects a build number it has already seen for a version. Nothing failed
loudly — every one of those builds went green.

Moving to `remote` needs the counter seeded above whatever has been used, or
the collision simply continues.

## Git Workflow

### Branch strategy (Git Flow — STRICT)

```text
main (production) ← PR ← develop (integration) ← PR ← feature/task-name
```

1. Feature branches are created **from `develop`**.
2. Feature PRs merge into `develop`; release PRs merge `develop` → `main`.
3. `main` and `develop` take **no direct commits**.
4. **Never `git rebase`** unless explicitly asked — merge or recreate instead.
5. Author email must be **`contact@rogeriodocarmo.com`**. The
   `includeIf "gitdir:~/Documents/Github/Estudos/"` entry handles it; verify anyway.

> **Branch protection is currently enabled on `develop` but requires no status checks.**
> Recommended: require **`Lint, typecheck and test`**. E2E takes ~11 min per platform, so
> it is reasonable to leave it non-blocking.

### Feature workflow

```bash
git checkout develop && git pull origin develop
git checkout -b feature/task-name

pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm format:check

git add <files>
git commit -m "type: message"
git push -u origin feature/task-name
# open a PR into develop, then:
git checkout develop && git pull origin develop
git branch -d feature/task-name
git fetch --prune
```

Use `-d` (lowercase) to delete branches — it refuses unmerged work. Never `-D` unless
you are certain.

### Commit types

`feat:` · `fix:` · `build:` · `ci:` · `test:` · `docs:` · `style:` · `refactor:` · `chore:`

### Releasing — the tag IS the release notes

The same shape Miroji and the website use: an **annotated** tag `vMAJOR.MINOR.PATCH`
on `main`, whose **message is the release notes**. Pushing it fires
`.github/workflows/release.yml`, which publishes a GitHub Release with that message as
the body. The website automates it this way; Miroji does the same thing by hand.

```bash
# 1. Bump the version on develop — the workflow refuses a tag that disagrees
#    with app.json, and EAS reads app.json rather than the tag.
#    There are no build numbers in app.json to touch — eas.json uses
#    appVersionSource: remote, so EAS keeps that counter itself.
git checkout develop && git pull origin develop
# edit app.json: expo.version   (and package.json, unless — see below)
git commit -am "chore: 0.2.0"

# 2. Release PR develop → main, and merge it.
gh pr create --base main --head develop --title "release: ..." --body "..."

# 3. Tag the merge commit on main. -a is required: a lightweight tag has no
#    message, and the workflow fails rather than publish an empty release.
git checkout main && git pull origin main
git tag -a v0.2.0
git push origin v0.2.0
```

The first line of the tag message becomes the release title, so write it as one:
`v1.3.4 — A release the pipeline could not have shipped` reads better in a list than
`v1.3.4`.

#### The two version fields answer to different things

`app.json`'s `expo.version` is what the tag must match and what the store
build carries. `package.json`'s is what `firebase-distribution.yml` gates on.
They normally move together — a release that testers cannot get is a strange
release — and PR #55 says so.

⚠️ They CAN be moved apart, and 0.2.1 was: bumping `package.json` fires a
tester distribution, which on the free plan is an iOS build, and 0.2.1 changed
no app behaviour at all — its only source edit was a doc comment. Spending a
scarce build to hand testers a binary identical to the one they have is worse
than the inconsistency.

So: move both by default. Move only `app.json` when the release is
documentation or CI and there is genuinely nothing for a tester to look at.
Never move only `package.json` — that distributes a build the tag cannot
describe.

Only the `version` moves here. Build numbers are EAS's — see
[Build numbers live on EAS, not in app.json](#build-numbers-live-on-eas-not-in-appjson).

⚠️ **Releases carry no build artifacts.** The binaries come from EAS, not from CI —
an APK or IPA built in Actions would be a different, unsigned thing from the one on
TestFlight and Play, and attaching it is a good way for someone to install the wrong
one. Miroji's releases have no assets either. The website's do, because there the
`dist` archive *is* what it ships.

## Package Management

```bash
pnpm install
pnpm add <pkg>        /  pnpm add -D <pkg>
pnpm remove <pkg>
pnpm outdated
```

**Expo-managed packages (`expo`, `expo-*`, `react`, `react-native`, …): always use
`expo install`, never `pnpm add`.** It resolves the SDK-compatible version instead of
latest; the wrong version breaks the native build.

```bash
npx expo install <package>
npx expo install --check    # are all deps SDK-compatible?
npx expo install --fix      # fix the ones that are not
```

⚠️ **`pnpm.overrides` values must be caret ranges (`^1.2.3`), never open-ended `>=`.** An
override is a *range* and the resolver takes the **highest** match, so `">=1.1.17"` can
resolve to `5.0.9` and force an incompatible major. Overrides replace the consumer's own
constraint — there is no safety net. Verify per-consumer in the lockfile; `pnpm why`
aggregates and can hide which consumer got what.

## Project-Specific Notes

- **Read the versioned Expo docs before writing code:**
  <https://docs.expo.dev/versions/v57.0.0/> — this project pins **SDK 57**, and APIs shift
  between SDK versions.
- **Architecture is hexagonal.** Dependencies point inward only. `src/core/domain` imports nothing
  outside itself — no React, no Expo, no I/O — and `src/adapters` are the only files
  allowed to import `expo-*`. ESLint enforces both boundaries, so a violation fails
  `pnpm lint` rather than waiting for review.
- **Locales:** English (default), `pt-BR`, `es`. `TranslationMap` makes a missing key a
  **build error**, so add new keys to all three files at once.
- **Accented letters:** `Ç`, `É`, `Ñ` have real ITU codes and are supported; every other
  diacritic folds to its base letter. The round-trip invariant is therefore
  `decode(encode(t)) === normaliseForMorse(t).toUpperCase()` — **not** `t.toUpperCase()`.
- **Coverage:** 100% lines/functions, 98.55% branches. **Mutation score: 89%.**
- **Design source of truth:** `design/` — see `design/README.md`. The `.dc.html` artboards
  are HTML for review; they do **not** compile into the app.

### Not wired up yet

- **Storybook + Chromatic** — deferred until there are components worth browsing.
- **SonarCloud** — the CI step skips cleanly when `SONAR_TOKEN` is absent. To enable:
  create the project, add the secret, and turn **Automatic Analysis OFF** in the
  SonarCloud UI (it conflicts with CI-based analysis).
- **Firebase App Distribution** — workflow exists and is version-gated; needs credentials.
