# What is left

Written 11 September 2026 and updated 12 September, at the end of a session, so
the next one does not begin by rediscovering where this stopped.

Everything below is **outstanding**.

## Where things stand

| | |
| --- | --- |
| `main` | **OmniMorse 0.3.0** |
| `develop` | **OmniMorse 0.3.4** — ⚠️ no longer in sync with `main`; 0.3.1 → 0.3.4 are device-test builds that have not been promoted |
| Tests | **1042** unit and property. E2E **9/9 green on CI, both platforms** — first time |
| Privacy policy | live and verified at the URL Play was given |
| Play listing | text, icon, feature graphic and screenshots all ready |
| App Store listing | copy ready in all three languages — [APP-STORE.md](APP-STORE.md) |
| Android screenshots | **done** — run 34620373429, seven at **1080×2400** |
| iPad screenshots | workflow captures them; **not yet run** — see §1 |
| iOS screenshots | **done** — run 34620373429, seven at **1320×2868** |
| Support page | live, verified byte for byte |
| ⚠️ Videos | machinery complete and proven; **no usable footage yet** — see §2 |
| ⚠️ Version | 0.3.4 on `develop`, **untagged on purpose** — see §5 |
| ⚠️ Store assets | every screenshot and video still shows the **"Signal"** button, renamed to "Reproduce" in 0.3.2. Re-run both workflows before uploading anything |
| ⚠️ Vibration | with Light on, run 2 onwards does not buzz. A fix shipped in 0.3.4 on a **hypothesis** — see §5b. Unconfirmed on a device |
| ⚠️ EAS builds | **blocked until 1 October**. `--local` still works — ⚠️ until Monday |
| ⚠️ This machine | goes back **Monday 14 September 2026**. See [BEFORE-THE-DROP-OFF.md](BEFORE-THE-DROP-OFF.md) — between Monday and 1 October there is neither a machine nor a credit |

What is already done is in [PLAY-CONSOLE.md](PLAY-CONSOLE.md),
[APP-STORE.md](APP-STORE.md), [MACHINE-SETUP.md](MACHINE-SETUP.md) and
[store-assets/listing/](../store-assets/listing/).

---

## 1. Screenshots are finished

Both sets are captured, measured and ready to upload, from run **34620373429**:

| Artifact | Size | For |
| --- | --- | --- |
| `store-screenshots-android` | 1080×2400 ×7 | Play |
| `store-screenshots-ios` | 1320×2868 ×7 | App Store Connect, 6.9-inch slot |

⚠️ **An earlier Android set exists at 320×640 — discard it.** That was the CI
emulator's default profile and Play's bare minimum for the short side: it was
accepted, and it looked it. Both workflows now ask for a `pixel_6` profile.
The general lesson is the one worth keeping: **nobody had measured the output.**

```bash
gh workflow run screenshots.yml --ref develop
```

---

## 2. ⚠️ The videos: machinery done, footage not

**A run was dispatched as this session ended — check it first.** Actions →
**Videos**. The flows, the composer, the workflow and 47 tests are in place and
proven. What has not happened yet is one run whose footage is usable.

### Do not trust the run's conclusion

⚠️ **Three runs reported `success` and produced unusable footage.**
`continue-on-error` on the emulator step is what preserves partial footage when
a flow falls over — and it also swallows five flows failing in a row.

**Verification is looking at a frame.** Nothing else caught any of these:

```bash
gh run download <id> -n store-videos-raw-clips -D clips
ffmpeg -sseof -10 -i clips/tab-speak.mp4 -frames:v 1 frame.png
```

### What each run taught, in order

| # | Symptom | Cause |
| --- | --- | --- |
| 1 | no clips at all | `android-emulator-runner` splits its `script:` on newlines and runs each through its own `sh -c`; a shell function was torn apart mid-brace |
| 2 | "Pixel Launcher isn't responding" over every frame | `pixel_6` at 1080p through swiftshader with animations on ANRs the launcher, and the dialog then hid the app from Maestro |
| 3 | the wrong screen in three of four cells | `waitForAnimationToEnd: timeout: N` **does not wait for N** — N is a maximum, and returns in under a second on a screen that is not animating |

