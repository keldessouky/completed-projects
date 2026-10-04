import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // A starter that forgets to handle a failing request (which is the bug
    // its level teaches) leaves a rejection unhandled. Those are expected;
    // anything else is still reported.
    onUnhandledError: (error) => ((error as { levelFixture?: boolean } | null)?.levelFixture ? false : undefined),
  },
});
