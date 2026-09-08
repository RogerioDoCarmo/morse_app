import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/application/providers/LocaleProvider';
import { usePermissionGate } from '@/application/providers/PermissionGate';
import { useSettings } from '@/application/providers/SettingsProvider';
import { usePorts } from '@/application/providers/PortsProvider';
import { useOutputChannels } from '@/application/useOutputChannels';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { MorseText } from '@/components/MorseText';
import { OutputChannels } from '@/components/OutputChannels';
import { SignalSurface } from '@/components/SignalSurface';
import { SignalButton } from '@/components/SignalButton';
import { AppFrame } from '@/components/AppFrame';
import type { TabName } from '@/components/TabBar';
import { encode, encodeToString } from '@/core/domain/morse';
import { unitMsForWpm } from '@/core/domain/timeline';
import type { TranslationKey } from '@/i18n';
import { theme } from '@/theme';

/** What the screen is doing. `denied` and `missing` are dead ends with a reason. */
type Phase = 'idle' | 'listening' | 'done' | 'denied' | 'missing' | 'failed';

/** Title and hint for each phase. */
const COPY: Readonly<
  Record<Phase, Readonly<{ title: TranslationKey; hint: TranslationKey }>>
> = Object.freeze({
  idle: { title: 'speech.tapToSpeak', hint: 'speech.idleHint' },
  listening: { title: 'speech.listening', hint: 'speech.listeningHint' },
  done: { title: 'speech.gotIt', hint: 'speech.doneHint' },
  denied: { title: 'speech.tapToSpeak', hint: 'speech.denied' },
  missing: { title: 'speech.tapToSpeak', hint: 'speech.unavailable' },
  failed: { title: 'speech.tapToSpeak', hint: 'speech.failed' },
});

/**
 * The level bars, as fixed heights rather than a live meter.
 *
 * The recogniser reports words, not amplitude — a meter driven by nothing
 * would be an animation pretending to be data. These say "listening" and
 * claim nothing more.
 */
const LEVELS = [
  { height: 10 },
  { height: 22 },
  { height: 34 },
  { height: 26 },
  { height: 14 },
] as const;

type Props = Readonly<{
  onSelectTab: (tab: TabName) => void;
  unavailableTabs: readonly TabName[];
}>;

/**
 * Speech input — built from `design/screens/Speech.dc.html`.
 *
 * The transcript is encoded as it arrives, partials included, so the Morse
 * grows while the speaker is still talking rather than appearing in one lump
 * at the end. That is the whole reason the port reports partials.
 */