All three are fixed, guarded by tests, and written up in [VIDEO.md](VIDEO.md).
[VIDEO-PIPELINE.md](VIDEO-PIPELINE.md) explains where the work actually
happens — all of it on GitHub's runners, including the emulator — and which
parts you can run on your own machine instead.

### If the dispatched run is good

Re-framing needs no re-record — re-compose from the raw clips:

```bash
GRID_SECONDS=20 TOUR_SECONDS=75 tools/compose-video.sh clips video
```

⚠️ **Play takes a YOUTUBE URL for the promo video, not an upload**, and there
are five ways to paste one it rejects. All in [VIDEO.md](VIDEO.md).

---

## 3. Two fixes nobody has felt

Still the only things in 0.3.0 that no amount of CI can confirm:

- **Does the Poco vibrate now?** The `USAGE_ALARM` diagnosis explains every
  symptom and has never been felt on the device. If it still does not buzz, the
  next question is whether that phone vibrates for anything at all.
- **Did the torch stop blinking the screen?** Same shape: the per-mark camera
  mount was the cause, the fix is sound, and only an eye can confirm it.

Both are testable the moment a build reaches a phone.

## 4. Play: finish the listing, then testing

The listing was saved as a draft with text only. Still needed:

- **App icon 512×512** — `store-assets/listing/graphics/play-icon-512.png`.
- **Feature graphic 1024×500** — `play-feature-graphic.png`, in the same place.
- **Phone screenshots** — from step 1.

Then **internal testing** (`morse-0.3.0-6.aab`, no listing required, testers in
minutes), and only afterwards **closed testing**, which starts the
12-testers-for-14-days clock. ⚠️ Since April 2026 Google checks that testers
actually *used* the app, so do not start that clock until there are testers who
will open it.

## 5. Version and tag

**0.3.4 is bumped. `v0.3.4` is still untagged, and that is the deliberate half.**

⚠️ **The bump fires `firebase-distribution.yml`, and that run will be RED.**
It builds on EAS, and the credit pool ran out on 9 September and does not reset
until **1 October**. This was a knowing trade, not an oversight: the version
needed to move so a local build could be cut, and a red run beside it is the
price.

Cut the build locally instead — free, and unaffected by the credits:

```bash
ANDROID_HOME="$HOME/Library/Android/sdk" \
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" \
GOOGLE_SERVICES_JSON_PATH="$PWD/google-services.json" \
  pnpm build:apk:local
```

Then distribute it by hand — see the Firebase block in
[MACHINE-SETUP.md](MACHINE-SETUP.md).

⚠️ **Tagging `v0.3.4` fires `eas-build.yml` for the same red result.** Tag after
1 October.

⚠️ **0.3.3 is NOT a paperwork bump the way 0.3.1 was.** Every version since
0.3.1 carries functional change found by using the app on a Poco X5 5G, a Moto
G22 and an iPhone, and each one is a genuinely different app from the last:

| | What moved |
| --- | --- |
| 0.3.2 | copy button wired, input no longer auto-focuses, play button renamed |
| 0.3.3 | language badge wired · interface and recognition locales separated · flashing disc no longer clipped by the progress row · iOS stop actually stops · Clear and Paste under the input · the chip strip follows the sounding letter · Settings switches confirm themselves |
| 0.3.4 | the language badge opens a LIST instead of cycling · the type hint pulses, sits higher and opens the keyboard · a hypothesis about the vibration (§5b) |

Shipping any two of these under one version number would leave a tester unable
to say which build the thing they are looking at came from — which is the whole
reason the version has to move even while EAS is out of credits.

## 5b. The vibration, and what is actually known

⚠️ **Still not confirmed fixed. 0.3.4 ships a hypothesis.**

