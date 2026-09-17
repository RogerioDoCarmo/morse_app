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
      'OmniMorse needs the torch',
    );
    expect(screen.getByText(/no image is ever captured/u)).toBeOnTheScreen();
  });

  // This used to assert "no audio is ever uploaded", which was not true: the
  // adapter does not require on-device recognition, so the platform is free to
  // send the audio away to transcribe it. The screen now says so, and says
  // what Morse itself does instead — which is the part the app can promise.
  it('says what the microphone is for, and who may hear it', () => {
    show('microphone');
    expect(screen.getByTestId('permission-headline')).toHaveTextContent(
      'Speaking needs the microphone',
    );
    expect(screen.getByText(/may send your audio to its servers/u)).toBeOnTheScreen();
    expect(screen.getByText(/never stores or uploads any of it/u)).toBeOnTheScreen();
  });

  // ⚠️ "Continue", never "Allow <thing> access". App Review rejected 0.3.4 (13)
  // under guideline 5.1.1(iv) for naming the permission on this button. The
  // label is deliberately the same for both kinds.
  it.each([['camera'], ['microphone']])(
    'says Continue rather than naming the %s permission',
    (kind) => {
      show(kind as PermissionKind);
      const primary = screen.getByTestId('permission-primary');
      expect(primary).toHaveTextContent('Continue');
      expect(primary).not.toHaveTextContent(/Allow/u);
    },
  );

  it('prompts when the primary action is taken', () => {
    const { onAllow, onOpenSettings } = show('camera');
    fireEvent.press(screen.getByTestId('permission-primary'));
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  // ⚠️ THE REGRESSION GUARD FOR GUIDELINE 5.1.1(iv). A second button here let
  // the user close the rationale and DELAY the system request, which is the
  // other half of what App Review rejected: "The user should always proceed to
  // the permission request after the message." The only way on is the prompt.
  it.each([['camera'], ['microphone']])('offers no way to skip the %s prompt', (kind) => {
    const { onDismiss } = show(kind as PermissionKind);
    expect(screen.queryByTestId('permission-dismiss')).toBeNull();
    expect(screen.queryByText(/Not now/u)).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
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
