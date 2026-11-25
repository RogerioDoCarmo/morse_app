# Store listing — pt-BR

Português do Brasil. Paste-ready: every fenced block below is exactly what goes in the
matching store field, and nothing else in this file is.

| Block | Google Play | App Store Connect |
| --- | --- | --- |
| App name | App name — 30 | Name — 30 |
| Short description | Short description — 80 | — |
| Subtitle | — | Subtitle — 30 |
| Keywords | — | Keywords — 100 |
| Promotional text | — | Promotional Text — 170 |
| Full description | Full description — 4000 | Description — 4000 |
| Release notes | What's new — 500 | What's New in This Version — 4000 |

Three blocks serve both stores, and that is deliberate: copy kept twice is copy
that disagrees with itself eventually. Where the two limits differ, Play's is
the tighter one and fits inside Apple's either way — so the shorter limit is the
one that governs.

The file is named for Play's locale code. App Store Connect calls this same
language **Portuguese (Brazil)**.

`store-listing.test.ts` fails the build if a block outgrows its field — copy
that is too long is rejected at paste time, one field at a time, in a browser.

See [PLAY-CONSOLE.md](../../notes/PLAY-CONSOLE.md) and [APP-STORE.md](../../notes/APP-STORE.md)
for the answers that are not per language.

## App name

```text
OmniMorse
```

## Short description

```text
Codifique. Decodifique. Aprenda. Morse em som, luz, tela ou vibração.
```

## Subtitle

Not the punchline verbatim. “Codifique. Decodifique. Aprenda.” is 32
characters and Apple allows 30, so the subtitle uses the shorter rendering and
the full punchline stays in the description. Cifrar and decifrar are what a
Brazilian would say about a code anyway.

```text
Codifique, decifre, aprenda
```

## Keywords

App Store only. Comma-separated with no spaces — a space after a comma is a
character Apple counts and nothing gains by it. Apple pairs keywords into
phrases by itself, so morse and code already cover the search "morse code".

Under the limit on purpose. Filling the last characters with weaker terms is
the same mistake as a fourth Play tag: an install that bounces is the worst
signal a new app can send.

```text
morse,código,tradutor,telégrafo,sos,sinal,pontos,traços,decodificar,alfabeto,radioamador,cw
```

## Promotional text

App Store only, and the one field that can be changed WITHOUT shipping a build
or waiting for review. It sits above the description. Use it for whatever is
worth saying this month; the description is what stays.

```text
Quatro jeitos de enviar uma mensagem: som, o flash da câmera, a tela ou vibração. Ligue e desligue qualquer um durante a reprodução. Toque numa letra para ouvir só ela.
```

## Full description

```text
OmniMorse transforma texto em código Morse e código Morse de volta em texto.

Digite uma mensagem e veja ela virar pontos e traços, letra por letra. Fale em voz alta e deixe o aparelho transcrever. Ou toque você mesmo numa tecla que mede quanto tempo você segura — toque rápido para um ponto, segure para um traço — com um limite que você ajusta à sua velocidade.

QUATRO JEITOS DE ENVIAR

Uma mensagem pode sair como som, como o flash da câmera, como a tela piscando ou como vibração. Ligue e desligue qualquer um deles, mesmo com a mensagem em andamento. Todos correm juntos, no mesmo compasso, a partir de um único relógio.

APRENDA DE VERDADE

Toque em qualquer letra para ouvir só ela — o jeito mais rápido de aprender o ritmo. A aba Aprender tem o alfabeto inteiro, as regras de tempo que fazem os silêncios contarem tanto quanto as marcas, e cinco coisas que funcionam de verdade para memorizar.

NO SEU IDIOMA

A interface inteira está em inglês, português do Brasil e espanhol. A entrada por voz também, onde o seu aparelho oferecer.

PRIVADO POR PADRÃO

Sem conta. Sem anúncios. Sem analytics. Nada do que você digita, fala ou toca sai do seu aparelho. O app envia diagnósticos anônimos de falhas para que os erros possam ser corrigidos, e você pode desligar isso nos Ajustes.
```

## Release notes

For 0.3.13. Replace for each release; keep the shape.

0.3.13 adds Share on the Translator: the message goes to the system share
sheet as OmniMorse.wav, the same tones at the same speed as Emit. It adds the
expo-sharing native module, so it needs a new binary on both platforms; an
over-the-air update cannot deliver it. ⚠️ It was not requested by a tester:
do not present it as tester feedback.

Earlier: 0.3.12 declares the portrait screen, the camera and the microphone as optional
Android hardware. Play Console refused the 0.3.11 (19) closed-test release
because expo-camera's code scanner implied a required portrait screen; the
camera and microphone were implied by their permissions. ⚠️ It came from that
refusal, not from a tester: do not present it as tester feedback. iOS is
unchanged, so there is nothing new to submit to App Store Connect for this
version; 0.3.11 (19) went to App Store Connect from Xcode on 22 November.

⚠️ 0.3.6 SHIPPED WITH 0.3.5's NOTES — this block was not replaced, so the
tablet illustration fix went to both stores unannounced. It is the one part of
a release nothing can catch being stale, because a sentence about the wrong
version is still a well-formed sentence of the right length.

⚠️ The build number is assigned by EAS at build time and is not in this
repository — read it off the binary, or off the Settings screen, which shows it
from 0.3.5 onward.

⚠️ AND 0.3.7's FIRST DRAFT OF THIS BLOCK DESCRIBED A BUILD THAT DID NOT
SHIP YET — written before the permission-refusal feedback and the label/dot
work were merged, so it mentioned neither. The stale-notes trap has two
directions: copy left over from the last release, and copy written before
this one finished. Re-read this block against the log on the day you submit.

```text
• Compartilhe uma mensagem como som: o novo botão de compartilhar, ao lado do de copiar, envia a mensagem como arquivo de áudio para o app que você escolher, na sua velocidade de reprodução.
```
