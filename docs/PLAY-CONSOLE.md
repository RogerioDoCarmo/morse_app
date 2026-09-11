# Play Console — what to paste

The Google Play half of [TESTFLIGHT.md](TESTFLIGHT.md). Kept here so the next
release does not start from a blank console, and so the answers stay consistent
with what the app actually does.

> ⚠️ **The app still calls itself "Morse" on screen.** `app.json` says `Morse`,
> and so does the wordmark on the Translator. This listing says **OmniMorse**.
> Reviewers compare the listing to the running app, so either land the rename
> before the store listing goes public, or keep the listing name as `Morse`
> until it does. It is fine for an internal test track, where nobody reviews
> anything.

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

Play takes these per language. 500 characters each.

#### en-US

```text
• The volume warning: if sound is on and the phone is turned right down, the app now says so instead of playing into silence.
• Vibration works on Android.
• The torch no longer flashes a black rectangle across the screen.
• Speak on the Translator opens the Speak tab instead of doing nothing.
• The welcome carousel swipes, and Skip closes it.
• Settings shows which build you are on.
```

#### pt-BR

```text
• Aviso de volume: se o som está ligado e o aparelho está no mínimo, o app avisa em vez de tocar no silêncio.
• A vibração funciona no Android.
• A lanterna não pisca mais um retângulo preto na tela.
• O botão Falar no Tradutor abre a aba Falar em vez de não fazer nada.
• O carrossel de boas-vindas desliza, e Pular fecha ele.
• Os Ajustes mostram qual versão está instalada.
```

#### es-419

```text
• Aviso de volumen: si el sonido está activado y el teléfono está al mínimo, la app lo dice en vez de reproducir en silencio.
• La vibración funciona en Android.
• La linterna ya no muestra un rectángulo negro en la pantalla.
• El botón Hablar del Traductor abre la pestaña Hablar en vez de no hacer nada.
• El carrusel de bienvenida se desliza, y Saltar lo cierra.
• Los Ajustes muestran qué versión tienes.
```

---

## Store listing

| Field | Limit | Value |
| --- | --- | --- |
| App name | 30 | `OmniMorse` — 9 |
| Short description (en-US) | 80 | `Encode. Decode. Learn. Morse by sound, light, screen or vibration.` — 66 |
| Short description (pt-BR) | 80 | `Codifique. Decodifique. Aprenda. Morse em som, luz, tela ou vibração.` — 69 |
| Short description (es-419) | 80 | `Codifica. Decodifica. Aprende. Morse en sonido, luz, pantalla o vibración.` — 74 |

### Full description (en-US)

```text
OmniMorse turns text into Morse code and Morse code back into text.

Type a message and watch it become dots and dashes letter by letter. Say it out loud and let the phone transcribe it. Or tap it in yourself on a key that measures how long you hold it — press briefly for a dot, hold for a dash — with a cut-off you can set to match your own speed.

FOUR WAYS TO SEND IT

A message can go out as sound, as the camera flash, as a flashing screen, or as vibration. Switch any of them on or off, even while a message is playing. They run together, in step, from one clock.

LEARN IT PROPERLY

Tap any letter to hear just that one — the quickest way to learn the rhythm. The Learn tab has the full alphabet, the timing rules that make the silences matter as much as the marks, and five things that actually work for memorising it.

IN YOUR LANGUAGE

The whole interface is in English, Brazilian Portuguese and Spanish. So is speech input, where your device supports it.

PRIVATE BY DEFAULT

No account. No advertising. No analytics. Nothing you type, say or key ever leaves your phone. The app sends anonymous crash diagnostics so failures can be fixed, and you can switch that off in Settings.
```

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
