const { spawnSync } = require('node:child_process');
const path = require('node:path');

const uc4Tests = [
  'tests/analytics.test.js',
  'tests/analytics.units.test.js',
];

const uc4CoverageSources = [
  'src/controllers/analytics.controller.js',
  'src/services/{analytics,analyticsReport,gisMapping}.service.js',
  'src/services/export/**',
  'src/validators/analytics.validators.js',
  'src/models/conservationReport.model.js',
  'src/repositories/sources/**',
  // Only loaded by the MongoDB wiring; the tests use in-memory repositories.
  '!src/repositories/sources/patrolTrackPointSource.js',
];

const extraArgs = process.argv.slice(2);
const hasCoverage = extraArgs.includes('--coverage');

const jestArgs = [...uc4Tests];

if (hasCoverage) {
  jestArgs.push('--coverage');
  for (const src of uc4CoverageSources) {
    jestArgs.push(`--collectCoverageFrom=${src}`);
  }
}

for (const arg of extraArgs) {
  if (arg !== '--coverage' && !jestArgs.includes(arg)) {
    jestArgs.push(arg);
  }
}

const isWindows = process.platform === 'win32';
const jestCmd = isWindows ? 'npx.cmd' : 'npx';

const result = spawnSync(jestCmd, ['jest', ...jestArgs], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status ?? 0);
