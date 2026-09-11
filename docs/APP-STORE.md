# App Store Connect — what to paste

The Apple half of [PLAY-CONSOLE.md](PLAY-CONSOLE.md), and the sequel to
[TESTFLIGHT.md](TESTFLIGHT.md): TestFlight covers the beta, this covers the
public listing. Kept here so the next release does not start from a blank
console, and so the answers stay consistent with what the app actually does.

---

## The copy

Name, subtitle, keywords, promotional text, description and What's New live per
language in [`store-listing/`](store-listing/) — one file each, every fenced
block exactly what goes in the matching field.

Not duplicated here on purpose. Copy kept in two places is copy that disagrees
with itself eventually, and `PLAY-CONSOLE.md` has already been wrong twice
about things it was duplicating.

### Locale codes

The files are named for Play's codes. Apple's differ for one of the three.

| Language | Play | App Store Connect |
| --- | --- | --- |
| English | `en-US` | English (U.S.) |
| Português do Brasil | `pt-BR` | Portuguese (Brazil) |
| Español | `es-419` | **Spanish (Mexico)** |

⚠️ Apple has no Latin-American Spanish. It offers **Spanish (Mexico)** and
**Spanish (Spain)**, and `es-419` copy belongs under Mexico. Picking Spain
instead would ship Latin-American wording to a Castilian audience, which is the
kind of thing a reviewer never catches and a user notices immediately.

### The fields Apple has and Play does not

- **Subtitle** (30) — indexed for search, like the name. It is 30 characters in
  every language and the punchline does not fit in all three: 22 in English, 30
  exactly in Spanish, **32 in Portuguese**. The pt-BR file uses a shorter
  rendering and says so.
- **Keywords** (100) — comma-separated, no spaces. Apple pairs them into
  phrases by itself, so `morse` and `code` already cover "morse code". The
  lists come in under the limit deliberately; the reasoning is the same one
  that stopped the Play tags at three.
- **Promotional text** (170) — the only field here that can change **without
  shipping a build or waiting for review**. Worth remembering: a mistake
  anywhere else in the listing costs a review cycle to fix.

`store-listing.test.ts` fails the build when a block outgrows the tighter of
the two stores' limits, when a field goes missing, when the three files stop
calling the app the same thing, when a keyword carries a space or repeats a
word the subtitle already spends, and when the "no analytics" promise is left
standing after Analytics ships.

---

## App Information

| Field | Value |
| --- | --- |
| Bundle ID | `com.rogeriodocarmo.morse` |
| Primary category | **Utilities** |
| Secondary category | **Education** |
| Content rights | Does **not** contain, show or access third-party content |
| Age rating | **4+** |
| Price | Free |
| Copyright | `2026 Rogério do Carmo` |
| Support URL | see the warning below |
| Marketing URL | <https://rogeriodocarmo.com> — optional |
| Privacy policy URL | <https://rogeriodocarmo.github.io/morse_app/privacy-policy.html> |

### Why Utilities, and why the age rating differs from Play's

Utilities is Tools' counterpart, chosen for the same reason: the primary
function is conversion. Apple allows a **second** category where Play allows
one, which is where Education goes — it costs nothing and the Learn tab earns
it honestly.

⚠️ **Apple is 4+ while Play is 13+, and that is not an inconsistency to
"fix".** They are answers to different questions. Play's 13+ is a deliberate
choice to stay outside the Families policy. Apple's rating comes from a content
questionnaire, and a Morse translator with no user-generated content, no web
view and no ads rates at the floor. A 4+ rating does **not** enrol the app in
Apple's Kids Category — that is a separate opt-in, and it must stay un-opted:
the Kids Category forbids third-party analytics, which this app ships
(Crashlytics) and plans more of.

⚠️ **The Support URL must actually offer support.** <https://rogeriodocarmo.com>
is a portfolio page and a reviewer may reject it under Guideline 1.5 as not
providing support. The cheap fix, before the first submission: a support page
in this repository beside the privacy policy, published by the same GitHub
Pages setup, listing the contact address and the known issues. It costs one
file and avoids a rejection round-trip.

---

## App Privacy

Answered in the App Store Connect web form. It must say the same thing as
Play's Data safety and as `PRIVACY.md`.

Declare **two** data types collected:

| Type | Apple's category | Linked to identity | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Crash Data | Diagnostics | No | No | App Functionality |
| Device ID | Identifiers | No | No | App Functionality |

Both come from `PRIVACY.md`, which was written against the code and is the
authority here: an installation identifier leaves the device in two places —
Crashlytics, and the `expo-updates` check on launch.

