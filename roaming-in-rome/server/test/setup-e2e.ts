/**
 * Test-environment defaults. A real DATABASE_URL/JWT_SECRET in the process
 * environment (e.g. in CI) takes precedence; otherwise fall back to the local
 * test database created during setup.
 */
process.env.DATABASE_URL ??=
  'postgresql://rome:rome_dev_pw@localhost:5432/roaming_in_rome_test?schema=public';
process.env.JWT_SECRET ??= 'e2e-test-secret-0123456789abcdef';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.WEB_ORIGIN ??= 'http://localhost:5173';
