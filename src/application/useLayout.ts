import { useWindowDimensions } from 'react-native';
import { isTabletWidth } from '@/core/domain/layout';

/** Which shape the app should take for the room it currently has. */
export function useLayout(): Readonly<{ tablet: boolean }> {
  // Window rather than screen: on a tablet the app may be a split-screen half,
  // and it should lay out for the space it was given, not the glass.
  const { width } = useWindowDimensions();
  return { tablet: isTabletWidth(width) };
}