⚠️ **Answer "No" to tracking across apps and websites.** The app has no ATT
prompt, no advertising identifier and no `NSUserTrackingUsageDescription`, and
`app.json` already declares `NSPrivacyTracking: false`. Adding Firebase
Analytics does not change this answer by itself, but it is the moment to
re-read it — see the four things that move together in
[PLAY-CONSOLE.md](PLAY-CONSOLE.md#when-firebase-analytics-ships).

### ⚠️ The privacy manifest and this form do not currently agree

`app.json` → `expo.ios.privacyManifests` → `NSPrivacyCollectedDataTypes`
declares **`CrashData` only**. Play's Data safety declares crash logs **and**
Device or other IDs, and the paragraph above declares Device ID here. Three
declarations of the same behaviour, one of which is shorter than the others.

This is not automatically a bug. Apple merges the app's manifest with the
manifest each bundled SDK ships, and Crashlytics and the Firebase Installations
library carry their own. If theirs cover the identifier, the app's manifest is
right to stay quiet about it.

**Establish which it is rather than guessing, and do it from the archive**, not
from source: Xcode Organizer → select the archive → *Generate Privacy Report*
produces the aggregate of every manifest in the build. If `Device ID` is absent
from that report, add it to `app.json` alongside `CrashData` with
`NSPrivacyCollectedDataTypePurposeAppFunctionality`, and extend
`app.config.test.ts`, which already asserts the manifest's shape.

---

## Export compliance

Already answered in the binary, and there is nothing to click:

```text
"ITSAppUsesNonExemptEncryption": false
```

It is in `app.json` and asserted by `app.config.test.ts`. The app uses HTTPS
and nothing else, which is the exemption. Without the key, every single upload
stops and asks, and a TestFlight build sits unavailable to testers until
somebody answers it in the browser.

---

## Screenshots

| Size | Requirement |
| --- | --- |
| 6.9" iPhone | **required** — 1290×2796 or 1320×2868 |
| 13" iPad | **required while the app supports iPad** — 2064×2752 or 2048×2732 |

Up to 10 per size, per language.

⚠️ **`supportsTablet` is `true`, so iPad screenshots are not optional** — and
that flag is not an oversight. The app has a `NavRail` instead of a tab bar
above a threshold width, with three `.tablet.test.tsx` files behind it. Tablet
support is implemented, so the honest move is to capture the set rather than
withdraw the claim.

The screenshots workflow captures **both**: `store-screenshots-ios` on a 6.9-inch
iPhone and `store-screenshots-ipad` on a 13-inch iPad, from the same build and
the same flow. `screenshots.yaml` needs no branching — `NavRail` carries the
same `tab-<name>` testIDs as `TabBar`, and `open-settings` too, so the flow
drives either layout without knowing which it is on.

⚠️ **If tablet support is ever dropped, the iPad capture goes in the same
change.** `screenshots-capture.test.ts` ties them together: while `app.json`
says `supportsTablet: true`, the workflow must capture an iPad set.

⚠️ **Simulator names are matched on a PREFIX, deliberately.** The first run
asked for `iPad Pro 13-inch (M4)` on a runner that had `iPad Pro 13-inch (M5)`
and captured nothing. The chip revision is not what decides the screen size, so
it is not what to match on — and Apple will ship an M6.

⚠️ **That run reported SUCCESS with an empty iPad artifact.** The check only
looked at the iPhone directory. The job now fails when `app.json` declares
`supportsTablet` and no iPad set was captured, because a green tick over a
missing required asset is the same failure as the Android screenshots sitting
at 320×640 for a week — found at upload, both times.

⚠️ **Check the dimensions the workflow printed before uploading.** The collect
step prints each image's real size, and the job warns rather than fails when no
Pro Max simulator was available on the runner — a fallback device produces
images App Store Connect will refuse.

---

## App Review Information

| Field | Value |
| --- | --- |
| Sign-in required | **No** |
| Demo account | not applicable |
| Contact | `contact@rogeriodocarmo.com` |

### Notes for the reviewer

Two of the six permissions look worse than they are, and saying so up front is
cheaper than answering it later:

```text
OmniMorse translates text to Morse code and back. No account, no sign-in, no
network features — every screen works on a fresh install with the device
offline.

Two permissions are worth explaining:

• Camera — used ONLY to switch the torch on and off, so a message can be played
  as light. The camera preview is never presented and no image is ever
  captured. iOS puts the torch behind the camera permission; there is no
  separate one.

• Microphone and Speech Recognition — used on the Speak tab to turn what the
  user says into text, which is then encoded as Morse. Recognition is performed
  by the system framework. The app never stores or uploads audio.

The app sends anonymous crash diagnostics (Firebase Crashlytics), which can be
switched off in Settings → Privacy. Nothing the user types, says or taps ever
leaves the device.
```

---

## The order things happen in

1. The build reaches App Store Connect — `eas submit` (free; never rebuild in
   order to submit).
2. Fill App Information, App Privacy and the per-language copy. These are
   per-app, not per-version, and can be done while a build processes.
3. Attach the build to the version, add screenshots and What's New.
4. Answer App Review Information, then submit.

⚠️ **Apple reviews the listing as well as the binary.** Play lets a listing be
edited after release with no review; Apple does not. Everything above is worth
being right the first time.
