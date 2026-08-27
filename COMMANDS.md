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
pnpm build:apk        # preview APK — installable
pnpm build:aab        # production AAB — NOT installable, store upload only
pnpm build:ipa        # production IPA
pnpm build:apk:local / build:aab:local / build:ipa:local   # compile on this machine

eas submit --platform ios     --profile production --latest
eas submit --platform android --profile production --latest
```

Store submission is **manual only** — never automatic on merge.

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
