# Foundation Blueprint

The engineering standard for this project, inherited from **Miroji** (`../mirror_app`) —
a React Native app shipped to the App Store, Google Play, and F-Droid. This document is
the blueprint to build against, plus the lessons that were expensive to learn the first
time.

> **Order of work:** UI design first (see `AGENTS.md`), then this foundation, then
> features. Do not scaffold before the design phase.

---

## 1. Architecture — Hexagonal (Ports & Adapters)

Source dependencies point **inward only**. The domain knows nothing about React, Expo, or
any library; libraries live at the very edge.

```text
  UI layer            screens/ · components/ · hooks/
        │ depends on
        ▼
  application/        Providers (dependency injection via React Context)
        │ provides an
        ▼
  core/ports          ◄─ the contract (interfaces)
        │ implemented by        ▲ adapters depend only on the interface
        ▼                       │
  adapters/           the ONLY importers of expo-* / third-party libraries
        │ wraps
        ▼
  third-party         expo-camera, expo-speech-recognition, …

  core/domain — pure types. Imported by every layer; imports nothing.
```

### Directory layout

```text
src/
  core/
    domain/         pure TypeScript types — no imports at all
    ports/          interfaces the adapters must satisfy
  adapters/         one folder per wrapped library
  application/
    providers/      DI wiring via React Context
  components/       presentational, one folder each (+ index.ts barrel)
  screens/
  hooks/            facades composing ports
  i18n/
    translations/   en.ts (default) · pt.ts
  types/
```

### Ports this project will likely need

| Port | Wraps | Why it's behind a port |
| --- | --- | --- |
| `ITorchPort` | camera/torch API | flash output is the riskiest hardware dependency — mock it in tests |
| `ISpeechRecognitionPort` | speech-to-text | swappable, and unavailable in test/CI environments |
| `ITextToSpeechPort` | `expo-speech` (or equivalent) | reads decoded text aloud; output-only, needs **no** permission |
| `ILocalePort` | `expo-localization` | same pattern as Miroji |
| `IPermissionPort` | camera + microphone permission | two permissions here, unlike Miroji's one |

**The Morse encoding itself belongs in `core/domain` as pure functions** — no React, no
Expo, no I/O. That makes it exhaustively unit- and property-testable, and it is the part
where mutation testing will genuinely earn its keep.

### Type-driven domain modeling

Make illegal states unrepresentable. Miroji's example:

```ts
type PermissionState =
  | null                                    // loading / undetermined
  | { granted: true;  canAskAgain: boolean }
  | { granted: false; canAskAgain: boolean };
```

And i18n completeness enforced by the compiler, not discipline:

```ts
type TranslationKey = 'some.key' | 'another.key';
type TranslationMap = Record<TranslationKey, string>;   // missing key = build failure
```

Apply the same to Morse: a `MorseSymbol` union (`'.' | '-'`) beats a bare `string`.

---

## 2. Testing — four tiers, all of them

| Tier | Tool | Proves |
| --- | --- | --- |
| Unit / integration | Jest + React Native Testing Library | each unit behaves |
| Property-based | fast-check | invariants hold for **any** generated input |
| Mutation | Stryker | the tests actually **catch** injected bugs |
| End-to-end | Maestro | the real app works on iOS + Android |

**Thresholds** (from Miroji, carried over):

- Jest coverage: 80% branches/functions/lines/statements
- Stryker: `high: 80`, `low: 60`, **`break: 60`**

**Property-based testing fits Morse unusually well.** Round-trip is a natural invariant:
`decode(encode(text)) === text.toUpperCase()` for any supported input. Write that early.

**E2E selector convention:** `accessibilityLabel` doubles as the Maestro selector (e.g.
`"morse-output"`). Assert on stable labels, **never on localised text** — this app is
bilingual, so text-based selectors will break. Miroji documents this as a conscious
trade-off between screen-reader purity and locale-independent test matching.

---

## 3. Tooling

| Concern | Choice |
| --- | --- |
| Package manager | **pnpm** — CI, EAS, and every script assume it |
| Language | TypeScript, strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| Lint | ESLint v9 flat config (`eslint.config.js`) |
| Format | Prettier |
| Pre-commit | Husky → lint-staged (lint + format), plus tests |
| Static analysis | SonarCloud (`sonar-project.properties`) |
| Component workshop | Storybook — dual setup: on-device (`.rnstorybook/`) + web (`.storybook/`) |
| Visual regression | Chromatic, snapshotting the **web** Storybook |
| Build / release | EAS (`eas.json`) |
| Distribution (test) | Firebase App Distribution |

**SonarCloud gotcha:** turn **Automatic Analysis OFF** in the SonarCloud UI — it conflicts
with CI-based analysis. Mirror Jest's `collectCoverageFrom` negations into
`sonar.coverage.exclusions` so the metric reflects real runtime code.

