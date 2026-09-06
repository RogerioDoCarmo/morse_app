import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';

/**
 * Loads the two families the design uses.
 *
 * The artboards pull these from Google Fonts over the network; a React Native
 * app has to bundle them, so the weights are enumerated here and referenced by
 * these exact names in `theme.font`.
 *
 * Lives in `adapters/` because it is the only thing that touches `expo-font` —
 * the same rule that keeps `expo-camera` out of the screens. ESLint enforces it.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  return loaded;
}
