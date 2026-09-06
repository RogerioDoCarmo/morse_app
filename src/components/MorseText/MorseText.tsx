import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MorseMessage } from '@/core/domain/morse';
import { theme } from '@/theme';

type Props = Readonly<{
  /** The message to render. */
  message: MorseMessage;
  /** Index of the selected letter, counted across the whole message. */
  selectedIndex?: number | null;
  /**
   * Index of the letter the playhead is on, or null when nothing is playing.
   * Letters before it read as already played, which is what turns the output
   * itself into the progress indicator.
   */
  soundingIndex?: number | null;
  /** Called with that same flat index when a letter is pressed. */
  onSelectLetter?: (index: number) => void;
  /** Test identifier. Also the Maestro selector — never assert on localised text. */
  testID?: string;
}>;

/**
 * Renders a Morse message as dots and dashes.
 *
 * Words are separated by a visibly larger gap than the wrap gap inside a word,
 * because the silences carry as much information as the marks do: without that
 * difference a wrapped word reads as two words.
 */
export function MorseText({
  message,
  selectedIndex = null,
  soundingIndex = null,
  onSelectLetter,
  testID = 'morse-output',
}: Props): React.JSX.Element {
  // Each word's starting index, computed before render rather than by mutating
  // a counter inside the map — React may re-enter the callback.
  const wordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const word of message.words) {
      offsets.push(running);
      running += word.letters.length;
    }
    return offsets;
  }, [message]);

  return (
    <View
      testID={testID}
      accessibilityLabel={testID}
      accessible={false}
      style={styles.message}
    >
      {message.words.map((word, wordIndex) => (
        <View key={`w${String(wordIndex)}`} style={styles.word}>
          {word.letters.map((letter, letterIndex) => {
            const index = (wordOffsets[wordIndex] ?? 0) + letterIndex;
            // Playback owns the highlight while it runs: a selection left over
            // from a tap would otherwise sit lit in the middle of a message.
            const playing = soundingIndex !== null;
            const played = playing && index < soundingIndex;
            const lit = playing ? index === soundingIndex : selectedIndex === index;
            const markColor = lit ? theme.color.onAccent : theme.color.accent;
            return (
              <Pressable
                key={`l${String(letterIndex)}`}
                testID="morse-letter"
                accessibilityRole="button"
                accessibilityState={{ selected: lit }}
                accessibilityLabel={`morse-letter-${letter.char}`}
                onPress={() => onSelectLetter?.(index)}
                style={[
                  styles.letter,
                  played && styles.letterPlayed,
                  lit && styles.letterSelected,
                ]}
              >
                <View style={styles.marks}>
                  {letter.symbols.map((symbol, symbolIndex) => (
                    <View
                      key={`s${String(symbolIndex)}`}
                      style={[
                        symbol === '.' ? styles.dot : styles.dash,
                        { backgroundColor: markColor },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={
                    lit ? styles.charSelected : played ? styles.charPlayed : styles.char
                  }
                >
                  {letter.char}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { flexDirection: 'column', gap: theme.spacing.lg },
  word: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  letter: {
    minWidth: theme.hitTarget,
    minHeight: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.groundAlt,
  },
  letterSelected: { backgroundColor: theme.color.accent },
  letterPlayed: { backgroundColor: theme.color.accentTint },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dash: { width: 21, height: 8, borderRadius: 4 },
  char: { ...theme.type.letter, color: theme.color.muted },
  charSelected: { ...theme.type.letter, color: theme.color.onAccent },
  charPlayed: { ...theme.type.letter, color: theme.color.accentDeep },
});
