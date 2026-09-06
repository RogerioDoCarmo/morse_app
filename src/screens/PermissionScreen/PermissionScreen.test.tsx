import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { PermissionScreen } from './PermissionScreen';
import { renderWithProviders } from '@/testing/renderWithProviders';
import type { PermissionKind } from '@/core/domain/permission';

function show(kind: PermissionKind, blocked = false) {
  const onAllow = jest.fn();
  const onOpenSettings = jest.fn();
  const onDismiss = jest.fn();
  const view = renderWithProviders(
    <PermissionScreen
      kind={kind}
      blocked={blocked}
      onAllow={onAllow}
      onOpenSettings={onOpenSettings}
      onDismiss={onDismiss}
    />,
  );
  return { ...view, onAllow, onOpenSettings, onDismiss };
}

describe('asking for a permission', () => {
  it('says what the torch is for, and that no image is captured', () => {
    show('camera');
    expect(screen.getByTestId('permission-headline')).toHaveTextContent(
      'Morse needs the torch',
    );
    expect(screen.getByText(/no image is ever captured/u)).toBeOnTheScreen();
  });

  it('says what the microphone is for, and that nothing is uploaded', () => {
    show('microphone');
    expect(screen.getByTestId('permission-headline')).toHaveTextContent(
      'Speaking needs the microphone',
    );
    expect(screen.getByText(/no audio is ever uploaded/u)).toBeOnTheScreen();
  });

  it.each([
    ['camera', 'Allow camera access'],
    ['microphone', 'Allow microphone access'],
  ])('offers to prompt for %s', (kind, label) => {
    show(kind as PermissionKind);
    expect(screen.getByTestId('permission-primary')).toHaveTextContent(label);
  });

  it('prompts when the primary action is taken', () => {
    const { onAllow, onOpenSettings } = show('camera');
    fireEvent.press(screen.getByTestId('permission-primary'));
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  // Both permissions are optional, so there is always a way past.
  it('offers Not now, and takes it', () => {
    const { onDismiss } = show('camera');
    expect(screen.getByTestId('permission-dismiss')).toHaveTextContent('Not now');
    fireEvent.press(screen.getByTestId('permission-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('once the permission is blocked', () => {
  it.each([
    ['camera', 'Camera access is off'],
    ['microphone', 'Microphone access is off'],
  ])('says %s access is off rather than asking again', (kind, headline) => {
    show(kind as PermissionKind, true);
    expect(screen.getByTestId('permission-headline')).toHaveTextContent(headline);
  });

  it('says the rest of the app keeps working', () => {
    show('microphone', true);
    expect(
      screen.getByText(/Everything else in the app keeps working/u),
    ).toBeOnTheScreen();
  });

  // The OS would not show a prompt at this point, so offering one would be a
  // button that does nothing.
  it('sends the user to the system settings instead of prompting', () => {
    const { onAllow, onOpenSettings } = show('camera', true);
    expect(screen.getByTestId('permission-primary')).toHaveTextContent('Open Settings');
    fireEvent.press(screen.getByTestId('permission-primary'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onAllow).not.toHaveBeenCalled();
  });

  it('still explains what the app will not do with the permission', () => {
    show('camera', true);
    expect(screen.getByText(/no image is ever captured/u)).toBeOnTheScreen();
  });

  it('offers Go back rather than Not now', () => {
    const { onDismiss } = show('camera', true);
    expect(screen.getByTestId('permission-dismiss')).toHaveTextContent('Go back');
    fireEvent.press(screen.getByTestId('permission-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
