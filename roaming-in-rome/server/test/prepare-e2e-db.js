// Ensures the e2e test database has the current schema before the suite runs.
// Honors DATABASE_URL if set (CI), otherwise defaults to the local test DB —
// the same default used by test/setup-e2e.ts.
const { execSync } = require('node:child_process');

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://rome:rome_dev_pw@localhost:5432/roaming_in_rome_test?schema=public';

execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