export function SpeechScreen({ onSelectTab, unavailableTabs }: Props): React.JSX.Element {
  const { t, locale } = useLocale();
  const { speech } = usePorts();
  // The recogniser follows the interface unless Language has pointed it
  // somewhere else — a device may not have every voice pack installed.
  const { settings } = useSettings();
  const speechLocale = settings.speechLocale ?? locale;
  const { ensure } = usePermissionGate();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  /** Returned by `start`; calling it stops the recogniser and unhooks it. */
  const release = useRef<(() => void) | null>(null);

  const message = useMemo(() => encode(heard), [heard]);
  const morse = useMemo(() => encodeToString(heard), [heard]);

  // What was heard is a message like any other, and it goes out the same four
  // ways. A tester came to this screen looking for the vibration the
  // Translator offers and found the transcript was a dead end.
  const { playback, cells } = useOutputChannels(
    message,
    unitMsForWpm(settings.playbackWpm),
  );

  // While the screen is carrying the message, the square IS the message and the
  // chips would only compete with it — the same trade the Translator makes.
  // Without this the Screen channel switched on and nothing happened: the
  // toggle worked, the run started, and no surface existed to flash.
  const showSurface = playback.playing && playback.channels.screen;
  const listening = phase === 'listening';

  const letGo = useCallback((): void => {
    release.current?.();
    release.current = null;
  }, []);

  // Leaving the screen must not leave the microphone open.
  useEffect(() => letGo, [letGo]);

  const listen = useCallback(async (): Promise<void> => {
    // Rationale before the OS prompt. The recogniser would otherwise ask on
    // its own, and its dialog gets one sentence to explain a microphone.
    if (!(await ensure('microphone'))) return;

    if (!(await speech.isAvailable(speechLocale))) {
      setPhase('missing');
      return;
    }

    setHeard('');
    setPhase('listening');

    release.current = await speech.start(
      speechLocale,
      (result) => {
        setHeard(result.transcript);
        if (result.isFinal) setPhase('done');
      },
      (reason) => {
        letGo();
        setPhase(reason === 'permission' ? 'denied' : 'failed');
      },
    );
  }, [ensure, letGo, speechLocale, speech]);

  const finish = useCallback(async (): Promise<void> => {
    // stop, not release: the final transcript is the point of tapping again.
    await speech.stop();
    setPhase('done');
  }, [speech]);

  const copy = COPY[phase];

  return (
    <AppFrame active="speak" onSelect={onSelectTab} unavailable={unavailableTabs}>
      <View style={[styles.screen, { paddingTop: insets.top }]} testID="speech-screen">
        <View style={styles.header}>
          <Text style={styles.wordmark}>{t('app.name')}</Text>
        </View>

        <View style={styles.stage}>
          <View style={styles.level} testID="speech-level">
            {LEVELS.map((live, index) => (
              <View
                key={`bar${String(index)}`}
                style={[
                  styles.bar,
                  listening ? live : styles.barQuiet,
                  listening && styles.barLive,
                ]}
              />
            ))}
          </View>

          <Pressable
            testID="mic-button"
            accessibilityRole="button"
            accessibilityLabel="mic-button"
            accessibilityState={{ selected: listening }}
            onPress={() => {
              void (listening ? finish() : listen());
            }}
            style={({ pressed }) => [
              styles.mic,
              listening ? styles.micLive : styles.micIdle,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="mic"
              size={38}
              strokeWidth={1.7}
              color={listening ? theme.color.onAccent : theme.color.ink}
            />
          </Pressable>

          <View style={styles.status}>
            <Text testID="speech-title" style={styles.title}>
              {t(copy.title)}
            </Text>
            <Text testID="speech-hint" style={styles.hint}>
              {t(copy.hint)}
            </Text>
          </View>
        </View>

        {heard === '' ? null : (
          <>
            {/* The transcript SHRINKS and scrolls; the stage above it and the
                outputs below do not. A long transcript would otherwise push
                one of them off the screen, and the stage's mic is 104pt of
                fixed height that cannot give way. */}
            <ScrollView style={styles.heard} contentContainerStyle={styles.heardContent}>
              <Card>
                <Text style={styles.label}>{t('speech.heard')}</Text>
                <Text testID="speech-transcript" style={styles.transcript}>
                  {heard}
                </Text>
                {showSurface ? (
                  <SignalSurface lit={playback.screenLit} />
                ) : (
                  <View style={styles.morseBlock}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <MorseText message={message} testID="speech-morse" />
                    </ScrollView>
                    <Text testID="speech-morse-string" style={styles.mono}>
                      {morse}
                    </Text>
                  </View>
                )}
              </Card>
            </ScrollView>

            <View style={styles.outputs}>
              <OutputChannels cells={cells} />
              <View style={styles.actions}>
                <SignalButton
                  playing={playback.playing}
                  canPlay={playback.canPlay}
                  onPress={playback.playing ? playback.stop : playback.play}
                  label={playback.playing ? t('translator.stop') : t('translator.signal')}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.ground },
  header: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.gutter,
  },
  wordmark: { ...theme.type.wordmark, color: theme.color.ink },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  level: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 42 },
  bar: { width: 6, borderRadius: 3, backgroundColor: '#dfe3e8' },
  barQuiet: { height: 10 },
  barLive: { backgroundColor: theme.color.accent },
  mic: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIdle: { backgroundColor: theme.color.surface, boxShadow: theme.shadow.card },
  micLive: { backgroundColor: theme.color.accent },
  pressed: { opacity: 0.85 },
  status: { alignItems: 'center', maxWidth: 280, gap: 5 },
  title: { ...theme.type.action, fontSize: 17, color: theme.color.ink },
  hint: { ...theme.type.body, color: theme.color.muted, textAlign: 'center' },
  // flexShrink, not flex: with no transcript this is not rendered at all and
  // the stage keeps the screen; with one, this is the part that gives way.
  heard: { flexShrink: 1 },
  heardContent: { paddingHorizontal: theme.gutter, paddingBottom: theme.spacing.md },
  outputs: { paddingHorizontal: theme.gutter, gap: theme.spacing.md },
  actions: { flexDirection: 'row', paddingBottom: theme.spacing.md },
  label: {
    ...theme.type.label,
    color: theme.color.faint,
    marginBottom: theme.spacing.sm,
  },
  transcript: { ...theme.type.input, fontSize: 22, color: theme.color.ink },
  morseBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  mono: { ...theme.type.mono, color: theme.color.muted },
});
