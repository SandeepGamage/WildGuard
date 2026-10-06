/**
 * Verifies the translation files:
 *  1. si.json and ta.json have exactly the same keys as en.json;
 *  2. every statically referenced t('...') key in src/ exists in en.json.
 * Run with: npm run check:i18n
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, 'src/i18n', `${name}.json`), 'utf8'));

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(full) ? [full] : [];
  });
}

const english = new Set(flatten(load('en')));
let failures = 0;

for (const language of ['si', 'ta']) {
  const keys = new Set(flatten(load(language)));
  const missing = [...english].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !english.has(key));
  if (missing.length || extra.length) {
    failures += 1;
    console.error(`${language}.json: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  }
}

const used = new Set();
const pattern = /\bt\(\s*'([A-Za-z0-9_.]+)'/g;
const keyPattern =
  /(?:labelKey|titleKey|bodyKey|title|body|message)\s*:\s*'([a-z][A-Za-z0-9]*\.[A-Za-z0-9_.]+)'/g;
for (const file of sourceFiles(path.join(root, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(pattern)) used.add(match[1]);
  for (const match of text.matchAll(keyPattern)) used.add(match[1]);
}

const unknown = [...used].filter((key) => !english.has(key));
if (unknown.length) {
  failures += 1;
  console.error(`Keys used in code but missing from en.json:\n  ${unknown.join('\n  ')}`);
}

if (failures === 0) console.log(`Translations OK (${english.size} keys, ${used.size} referenced in code).`);
process.exit(failures === 0 ? 0 : 1);
