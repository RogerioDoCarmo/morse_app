# Play Console — what to paste

The Google Play half of the release. [APP-STORE.md](APP-STORE.md) is the Apple
one, and [TESTFLIGHT.md](TESTFLIGHT.md) covers the beta before it. Kept here so
the next release does not start from a blank console, and so the answers stay
consistent with what the app actually does.

---

## Testers

Play takes either a list of individual addresses or a **Google Group's**
address. The group is the better answer the moment testers are recruited
rather than known: membership changes propagate on their own, so nobody has to
edit the Play Console every time somebody joins or leaves.

| | |
| --- | --- |
| Internal testing | up to 100 testers, no review, available minutes after rollout |
| List name | `OmniMorse internal` |

⚠️ **Tester addresses must be GOOGLE accounts**, and the tester has to be signed
in to the Play Store with the same one. This is the single place where the
gmail address is the right one rather than `contact@rogeriodocarmo.com`: it is
a login, not something a user ever sees. Everywhere a person reads an address —
the listing, the policy, the app — it stays `contact@rogeriodocarmo.com`.

⚠️ **A public group exposes its member list.** If testers are recruited from
somewhere like Reddit, set the group so that only members and managers can see
who is in it, and decide deliberately whether people may join freely or need
approving. Strangers who joined to help should not find their address visible
to every other stranger who did.

### If these testers are meant to count toward production access

They do not, from an internal track — the 12 testers for 14 continuous days
must be on a **closed** track. Two things about that are worth knowing before
recruiting anyone:

- The requirement applies to personal developer accounts created after
  13 November 2023. Organisation accounts are exempt. It was 20 testers until
  December 2024.
- ⚠️ **Since April 2026 Google checks ENGAGEMENT, not just opt-ins.** Twelve
  people who joined and never opened the app does not pass. Recruiting from a
  public forum is fine; recruiting people who will actually use it is the part
  that counts.

---

## Internal testing — the release itself

| Field | Value |
| --- | --- |
| App bundle | `morse-0.3.0-6.aab` — versionCode **6**, versionName **0.3.0** |
| Release name | `0.3.0 (6)` |

⚠️ **Not** `omnimorse-play-verification-vc6.apk`. That one carries the
developer-account token and exists only to prove key ownership — it must never
be distributed.

### Release notes

Per language, and paste-ready, in [`store-listing/`](store-listing/):

| | |
| --- | --- |
| English | [`en-US.md`](store-listing/en-US.md) |
| Português do Brasil | [`pt-BR.md`](store-listing/pt-BR.md) |
| Español | [`es-419.md`](store-listing/es-419.md) |

---

## Store listing

App name, short description and full description live per language in
[`store-listing/`](store-listing/) — one file each, every block exactly what
goes in the matching Play Console field. Those files also carry the App Store's
fields, which is why they are no longer named for Play alone; the table at the
top of each says which block goes to which console.

They are not duplicated here on purpose. Copy kept in two places is copy that
disagrees with itself eventually, and this file has already been wrong twice
about things it was duplicating.

`store-listing.test.ts` fails the build when a block outgrows Play's limit for
its field, when a field goes missing, when the three files stop calling the app
the same thing, or when the "no analytics" promise is left standing after
Analytics ships.

---

## Store settings

Development → Store presence → **Store settings**.

| Field | Value |
| --- | --- |
| App or game | **App** |
| Category | **Tools** |
| Email | `contact@rogeriodocarmo.com` |
| Phone | **blank** |
| Website | <https://rogeriodocarmo.com> |
| External marketing | **leave enabled** |

### Why Tools, and when it would stop being right

Play asks for the **primary function**, and this app's is conversion — text to
Morse and back. The closest analogue on the store, Google Translate, sits in
Tools.

**Education** is the real alternative and not a silly one: the Learn tab has the
alphabet, the timing rules and the memorisation method. But it is one tab of
four. Filing there sets the expectation of a course or a drill app, and someone
who arrives with that expectation meets a translator. Move it only if the
learning side becomes the main event — a Koch-method trainer with progress
tracking would justify it.

