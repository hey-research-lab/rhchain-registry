import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import { buildArtifacts, serializeArtifacts } from '../src/build.js';
import { loadRegistryTree } from '../src/fs.js';
import { ENTRY_SCHEMA_ID, TYPE_FOLDERS } from '../src/schema.js';
import { validateRegistryFiles } from '../src/validate.js';
import { TODAY, baseEntry } from './helpers.js';

const root = join(import.meta.dirname, '..');
const tree = loadRegistryTree(join(root, 'registry'));
// Real today: an entry dated in the future must fail here as it fails in CI.
const result = validateRegistryFiles(tree.files, { today: new Date().toISOString().slice(0, 10) });

describe('the committed registry', () => {
  it('validates with no findings', () => {
    expect(tree.issues).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('has one folder per type and nothing else', () => {
    const folders = new Set(tree.files.map((item) => item.path.split('/')[0]));
    for (const folder of folders) expect(Object.values(TYPE_FOLDERS)).toContain(folder);
  });

  it('cites at least one https source for every entry, and lists only chain 4663', () => {
    for (const entry of result.entries) {
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) expect(source.startsWith('https://')).toBe(true);
      expect(entry.chainId).toBe(4663);
    }
  });

  it('ships dist/registry.json and dist/addresses.json exactly as a fresh build writes them', () => {
    const out = serializeArtifacts(buildArtifacts(result.entries));
    expect(readFileSync(join(root, 'dist/registry.json'), 'utf8')).toBe(out.registry);
    expect(readFileSync(join(root, 'dist/addresses.json'), 'utf8')).toBe(out.addresses);
  });

  it('indexes every contract address exactly once, in lowercase', () => {
    const { addresses, registry } = buildArtifacts(result.entries);
    const keys = Object.keys(addresses.addresses);
    expect(keys.length).toBe(registry.contractCount);
    for (const key of keys) expect(key).toBe(key.toLowerCase());
    expect([...keys].sort()).toEqual(keys);
  });

  it('never says HEY verified, endorsed or audited anything', () => {
    const text = JSON.stringify(result.entries).toLowerCase();
    for (const phrase of [
      'verified builder',
      'hey verified',
      'endorse',
      'audited',
      'official robinhood',
    ]) {
      expect(text).not.toContain(phrase);
    }
  });
});

describe('the JSON Schema agrees with the zod schema', () => {
  const schema = JSON.parse(readFileSync(join(root, 'schema/registry-entry.v1.json'), 'utf8')) as {
    $id: string;
  };
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validate = ajv.compile(schema);

  it('has the published $id', () => {
    expect(schema.$id).toBe(ENTRY_SCHEMA_ID);
  });

  it('accepts every committed entry file', () => {
    for (const item of tree.files) {
      if (!item.path.endsWith('.json')) continue;
      expect(
        validate(JSON.parse(item.text)),
        `${item.path}: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });

  it.each([
    ['other chain', { chainId: 1 }],
    ['unknown key', { owner: 'x' }],
    ['no sources', { sources: [] }],
    ['bad status', { status: 'live' }],
    ['bad id', { id: 'Bad_Id' }],
    ['bad address', { contracts: [{ address: '0x12', role: 'factory' }] }],
    [
      'bad role',
      { contracts: [{ address: '0x0000000000000000000000000000000000000001', role: 'owner' }] },
    ],
    ['http source', { sources: ['http://example.com/'] }],
    ['non-ASCII name', { name: 'Exаmple' }],
  ])('rejects %s like the validator does', (_label, overrides) => {
    const entry = baseEntry(overrides);
    expect(validate(entry)).toBe(false);
    const own = validateRegistryFiles(
      [{ path: 'launchpads/example-launchpad.json', text: `${JSON.stringify(entry, null, 2)}\n` }],
      {
        today: TODAY,
      },
    );
    expect(own.ok).toBe(false);
  });

  it('accepts the valid base entry', () => {
    expect(validate(baseEntry())).toBe(true);
  });
});
