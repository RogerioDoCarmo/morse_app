import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { AppFrame } from './AppFrame';
import { renderWithProviders } from '@/testing/renderWithProviders';

let mockWidth = 402;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 820, scale: 2, fontScale: 1 }),
}));

const PHONE = 402;
const TABLET = 1180;

function show(width: number, onSelect = jest.fn(), onOpenSettings?: () => void) {
  mockWidth = width;
  renderWithProviders(
    <AppFrame
      active="translate"
      onSelect={onSelect}
      unavailable={[]}
      {...(onOpenSettings === undefined ? {} : { onOpenSettings })}
    >
      <Text testID="content">content</Text>
    </AppFrame>,
  );
  return onSelect;
}

afterEach(() => {
  mockWidth = PHONE;
});

describe('AppFrame', () => {
  it('gives a phone the bottom bar and no rail', () => {
    show(PHONE);
    expect(screen.getByTestId('tab-bar')).toBeOnTheScreen();
    expect(screen.queryByTestId('nav-rail')).toBeNull();
  });

  it('gives a tablet the rail and no bottom bar', () => {
    show(TABLET);
    expect(screen.getByTestId('nav-rail')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it.each([
    ['phone', PHONE],
    ['tablet', TABLET],
  ])('shows the screen it wraps on a %s', (_label, width) => {
    show(width);
    expect(screen.getByTestId('content')).toBeOnTheScreen();
  });

  // One set of destinations in two shells: the same testIDs, so every flow and
  // every test reaches navigation the same way whichever shell is drawn.
  it.each([
    ['phone', PHONE],
    ['tablet', TABLET],
  ])('reaches the same four destinations on a %s', (_label, width) => {
    show(width);
    for (const tab of ['translate', 'speak', 'tap', 'learn']) {
      expect(screen.getByTestId(`tab-${tab}`)).toBeOnTheScreen();
    }
  });

  it.each([
    ['phone', PHONE],
    ['tablet', TABLET],
  ])('navigates from a %s', (_label, width) => {
    const onSelect = show(width);
    fireEvent.press(screen.getByTestId('tab-learn'));
    expect(onSelect).toHaveBeenCalledWith('learn');
  });

  // The phone keeps its gear in the Translator header, where that screen has a
  // header to put it in. The rail has a foot.
  it('offers settings on the rail when given somewhere to go', () => {
    const onOpenSettings = jest.fn();
    show(TABLET, jest.fn(), onOpenSettings);
    fireEvent.press(screen.getByTestId('open-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('leaves the rail without a gear when there is nowhere to go', () => {
    show(TABLET);
    expect(screen.queryByTestId('open-settings')).toBeNull();
  });

  // 768 is the short edge of every iPad in portrait; below it two columns
  // would each get less than a phone's worth of room.
  it.each([
    ['just below the breakpoint', 767, 'tab-bar'],
    ['exactly at it', 768, 'nav-rail'],
  ])('switches shell %s', (_label, width, expected) => {
    show(width);
    expect(screen.getByTestId(expected)).toBeOnTheScreen();
  });
});