---

## 4. CI/CD — GitHub Actions

Workflows to replicate from `../mirror_app/.github/workflows/`:

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | PR + push | lint, typecheck, tests, mutation (PRs only), SonarCloud |
| `e2e.yml` | PR + push | Maestro on iOS (macOS runner) + Android (Ubuntu + emulator) |
| `chromatic.yml` | PR + push | builds web Storybook, publishes to Chromatic |
| `eas-build.yml` | push to `main` (path-filtered) | EAS production build; **store submit is manual-only** |
| `firebase-distribution.yml` | push to `develop` | version-gated APK/IPA distribution |

**Rules learned the hard way:**

- **Always set an explicit `permissions:` block** on every workflow (least privilege).
- **Path-filter `eas-build.yml`** so docs/CI-only changes don't burn build quota.
- **Gate Firebase distribution on an actual `package.json` version bump**, not on every
  push — otherwise you get duplicate same-version releases.
- **Skip secret-requiring jobs for Dependabot** (`if: github.actor != 'dependabot[bot]'`)
  — fork/bot PRs cannot read secrets.
- **Store submission must be opt-in `workflow_dispatch`**, never automatic on merge.

---

## 5. Git conventions

**Git Flow, strictly:**

- `main` — production-ready, protected. Updated **only** via PR from `develop`.
- `develop` — integration branch. Updated **only** via PRs from feature branches.
- `feature/*` branched from `develop`; `release/*`; `hotfix/*` from `main`.
- **Never commit directly to `develop` or `main`.**

**Other standing rules:**

- Author email must be **`contact@rogeriodocarmo.com`** — never a work address. The
  `includeIf "gitdir:~/Documents/Github/Estudos/"` entry in `~/.gitconfig` handles this
  automatically for repos under this path. **Verify before the first commit anyway.**
- **Never `git rebase`** unless explicitly asked — use merge or recreate.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
- **Ask before** tagging/releasing, and before adding a version-bump commit to a PR.
- Every GitHub release's notes end with a
  `**Full Changelog**: <prev>...<new>` compare line.
- Maintain a **`COMMANDS.md`** quick-reference at the repo root.

---

## 6. Permissions & manifest hygiene

**This project needs two permissions** — `CAMERA` (torch) and microphone (speech). That is
one more than Miroji, so the "single permission" story doesn't apply here. What *does*
carry over is the discipline of shipping **only** what's genuinely used.

### The manifest-cleaning strategy (carry this over)

Miroji uses an Expo config plugin — `plugins/withCleanAndroidPermissions.js` — that writes
a **release-only** source set (`android/app/src/release/AndroidManifest.xml`) using the
manifest merger's `tools:node="remove"`. Debug builds are untouched, so dev tooling keeps
working; release builds ship a minimal permission surface.

Frameworks inject permissions you never asked for. Miroji's release build had to strip
**seven** of them:

| Permission | Injected by |
| --- | --- |
| `INTERNET`, `ACCESS_NETWORK_STATE` | React Native core (for the Metro dev server) |
| `VIBRATE` | Expo prebuild defaults (inherited from Expo Go) |
| `RECORD_AUDIO` | expo-camera |
| `SYSTEM_ALERT_WINDOW`, `DUMP` | RN dev tooling |
| `READ/WRITE_EXTERNAL_STORAGE` | expo-file-system |

⚠️ **`RECORD_AUDIO` is genuinely needed here** (speech input), unlike in Miroji where it
was stripped. Audit deliberately rather than copying Miroji's removal list verbatim.

### Verification is mandatory

**Always verify the permission surface on the BUILT artifact**, never from the manifest
source, and **never via `strings`**:

```bash
aapt2 dump permissions app-release.apk        # APK
bundletool dump manifest --bundle=app.aab     # AAB (protobuf — aapt2 cannot read it)
unzip -p app.ipa "Payload/*.app/Info.plist" | plutil -p -   # iOS
```

`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` will appear — that's androidx declaring a
signature-level permission for its own broadcast receivers. It is not user-facing, not
grantable to other apps, and **must not be stripped** (doing so weakens security).

---

## 7. Dependency management

- Transitive vulnerabilities are patched via **`pnpm.overrides`**.
- ⚠️ **Override values must be caret ranges (`^1.2.3`), never open-ended `>=`.** An
  override value is a *range*, and the resolver picks the **highest** matching version —
  so `">=1.1.17"` can resolve to `5.0.9` and silently force an incompatible major onto a
  consumer. Overrides *replace* the consumer's own constraint, so there is no safety net.
- When one advisory spans several majors, add a **separately scoped override per chain**
  (`"minimatch@3>brace-expansion": "^1.1.17"`).
- ⚠️ **Verify resolutions in the lockfile, per consumer** — `pnpm why` aggregates and can
  hide which consumer got which version.
