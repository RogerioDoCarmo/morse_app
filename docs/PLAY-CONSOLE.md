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

**en-US**

```text
• The volume warning: if sound is on and the phone is turned right down, the app now says so instead of playing into silence.
• Vibration works on Android.
• The torch no longer flashes a black rectangle across the screen.
• Speak on the Translator opens the Speak tab instead of doing nothing.
• The welcome carousel swipes, and Skip closes it.
• Settings shows which build you are on.
```

**pt-BR**

```text
• Aviso de volume: se o som está ligado e o aparelho está no mínimo, o app avisa em vez de tocar no silêncio.
• A vibração funciona no Android.
• A lanterna não pisca mais um retângulo preto na tela.
• O botão Falar no Tradutor abre a aba Falar em vez de não fazer nada.
• O carrossel de boas-vindas desliza, e Pular fecha ele.
• Os Ajustes mostram qual versão está instalada.
```

**es-419**

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
| Privacy policy | <https://rogeriodocarmo.github.io/morse_app/privacy-policy.html> |
| Ads | **No ads** |
| Data safety | **Crash logs only** — see below |
| Content rating | IARC questionnaire; a translator with no user-generated content rates lowest everywhere |
| Target audience | **13+** — keeps it out of the Families policy |
| News app | No |
| COVID-19 / health | No |
| Government app | No |
| Financial features | None |
| Data deletion | No account, so nothing to delete |

### Data safety, in detail

Declare exactly one thing collected:

- **Crash logs** — collected, **not shared**, **not linked** to identity, **not**
  used for tracking. Purpose: app functionality / diagnostics. Optional, because
  Settings → Privacy switches it off and the collector really is swapped for a
  no-op.

Declare **nothing else**. Messages, decoded text and every preference stay on
the device.

⚠️ **Advertising ID: no.** The app ships Crashlytics only, not Analytics.
Play asks per SDK and it is easy to tick the wrong box from memory.

⚠️ **Say yes to "data encrypted in transit".** Crash reports and the
`expo-updates` check both go over HTTPS.

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
