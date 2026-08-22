import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MorseMessage } from '@/core/domain/morse';
import { theme } from '@/theme';

type Props = Readonly<{
  /** The message to render. */
  message: MorseMessage;
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
  testID = 'morse-output',
}: Props): React.JSX.Element {
  return (
    <View
      testID={testID}
      accessibilityLabel={testID}
      accessible={false}
      style={styles.message}
    >
      {message.words.map((word, wordIndex) => (
        <View key={`w${String(wordIndex)}`} style={styles.word}>
          {word.letters.map((letter, letterIndex) => (
            <View
              key={`l${String(letterIndex)}`}
              testID="morse-letter"
              style={styles.letter}
            >
              <View style={styles.marks}>
                {letter.symbols.map((symbol, symbolIndex) => (
                  <View
                    key={`s${String(symbolIndex)}`}
                    style={symbol === '.' ? styles.dot : styles.dash}
                  />
                ))}
              </View>
              <Text style={styles.char}>{letter.char}</Text>
            </View>
          ))}
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
  marks: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  dash: { width: 21, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  char: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    color: theme.color.muted,
  },
});
