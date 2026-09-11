# What is left

Written 11 September 2026, at the end of a session, so the next one does not
begin by rediscovering where this stopped.

Everything below is **outstanding**.

## Where things stand

| | |
| --- | --- |
| `main` and `develop` | in sync, **OmniMorse 0.3.0** |
| Tests | 933 unit and property, E2E 9/9 both platforms |
| Privacy policy | live and verified at the URL Play was given |
| Play listing | text, icon and feature graphic ready; screenshots need recapturing |
| App Store listing | copy ready in all three languages — [APP-STORE.md](APP-STORE.md) |
| ⚠️ Android screenshots | seven captured, but at **320×640** — Play's bare minimum. Recapture now that the emulator asks for a `pixel_6` profile |
| iOS screenshots | done — run 34613499598, all seven at 1320×2868 |
| Videos | flows, composer and workflow ready — see [VIDEO.md](VIDEO.md) |
| ⚠️ Version | 0.3.0, **unbumped and untagged on purpose** — see §5 |
| ⚠️ EAS builds | **blocked until 1 October**. `--local` still works |

What is already done is in [PLAY-CONSOLE.md](PLAY-CONSOLE.md),
[APP-STORE.md](APP-STORE.md), [MACHINE-SETUP.md](MACHINE-SETUP.md) and
[store-listing/](store-listing/).

---

## 1. Recapture the Android screenshots, then record the videos

Run **34613499598** finished: **iOS is done** — all seven at **1320×2868**,
which is the 6.9-inch slot's native size and accepted alongside 1290×2796.
Download `store-screenshots-ios` from that run and upload it as is.

⚠️ **Android is NOT done, and the earlier "done" was wrong.** All seven
captured, the wordmark reads OmniMorse, and every one of them is **320×640** —
the CI emulator's default profile, and Play's absolute minimum for the short
side. They would be accepted and they would look it beside anything else on the
store. Nobody measured the output, which is the whole lesson.

The emulator now asks for a `pixel_6` profile (1080×2400), so a re-run fixes
it. That also makes the two sets consistent: both tall, both modern.

⚠️ **The new profile is eight times the pixels, software-rendered.** If the
Android job starts timing out or the flow gets flaky, that is the cause, and
the fix is a smaller profile rather than a longer timeout.

Both platforms at once:

```bash
gh workflow run screenshots.yml --ref develop
```

Then the videos — a separate workflow, and the first run of it:

```bash
gh workflow run videos.yml --ref develop
```

It produces `promo-youtube.mp4` and `linkedin-fourup.mp4` in the
`store-videos` artifact, plus the raw portrait recordings separately so the
framing can be changed without re-recording. ⚠️ **Play takes a YouTube URL for
the promo video, not an upload**, and there are five ways to paste a URL it
rejects — all of them in [VIDEO.md](VIDEO.md).

It needs no local build, which matters while the EAS credits are out.

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

- **App icon 512×512** — `docs/store-listing/graphics/play-icon-512.png`.
- **Feature graphic 1024×500** — `play-feature-graphic.png`, in the same place.
- **Phone screenshots** — from step 1.

Then **internal testing** (`morse-0.3.0-6.aab`, no listing required, testers in
minutes), and only afterwards **closed testing**, which starts the
12-testers-for-14-days clock. ⚠️ Since April 2026 Google checks that testers
actually *used* the app, so do not start that clock until there are testers who
will open it.

## 5. Version and tag

⚠️ **0.3.0 is unbumped and untagged, both deliberately.**

The rename is user-visible and would normally move both version fields. Bumping
`package.json` fires `firebase-distribution.yml`, and **EAS has no build
credits until 1 October** — it would land a guaranteed red run beside a release
nobody can install. Tagging `v0.3.0` fires `eas-build.yml` for the same result.

So: bump both when there is a build to make, tag after the credits reset, or
build locally with `pnpm build:apk:local` in the meantime.

## 6. Deferred, with triggers

| | When |
| --- | --- |
| **Firebase Analytics** | after the version is confirmed on internal testing. Four things move together, and `store-listing.test.ts` fails the build if the "no analytics" promise is left standing |
| **Dependabot alerts** | `@xmldom/xmldom`, `js-yaml`, `fast-uri` — all transitive, all needing `pnpm.overrides`. First question is whether they reach the shipped app at all |
| **The icon source** | the original OmniMorse export is gone from `~/Downloads`. The current set is generated by `tools/generate-icons.py` and needs no source, but a designed replacement would |
| **iPad screenshots, or dropping iPad** | before the first App Store submission. `supportsTablet` is `true`, so Apple requires a 13-inch set and the screenshots workflow boots no iPad. Either add one to the job or set the flag to `false` — a product decision, not a tooling one |
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
