/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // ⚠️ `uuid` IS IN THIS LIST TO CLOSE A SECURITY ALERT. Its only patched
  // version (11.1.1) is ESM-only, and jest cannot parse `export` without a
  // transform — the three config-plugin suites failed with
  // "Unexpected token 'export'" until it was added here.
  //
  // ⚠️ Nothing in the app imports uuid. It arrives as
  // `expo/config-plugins` → `xcode` → `uuid`, which runs during `prebuild` on
  // a build machine and never ships in the binary. This entry exists so the
  // dependency can be PATCHED, not because the app gained a dependency.
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|uuid))',
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
    // ⚠️ A subagent's git worktree lives here — a SECOND FULL CHECKOUT of this
    // source, inside the repository. Without this, `pnpm test` collects its
    // copy of every test file as well, and they fail: the worktree has its own
    // node_modules and resolves '@/...' against its own rootDir, not this one.
    '<rootDir>/.claude/',
  ],
};