**Communication** looks tempting because Morse *is* a communication code. Play
means messaging, calling and browsers by it. This app never contacts anybody.

### Tags

Three, not five. Play allows up to five and the temptation is to fill them.

| Tag | Reaches | Why a stranger sees it |
| --- | --- | --- |
| **Educação** | Educação | the Learn tab — full alphabet, timing rules, method |
| **Ferramentas** | Ferramentas | the primary function: a converter |
| **Guia de estudo** | Educação | the Tips screen is literally one — five methods that work, one that does not |

Google's bar is stricter than "sounds related", and it is the whole test:

> It should be very clear to a user who is unfamiliar with the app why the tag
> is relevant based on the store listing or initial in-app experience.

**Aprendizado de idiomas** and **Pronúncia** were offered and dropped, which was
the right call: both reach through the language-learning group, and Morse is a
CODE rather than a language. A stranger has to make an allowance for you before
either fits, and that allowance is exactly what the bar above refuses.

⚠️ **An irrelevant tag is worse than an empty slot.** It brings installs that
bounce, and install-then-uninstall is the worst signal a new app can send. Three
that fit beat five that nearly do.

### Tags that look right and are not

- ⚠️ **Lanterna** (Ferramentas) — the app really does drive the torch, and the
  listing really does say "as the camera flash". Someone searching for a
  flashlight will install it, find a Morse translator, and uninstall. This is
  the single most likely way to manufacture a bounce here.
- ⚠️ **Comunicação** — Morse *is* a communication code, which is what makes this
  the trap. Play means messaging and calling; this app never contacts anybody.
- **Dicionário** (Livros e referências) — tempting for the reach into another
  category. A dictionary maps a word to a meaning; the Learn tab maps a letter
  to a code.

### The two that are easy to get wrong

⚠️ **Phone stays blank.** It is optional and Play DISPLAYS it. A personal number
on a public store page is not something that can be quietly withdrawn.

⚠️ **External marketing takes 60 days to change.** Leaving it enabled costs
nothing on a free app with no ads and helps discovery, but if it is ever turned
off, that is not a same-day decision.

---

## App content — the long form

| Section | Answer |
| --- | --- |
| **App access** | *All functionality is available without special access.* There is no account, no login, no region lock and no paywall — every screen is reachable on a fresh install. Nothing to write in the credentials box |
| Privacy policy | <https://rogeriodocarmo.github.io/morse_app/privacy-policy.html> |
| Ads | **No ads** |
| Data safety | **Crash logs** and **Device or other IDs** — see below |
| Content rating | IARC questionnaire; a translator with no user-generated content rates lowest everywhere |
| Target audience | **13+** — keeps it out of the Families policy |
| News app | No |
| COVID-19 / health | No |
| Government app | No |
| Financial features | None |
| Data deletion | No account, so nothing to delete |

### Data safety, in detail

Declare **two** things collected:

- **Crash logs** — collected, **not shared**, **not linked** to identity, **not**
  used for tracking. Purpose: app functionality / diagnostics. Optional, because
  Settings → Privacy switches it off and the collector really is swapped for a
  no-op.
- **Device or other IDs** — same answers: collected, not shared, not linked, not
  tracking, app functionality / diagnostics.

⚠️ **That second one is easy to miss, and missing it is the expensive kind of
mistake.** An earlier version of this file said "declare crash logs and nothing
else", which was wrong. `PRIVACY.md` says an identifier leaves the device in
TWO places, and it is the authority here because it was written against the
code:

> …your device model and operating system version, and an app-generated
> **installation identifier**.
>
> That request goes to Expo's update service and carries the app version,
> platform, and an **installation identifier**.

Play's "Device or other IDs" category names *Firebase installation ID* among
its own examples, and Crashlytics uses Firebase Installations. Under-declaring
gets an app removed; over-declaring costs one line on the listing. When the two
are that lopsided, declare it.

The rule this comes from: **the policy and the Data safety form must say the
same thing.** If `PRIVACY.md` names something that leaves the device, the form
has to account for it. Read one against the other before submitting, rather
than filling the form from memory.

