const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const jest = require('eslint-plugin-jest');
const testingLibrary = require('eslint-plugin-testing-library');
const jsdoc = require('eslint-plugin-jsdoc');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'coverage/**',
      'reports/**',
      '.stryker-tmp/**',
      'design/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      jsdoc.configs['flat/recommended-typescript-error'],
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-native': reactNative },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react-native/no-unused-styles': 'error',
      'react-native/no-inline-styles': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      // JSDoc is required on the exported surface, not on everything.
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
        },
      ],
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
    },
  },

  // The one place `expo-*` and other third-party libraries may be imported.
  {
    files: ['src/adapters/**/*.ts', 'src/components/TorchHost/*.tsx'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      // An adapter satisfies an async port contract whether or not its own
      // body happens to await something.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Adapters are the ONLY importers of expo-* / third-party native libraries
  // (FOUNDATION.md section 1). Documenting that is not enforcing it — without this
  // rule a screen could import expo-camera directly and nothing would complain.
  // TorchHost is the one sanctioned exception: expo-camera's torch needs a mounted
  // CameraView, so the component owns it and the adapter drives it.
  {
    files: [
      'src/screens/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/application/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
    ],
    ignores: ['src/components/TorchHost/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['expo-*', '@react-native-firebase/*'],
              message:
                'Only src/adapters/** may import expo-* or @react-native-firebase/*. Put the dependency behind a port and inject it.',
            },
          ],
        },
      ],
    },
  },

  // The domain must stay pure: no React, no Expo, no I/O.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'expo',
                'expo-*',
                '@react-native-firebase/*',
                '@/adapters/*',
              ],
              message:
                'core/ must stay pure — no React, no Expo, no vendor SDKs, no adapters. Put the dependency behind a port instead.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/testing/**/*.{ts,tsx}'],
    plugins: { jest, 'testing-library': testingLibrary },
    languageOptions: { globals: { ...jest.environments.globals.globals } },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      ...testingLibrary.configs['flat/react'].rules,
      'jsdoc/require-jsdoc': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Fakes and stubs satisfy async interfaces without awaiting anything.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // Plain CommonJS config files: no type information, so no typed rules.
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    rules: { ...tseslint.configs.disableTypeChecked.rules },
  },

  prettier,
);
