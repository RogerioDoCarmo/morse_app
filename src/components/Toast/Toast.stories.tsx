import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Toast } from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
};

export default meta;

const noop = (): void => {};

/**
 * With and without the action, together.
 *
 * ⚠️ The action sits INSIDE the dismissing Pressable, deliberately: two targets
 * in one 44pt strip means a near miss deletes what the user was reaching for.
 * That makes the two variants visually similar and easy to regress into each
 * other, which is why they are snapshotted side by side rather than apart.
 */
export const WithAndWithoutAction: StoryObj = {
  render: () => (
    <View style={styles.stack}>
      <Toast visible message="Turn the volume up to hear it" onDismiss={noop} />
      <Toast
        visible
        message="Light needs the camera"
        onDismiss={noop}
        action={{ label: 'Settings', onPress: noop }}
      />
    </View>
  ),
};

const styles = StyleSheet.create({ stack: { gap: 16, padding: 16, width: 360 } });
