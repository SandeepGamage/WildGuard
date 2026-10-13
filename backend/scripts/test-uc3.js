const { spawnSync } = require('node:child_process');
const path = require('node:path');

const uc3Tests = [
  'tests/incidents.test.js',
  'tests/officer.test.js',
  'tests/sms.test.js',
];

const uc3CoverageSources = [
  'src/controllers/{incident,officer,sms}.controller.js',
  'src/services/{incident,officer}.service.js',
  'src/services/{duplicateDetector,locationResolver,photo.service}.js',
  'src/services/sms/**',
  'src/validators/{incident,officer,sms}.validators.js',
];

const extraArgs = process.argv.slice(2);
const hasCoverage = extraArgs.includes('--coverage');

const jestArgs = [...uc3Tests];

if (hasCoverage) {
  jestArgs.push('--coverage');
  for (const src of uc3CoverageSources) {
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
