import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadRegistryTree } from '../src/fs.js';
import { canonicalJson } from '../src/validate.js';
import { baseEntry } from './helpers.js';

const dirs: string[] = [];
const tempRegistry = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rhchain-registry-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadRegistryTree', () => {
  it('reads type folders and their files', () => {
    const dir = tempRegistry();
    mkdirSync(join(dir, 'launchpads'));
    writeFileSync(join(dir, 'launchpads/example-launchpad.json'), canonicalJson(baseEntry()));
    const tree = loadRegistryTree(dir);
    expect(tree.issues).toEqual([]);
    expect(tree.files.map((item) => item.path)).toEqual(['launchpads/example-launchpad.json']);
  });

  it('reports symlinks without following them', () => {
    const dir = tempRegistry();
    mkdirSync(join(dir, 'launchpads'));
    const outside = tempRegistry();
    writeFileSync(join(outside, 'secret.json'), '{}');
    symlinkSync(join(outside, 'secret.json'), join(dir, 'launchpads/link.json'));
    symlinkSync(outside, join(dir, 'dexes'));
    const tree = loadRegistryTree(dir);
    expect(tree.issues.map((found) => [found.code, found.file])).toEqual([
      ['symlink_not_allowed', 'dexes'],
      ['symlink_not_allowed', 'launchpads/link.json'],
    ]);
    expect(tree.files).toEqual([]);
  });

  it('reports unknown and nested folders and oversized files without reading them', () => {
    const dir = tempRegistry();
    mkdirSync(join(dir, 'wallets'));
    mkdirSync(join(dir, 'dexes/deeper'), { recursive: true });
    writeFileSync(join(dir, 'dexes/big.json'), ' '.repeat(70 * 1024));
    const tree = loadRegistryTree(dir);
    expect(tree.issues.map((found) => [found.code, found.file])).toEqual([
      ['file_too_large', 'dexes/big.json'],
      ['nested_directory', 'dexes/deeper'],
      ['unknown_type_folder', 'wallets'],
    ]);
  });
});
