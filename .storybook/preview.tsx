import type { Preview } from '@storybook/react-native-web-vite';

/**
 * Web Storybook preview config.
 *
 * ⚠️ NO PROVIDER WRAPPER, DELIBERATELY. Every component with a story here
 * imports `@/theme` and nothing else — no `useLocale()`, no settings, no
 * ports. Wrapping them in providers they do not use would make the stories
 * depend on context that can break for reasons unrelated to the component,
 * and a Chromatic diff caused by a provider is a diff nobody can act on.
 *
 * If a story is ever added for something that does need context — anything
 * under `src/screens/`, or `PermissionGate` — wrap THAT story with its own
 * decorator rather than adding a global one here.
 */
const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        // The app's two surfaces, so a component is checked against the
        // background it actually sits on rather than Storybook's default grey.
        ink: { name: 'ink', value: '#101820' },
        surface: { name: 'surface', value: '#ffffff' },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'surface' },
  },
};

export default preview;
