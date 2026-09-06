# Architecture

Hexagonal — ports and adapters. Source dependencies point **inward only**.

```text
  UI layer            screens/ · components/ · hooks/
        │ depends on
        ▼
  application/        providers (DI via React Context) · createPorts (composition root)
        │ provides an
        ▼
  core/ports          ◄─ the contract (interfaces)
        │ implemented by        ▲ adapters depend only on the interface
        ▼                       │
  adapters/           the ONLY importers of expo-* / third-party libraries
        │ wraps
        ▼
  third-party         expo-camera · expo-speech · expo-localization

  core/domain — pure functions and types. Imported by every layer; imports nothing.
```

## The rule that keeps it honest

`src/core/**` may not import React, React Native, any `expo-*` package, or any adapter.
That is enforced by ESLint (`no-restricted-imports`), not by discipline — see
`eslint.config.js`. If the domain needs something from outside, it gets a port.

## Layers

| Path | Holds | May import |
| --- | --- | --- |
| `src/core/domain` | Morse encode/decode, tap timing, permission and locale types | nothing |
| `src/core/ports` | interfaces the adapters satisfy | `core/domain` types only |
| `src/adapters` | one folder per wrapped library | its own library + ports + domain |
| `src/application` | DI providers and the composition root | everything |
| `src/components`, `src/screens`, `src/hooks` | presentation | ports via hooks, never adapters |
| `src/i18n` | the three locales, completeness enforced by the type | domain types |

## Why the torch is shaped oddly

`expo-camera` exposes the torch as a **`CameraView` prop**, not as an imperative call, so
something must be mounted for it to switch. `createExpoTorchAdapter` therefore holds the
requested state and lets a host component observe it (`TorchHost`), which mounts a 1×1
invisible camera only while the torch is on. The decision to switch stays behind the port;
only the mounting lives in the UI layer.

## Ports

| Port | Wraps | Status |
| --- | --- | --- |
| `ITorchPort` | expo-camera | implemented |
| `ITextToSpeechPort` | expo-speech | implemented |
| `ILocalePort` | expo-localization | implemented |
| `IPermissionPort` | expo-camera permissions | implemented |
| `ISpeechRecognitionPort` | — | **stub**: reports unavailable |

Expo ships no first-party recogniser, so the module choice is deferred to the feature
branch that builds the Speak screen. Reporting "unavailable" is the same answer a real
device gives when a locale's recogniser is missing, so the UI has to handle that path
anyway — and now it is exercised from day one.

## Testing

Four tiers, per `FOUNDATION.md`:

- **Unit / integration** — Jest + React Native Testing Library, 80% thresholds
- **Property-based** — fast-check. The round-trip invariant is stated against the
  *normalised* input, because diacritic folding means it cannot hold against the raw
  input: `decode(encodeToString(t)) === normaliseForMorse(t)`
- **Mutation** — Stryker over `src/core/**`, break threshold 60
- **E2E** — Maestro. Selectors are stable accessibility labels, **never** localised text
