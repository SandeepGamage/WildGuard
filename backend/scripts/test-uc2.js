const { spawnSync } = require('node:child_process');
const path = require('node:path');

const uc2Tests = [
  'tests/collar.test.js',
];

const uc2CoverageSources = [
  'src/controllers/collar.controller.js',
  'src/services/{collar.service,geofenceEngine}.js',
  'src/validators/collar.validators.js',
];

const extraArgs = process.argv.slice(2);
const hasCoverage = extraArgs.includes('--coverage');

const jestArgs = [...uc2Tests];

if (hasCoverage) {
  jestArgs.push('--coverage');
  for (const src of uc2CoverageSources) {
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