- **Peer-only dependencies cannot be fixed with `overrides`** (there's no graph edge to
  rewrite) — declare them explicitly in `devDependencies` instead.
- **Never merge two lockfile-touching PRs in parallel.** Git merges `pnpm-lock.yaml` as
  text and can produce *valid-looking but broken* YAML with duplicate keys. Merge one,
  refresh the other.
- Configure Dependabot to target `develop`, and **ignore Expo-SDK-curated packages**
  (`expo`, `expo-*`, `react`, `react-native`, `react-native-*`, `jest-expo`, …) — those
  must move together via `expo install` when bumping the SDK.

---

## 8. Store readiness

- **Privacy policy** hosted on GitHub Pages (`docs/`), linked from both store listings.
  Required for camera *and* microphone permissions.
- **GitHub Pages needs a `docs/index.html`** or the root URL 404s.
- Google Play **short description forbids promotional words** — "no ads" / "sem anúncios"
  is rejected. Keep promo language out of that field.
- Google Play requires a **closed test: 12+ testers, continuously opted in for 14 days**,
  for personal accounts. 🔑 The counter measures **per-person unbroken opt-in tenure** —
  one tester leaving resets the qualifying cohort. Recruit well above 12 for margin, and
  never touch tester configuration mid-window. Google evaluates at **review** time, not
  submission time.
- If targeting **F-Droid**: everything must build from source with no proprietary
  dependencies. Expect real work — see `../mirror_app/docs/FDROID.md`.
- OEM stores (Samsung, Xiaomi) require **company registration** and are not viable for an
  individual developer. Huawei accepts individuals but requires a bank-card scan.

---

## 9. Product requirements

### Core features

1. **Typed text → Morse** — visual dots/dashes rendered on screen
2. **Speech → Morse** — device speech-to-text, then encode
3. **Flash output** — play the Morse pattern on the device torch
4. **Morse → text** — via **tap input** (press duration = dot/dash), with a
   **user-configurable** dot/dash threshold; plus typed-Morse decoding
5. **Text-to-speech** — the decoded text is read aloud (output-only, no permission)
6. **Informational pages** — what Morse code is, its history and structure
7. **Learning tips** — how to memorise and practise Morse

### Localisation

**English (default) and Portuguese**, for **both typed and spoken input**. This is a
first-class requirement, not an afterthought:

- Speech recognition must be configured per-locale
- The i18n `TranslationMap` type makes missing keys a build error
- E2E tests must not assert on localised strings

### Decoding: Morse → text (decided 2026-08-21)

Both directions are in scope. Decoding is harder than encoding because **Morse is not
self-delimiting** — `...---...` with spacing stripped could read as `SOS` or `EEETTTEEE`.
The gaps carry as much information as the symbols:

| Gap | Length | Means |
| --- | --- | --- |
| Intra-character | 1 unit | next symbol, same letter |
| Inter-character | 3 units | letter boundary |
| Word | 7 units | space |

**Input method: tap input.** A single button; press *duration* distinguishes dot from dash,
and the *gaps between* presses reconstruct letter and word boundaries.

⚠️ **The dot/dash threshold must be user-configurable.** "Long" is relative to the
operator's speed, so a hardcoded millisecond cutoff will fit nobody. Expose it as a
setting (and consider deriving a sensible default from a short calibration, or adapting
from a rolling window of recent presses). Treat the threshold as **domain state**, not UI
state — it belongs in `core/`, injected into the decoder, so it is testable without a UI.

This doubles as a **practice feature**, which pairs naturally with the learning-tips pages.

**Typed-Morse decoding is nearly free** and worth having too: split on whitespace,
reverse-lookup each group. Same purity as the encoder — a `core/domain` function with no
I/O, and it makes the round-trip invariant real:
`decode(encode(text)) === text.toUpperCase()`.

**Explicitly out of scope:** audio (microphone FFT) and light (camera) detection of Morse
signals. Real signal processing, fragile in the real world, and it would push toward
native modules that undermine the hexagonal boundaries.

### Text-to-speech output (decided 2026-08-21)

Decoded text is **read aloud** by the app. Note this is the *opposite* direction from the
speech-to-text input feature and must not be confused with it:

| | Direction | Permission |
| --- | --- | --- |
| Speech recognition (input) | voice → text → Morse | **microphone required** |
| Text-to-speech (output) | Morse → text → voice | **none** |

TTS is output-only, so it adds **no** permission. It must respect the EN/pt-BR locale
setting — read Portuguese text with a Portuguese voice.

### Open design questions (resolve during the design phase)

- App name / brand (the repo is deliberately named generically)
- Audio output (beeps) for the *encode* direction, alongside visual and flash?
- Adjustable playback speed (WPM) for flash/audio output?
- Offline-only, or any network features? *(Offline-only keeps the permission and privacy
  story clean — worth defending.)*