With Light AND Vibration on, the first run buzzes and no run after it ever
does. Vibration alone is fine however many times in a row. Reproduced ten times
on a Poco X5 5G and confirmed on a Moto G22.

⚠️ **The earlier explanation in this document was WRONG.** It said `TorchHost`
keeps the camera mounted between runs. It does not — `holdCamera(playing &&
channels.light)` releases it when the run ends, and that line had not been read
closely enough before the claim was written down. Anyone picking this up should
start from the code, not from the last theory.

What fits every detail, including the part that looks strangest:

- Android's vibrator plays **one effect at a time**; a new request replaces the
  one in progress.
- Opening the camera is the only thing these runs do that a vibration-only run
  does not, and several OEM camera stacks fire a haptic of their own on open.
- Ours is a whole message long, so it is maximally exposed.
- **Why run one survives:** the camera is cold the first time and takes longer
  to open than the buzz needs to get going. From run two the HAL is warm.

0.3.4 therefore starts the buzz **after** the camera (`CAMERA_SETTLE_MS`),
joining the message already in progress via `marksFrom` so the rhythm stays
tied to the clock.

**If run 2 still does not buzz, the theory is wrong.** Do not guess a third
time — get evidence off the device instead. `adb logcat` while reproducing, or
a build that records which branch ran, turns a symptom into a fact.

## 5a. Build numbers, and the one command only you can run

`preview` now carries `autoIncrement`, so tester builds stop reusing a version
code. ⚠️ **That fixes the future, not the present.** The two platforms are out
of step on EAS and `autoIncrement` moves each one from wherever it already is:

| | On EAS | Next preview build |
| --- | --- | --- |
| Android `versionCode` | 6 | 7 |
| iOS `buildNumber` | 9 | 10 |

To make the next build hand both platforms **10**, Android has to be set to 9
first. `eas build:version:set` takes no value flag — it prompts — so it cannot
be scripted:

```bash
npx eas build:version:set --platform android --profile preview   # enter 9
```

Skipping 7 and 8 is safe: version codes must increase, not be contiguous.

⚠️ **This keeps them equal only while both platforms are built together.** The
counters are per-platform on EAS, so building one alone puts them out of step
again. If they must never drift, the number has to come from the repository
instead — `appVersionSource: local` with the value in `app.json` — which is a
larger change and trades automatic increment for a line in the release commit.

## 6. Deferred, with triggers

| | When |
| --- | --- |
| **Firebase Analytics** | after the version is confirmed on internal testing. Four things move together, and `store-listing.test.ts` fails the build if the "no analytics" promise is left standing |
| **A Play service account** | before the release after this one. `eas submit --platform android` cannot authenticate without it, so every Android upload is manual. [PLAY-SERVICE-ACCOUNT.md](PLAY-SERVICE-ACCOUNT.md) — and note it cannot help with 0.3.0, because the API cannot create an app's FIRST release |
| **Dependabot alerts** | `@xmldom/xmldom`, `js-yaml`, `fast-uri` — all transitive, all needing `pnpm.overrides`. First question is whether they reach the shipped app at all |
| **The icon source** | the original OmniMorse export is gone from `~/Downloads`. The current set is generated by `tools/generate-icons.py` and needs no source, but a designed replacement would |
| **The privacy manifest gap** | before the first App Store submission. `app.json` declares `CrashData` alone while Play declares Device IDs too. Settle it from the archive's Privacy Report, not from source — the bundled SDKs ship manifests of their own |
| **A support page** | before the first App Store submission. Apple can reject a portfolio home page as not offering support. One file beside the privacy policy, on the Pages setup that already works |

---

## The one thing that would hurt to lose

`google-services.json` and `GoogleService-Info.plist` are **gitignored and not
recoverable from EAS** — the variables holding them are secret-visibility, so
only EAS builders can read them. A fresh machine must restore both from the
Firebase console by hand. Everything else — keystore, certificates, App Store
Connect key — comes back from EAS on demand.

See [MACHINE-SETUP.md](MACHINE-SETUP.md).