Declare nothing beyond those two. Messages, decoded text and every preference
stay on the device.

⚠️ **App activity is NOT declared, and that is a decision rather than an
oversight.** Firebase Analytics is planned — tagging UI interactions as events
to find out which flows people actually use — and declaring the category early
would have saved revisiting this form later. It was briefly ticked for exactly
that reason and then removed, because a Data safety form describes what the app
does TODAY, and today it collects no app activity at all. A declaration that
runs ahead of the code is inaccurate in the same way one that lags behind it
is; only the consequences differ.

### When Firebase Analytics ships

Four things move together, and the second is the one that would otherwise be
missed:

1. **App activity** joins the declaration — collected, not shared, not linked,
   not tracking.
2. ⚠️ **`Advertising ID` flips to YES.** Firebase Analytics collects the
   Android advertising ID by default. The current NO is correct *only* while
   the app ships Crashlytics alone, and adding Analytics without revisiting it
   turns a correct answer into a false one — the direction that gets an app
   removed. `google_analytics_adid_collection_enabled=false` suppresses it;
   decide deliberately rather than inheriting the default.
3. `PRIVACY.md` and `docs/privacy-policy.html` gain a section, and the
   published page is republished.
4. Analytics gets **its own opt-out** beside the crash-reports toggle. This app
   already treats sending anything off-device as something a user may refuse,
   and analytics without that switch would break a promise it already makes.

⚠️ **Personal info: NOTHING.** Not even *User IDs*. That category means an
identifier for an identifiable PERSON — an account ID, a username — and the
crash adapter never calls `setUserId`, `setCustomKey` or `setAttribute`. The
installation identifier is not a user ID; it belongs under Device or other IDs.
This was ticked by mistake once, which is why it is written down.

⚠️ **Advertising ID: no.** The app ships Crashlytics only, not Analytics.
Play asks per SDK and it is easy to tick the wrong box from memory. An
installation ID is not an advertising ID — the first is declared above, the
second does not exist here.

⚠️ **Say yes to "data encrypted in transit".** Crash reports and the
`expo-updates` check both go over HTTPS.

### The rest of the Data safety questionnaire

| Question | Answer |
| --- | --- |
| Collects or shares required data types | **Yes** |
| Encrypted in transit | **Yes** |
| Account creation methods | **App does not allow users to create an account** |
| Sign in with accounts created elsewhere | **No** |
| Way to request data deletion (optional) | **No** — there is no account, so there is nothing to look up and delete for a person |

⚠️ **`No`, deliberately, and not the 90-day variant.** "No, but data is deleted
automatically within 90 days" was available and would have earned a slightly
better line on the listing, but it would have meant asserting a retention
period on Firebase's behalf without having checked it. A Data safety answer is
a declaration, not a description, and the honest answer costs nothing here.

The Settings toggle is a **control**, not a deletion mechanism, and does not
qualify as one either.

### Permissions Play will ask about

None of the six needs a declaration form — no location, SMS, call log or
all-files access. If a reviewer asks:

| Permission | Why |
| --- | --- |
| `CAMERA` | the torch. There is no separate torch permission on Android |
| `RECORD_AUDIO` | speech input, on the Speak tab only |
| `VIBRATE` | the Vibrate output channel |
| `MODIFY_AUDIO_SETTINGS` | the Sound output channel |
| `INTERNET` | crash reports, and the update check |
| `ACCESS_NETWORK_STATE` | Crashlytics stamps the network type on every report |

---

## Graphics

Not written here — they are files, not copy.

| Asset | Requirement |
| --- | --- |
| App icon | 512×512 PNG, **32-bit with no alpha** |
| Feature graphic | 1024×500 |
| Phone screenshots | 2–8, min 320px on the short side |

⚠️ **The mockups in `OmniMorse_Google_Apple_Store_Mockups` do not match the
app.** They show "Hello world" where it now seeds SOS, a "Flash it" button
where the app says "Signal", and no output-channel strip at all — which is the
app's main control. Both stores require screenshots to represent the app in
use. Re-render them from the built app before the listing goes public.
