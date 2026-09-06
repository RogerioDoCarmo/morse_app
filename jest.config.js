/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.ts',
    '!src/types/**',
    '!src/testing/**',
    // Interface-only modules: no runtime code to cover.
    '!src/core/ports/**',
    '!src/i18n/keys.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Anchored to <rootDir>: Stryker copies the project into .stryker-tmp and runs
  // jest from inside it, so an unanchored '/.stryker-tmp/' would ignore every
  // test in the sandbox and the mutation run would find nothing to execute.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.stryker-tmp/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
};
