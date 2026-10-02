/**
 * Validate `registry/` and write the two published artifacts.
 *
 *   tsx scripts/build-data.ts                  validate, then write dist/registry.json + dist/addresses.json
 *   tsx scripts/build-data.ts --check          validate, then fail if the committed artifacts are stale
 *   tsx scripts/build-data.ts --validate-only  validate only
 *   tsx scripts/build-data.ts --format         rewrite entry files in canonical form, then validate
 *
 * Writes only inside this repository's dist/ (and registry/ with --format). Never fetches.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildArtifacts, serializeArtifacts } from '../src/build.js';
import { loadRegistryTree } from '../src/fs.js';
import { canonicalJson, validateRegistryFiles } from '../src/validate.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryDir = join(repo, 'registry');
const distDir = join(repo, 'dist');
const mode = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--validate-only')
    ? 'validate'
    : process.argv.includes('--format')
      ? 'format'
      : 'build';

if (mode === 'format') {
  const { files } = loadRegistryTree(registryDir);
  let changed = 0;
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    let value: unknown;
    try {
      value = JSON.parse(file.text);
    } catch {
      continue; // validation reports it
    }
    const text = canonicalJson(value);
    if (text !== file.text) {
      writeFileSync(join(registryDir, ...file.path.split('/')), text);
      changed += 1;
    }
  }
  console.log(`formatted ${changed} file(s)`);
}

const tree = loadRegistryTree(registryDir);
const result = validateRegistryFiles(tree.files, { today: new Date().toISOString().slice(0, 10) });
const issues = [...tree.issues, ...result.issues];
if (issues.length > 0) {
  for (const found of issues) {
    console.error(
      `${found.code}: registry/${found.file}${found.pointer ? ` ${found.pointer}` : ''} — ${found.message}`,
    );
  }
  console.error(`\n${issues.length} problem(s) in registry/.`);
  process.exit(1);
}

const out = serializeArtifacts(buildArtifacts(result.entries));
const summary = `${result.entries.length} entries, ${Object.keys(JSON.parse(out.addresses).addresses).length} addresses`;

if (mode === 'validate' || mode === 'format') {
  console.log(`registry valid: ${summary}`);
} else if (mode === 'check') {
  const stale = (['registry', 'addresses'] as const).filter((name) => {
    const path = join(distDir, `${name}.json`);
    return !existsSync(path) || readFileSync(path, 'utf8') !== out[name];
  });
  if (stale.length > 0) {
    console.error(
      `stale build artifacts: ${stale.map((name) => `dist/${name}.json`).join(', ')}. Run \`pnpm build\` and commit them.`,
    );
    process.exit(1);
  }
  console.log(`build artifacts fresh: ${summary}`);
} else {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'registry.json'), out.registry);
  writeFileSync(join(distDir, 'addresses.json'), out.addresses);
  console.log(`wrote dist/registry.json and dist/addresses.json: ${summary}`);
}
