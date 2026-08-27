import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

/**
 *
 */
export type Segment<T extends string> = Readonly<{ value: T; label: string }>;

type Props<T extends string> = Readonly<{
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}>;

/**
 * The sliding pill selector used for the translation direction, the speech
 * locale and the playback speed.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  testID,
}: Props<T>): React.JSX.Element {
  return (
    <View testID={testID} style={styles.track}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            testID={`segment-${segment.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`segment-${segment.value}`}
            onPress={() => {
              onChange(segment.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={active ? styles.labelActive : styles.label} numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.color.track,
    borderRadius: theme.radius.chip,
    padding: 4,
  },
  segment: {
    flex: 1,
    height: theme.hitTarget,
    borderRadius: theme.radius.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  segmentActive: {
    backgroundColor: theme.color.surface,
    boxShadow: theme.shadow.control,
  },
  label: { ...theme.type.controlIdle, color: theme.color.muted },
  labelActive: { ...theme.type.control, color: theme.color.ink },
});
