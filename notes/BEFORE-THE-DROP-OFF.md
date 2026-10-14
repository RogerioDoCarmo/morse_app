# Before the drop-off — Monday 14 September 2026

⚠️ **THE MACHINE CHANGES TWICE, NOT ONCE.** Work moves to a **Windows PC on
Sunday 14 September** — a day before this Mac goes back — and everything in
this document has to travel there first. See
[§0 Moving to Windows](#0-moving-to-windows) below, which is the part that
happens first and the part with the hard limits.

This Mac goes back on **Monday 14 September 2026**. Everything below exists
**only on this disk** and is gone with it.

⚠️ **And there is a gap with no way to rebuild any of it.** EAS build credits
ran out on 9 September and do not reset until **1 October**. Every build since
has been `--local`, on this machine. Between Monday and that reset there is
neither a machine nor a credit — so anything not saved cannot simply be made
again.

⚠️ **Nothing in this list may be committed to this repository.** It is
**public**. Two of the items are live credentials, and a single `git add -f`
publishes them. Sixteen Gradle lock files reached a commit by accident on
12 September; the risk is not theoretical.

---

## 0. Moving to Windows

⚠️ **WINDOWS CANNOT BUILD OR SUBMIT iOS. AT ALL.** There is no Xcode, no
`xcodebuild`, no Simulator and no `altool`. That removes, on the new machine:

| Gone on Windows | Replacement, if any |
| --- | --- |
| `pnpm build:ipa:local` and `build:ipa:adhoc:local` | **none** — EAS cloud builds, from 1 October |
| `pnpm submit:ios` (altool upload) | **none** locally — App Store Connect's web upload, or Transporter on a Mac |
| iOS screenshots (`tools/capture-ios-screenshots.sh`) | the **Screenshots workflow**, which runs on GitHub's macOS runners |
| iOS Maestro E2E locally | the **E2E workflow**, same reason |

⚠️ **So every iOS binary that will exist before 1 October has to be built on
this Mac, before Sunday.** 0.3.5 (16) is already built and uploaded to App
Store Connect; there is no second chance at another one.

**What still works on Windows:** everything else. The whole JS toolchain
(`pnpm test`, `lint`, `lint:md`, `typecheck`, `format:check`, Stryker), Android
builds through Gradle and `pnpm build:apk:local` / `build:aab:local` once the
Android SDK is installed, Firebase distribution, Play Console, and all of CI —
which is where both platforms' E2E and screenshots come from anyway.

### What has to travel

Everything in §§1-3 below, plus one thing that is not in this repository and
not on any list here:

⚠️ **The agent's memory directory.** It lives outside the project, at
`~/.claude/projects/<project-path-slug>/memory/`, and it is what lets a session
on the new machine carry on knowing what this one knows — the standing
instructions, the deferred questions, the traps already paid for. Without it
the next session starts from the code alone.

⚠️ **Its folder name is derived from the project's absolute path**, so it will
NOT match on Windows. Copy the `memory/` contents into whatever folder the new
machine creates for the project, rather than copying the folder itself.

### What must NOT travel

- `node_modules/` — reinstall with `pnpm install --frozen-lockfile`
- `.claude/worktrees/` — a subagent's second checkout; **740 MB** on
  13 September
- `android/`, `ios/`, `.expo/`, `coverage/`, `reports/`, `.gradle/` — all
  regenerated
- `.DS_Store` files, which mean nothing on Windows

### ⚠️ The archive contains live credentials

`google-services.json`, `GoogleService-Info.plist` and the Firebase
service-account key are in it. That is the point — a fresh machine cannot build
or distribute without them — but it makes the archive itself a secret. Move it
directly between machines. Not email, not a public share, not a chat, and not
this repository, which is **public**.

---

## 1. Credentials — the ones that block a replacement machine

Without these three, a fresh Mac can clone the repository and still not build
or distribute. They are gitignored, they are not in any backup this repository
controls, and the EAS copies are `--visibility secret` — readable by EAS
builders and by nobody else, including you.

| File | Where it is now | What it unlocks |
| --- | --- | --- |
| `google-services.json` | repository root | Android Firebase — a local Android build fails without it |
| `GoogleService-Info.plist` | repository root | iOS Firebase. ⚠️ Its absence fails a local iOS build with `Could not get GOOGLE_APP_ID in Google Services file from build environment`, which reads like a signing error and is not |
| `service-account.json` | `~/Downloads/` | `firebase appdistribution:distribute` — the key for project `morse-app-869f0`. ⚠️ Sitting in Downloads is not a home; move it somewhere deliberate |

**Where they should go:** a password manager, or an encrypted volume you keep.
Not this repository, not a chat, not email.

## 2. Build artifacts — irreplaceable until 1 October

These are gitignored and each took 9–20 minutes of local build time. Re-making
any of them needs a machine *and* credits, and between Monday and 1 October
there is neither.

| File | What it is | Still needed? |
| --- | --- | --- |
| `build-1789245766768.aab` | 0.3.4 (11), Play | yes — the Play release |
| `build-1789243981694.ipa` | 0.3.4 (13), App Store signed | yes — **this is the build in Apple review** |
| `build-1789240292734.apk` | 0.3.4 (8) | yes — what the Firebase testers have |
| `build-1789240599968.ipa` | 0.3.4 (10), ad-hoc | yes — what the iPhone tester has |
| `build-1789164113385.ipa` | 0.3.1 (9), App Store signed | only as the record of what 0.3.4 replaced |

⚠️ **Apple and Google keep their own copies of what was uploaded**, so a
shipped build is recoverable from the console. The ones that are *not* are any
build never uploaded anywhere.

## 3. Assets that cannot be regenerated

`store-assets/0.3.4/**` is safe to lose — the screenshots and videos come back
from the `screenshots` and `videos` workflows, which run on GitHub's runners
and need no machine at all. Two things are different:

- ~~**`store-assets/archive/2026-09-11-video/`**~~ — **removed on 22 September.**
  The 11 September cuts predated the audio-sync fixes: the four-up carried the
  soundtrack that landed 7.28 s early, and nothing regenerates them because the
  raw clips expired with their workflow run's artifact retention. They are still
  in git history — `git checkout 5be15bc -- store-assets/archive` — so this is
  recoverable, but they were never a candidate for upload.
- **`store-assets/0.3.4/ios-iphone-6.5/`** — ⚠️ a **conversion, not a capture**.
  Xcode 26 ships no 6.5-inch simulator, so these cannot be produced again
  without the 6.9-inch originals to convert from. The originals are in
  `ios-iphone-6.9/` and those *are* regenerable, so this is recoverable — but
  only if someone remembers the conversion, which is scaling on height and
  padding 5px of `#f2f4f7`.

## 4. Machine configuration — reproducible, but write it down

All of this is already documented in [MACHINE-SETUP.md](MACHINE-SETUP.md);
the point here is that it is *configuration*, not files to copy.

| | |
| --- | --- |
| `~/.gradle/gradle.properties` | 718 bytes of JVM heap settings. ⚠️ Without it a local Android build dies with `Metaspace` in `:expo-modules-core:lintVitalAnalyzeRelease`. MACHINE-SETUP has the contents |
| `~/.expo/state.json` | the EAS login. Re-login on the new machine rather than copying it |
| Six Android NDKs, ~19 GB | only one is needed. Do not copy them; install the one version the project pins |

## 5. Accounts to confirm you can still reach

Not files — access. A new machine is useless without these, and each is
recoverable only through its own account recovery.

- **Apple ID** with the App Store Connect role, plus the ability to make a new
  **app-specific password**. ⚠️ The one used on 12 September was typed at a
  prompt and stored nowhere — it is already unrecoverable, and that is fine:
  generate another. The keychain item `omnimorse-altool` described in
  COMMANDS.md was never created.
- **Google Play Console** for `com.rogeriodocarmo.morse`.
- **Firebase console** for `morse-app-869f0`.
- **EAS / Expo** account `rogeriodocarmo` — it holds the signing keystore and
  the iOS certificates, which is why those are *not* on this list.
- **GitHub** — everything else lives there.

---

## What is NOT at risk

Worth stating, so the list above stays short enough to act on.

- Anything committed: source, tests, workflows, `store-assets/listing/`.
- The **Android keystore** and **iOS signing certificates** — held by EAS, not
  by this machine. That is the whole reason local builds still sign correctly.
- The **privacy policy** and **support page** — served by GitHub Pages from
  `main`.
- **Screenshots and videos** for 0.3.4 — re-run the workflows.
