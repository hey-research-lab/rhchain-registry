import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { run } from '../src/cli.js';
import { canonicalJson } from '../src/validate.js';
import { TODAY, baseEntry } from './helpers.js';

const repo = join(import.meta.dirname, '..');

const cli = async (args: string[], cwd = repo) => {
  let stdout = '';
  let stderr = '';
  const code = await run(args, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd,
    today: TODAY,
  });
  return { code, stdout, stderr };
};

const scratch = mkdtempSync(join(tmpdir(), 'rhchain-cli-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('rhchain-registry CLI', () => {
  it('lookup finds a listed address (exit 0) and says what it does not prove', async () => {
    const { code, stdout } = await cli(['lookup', '0x8366A39CC670B4001A1121B8F6A443A643E40951']);
    expect(code).toBe(0);
    expect(stdout).toContain('uniswap-v4');
    expect(stdout).toContain('does not establish who owns a contract');
  });

  it('lookup --json prints one envelope document', async () => {
    const { code, stdout } = await cli([
      'lookup',
      '--json',
      '0x8366a39cc670b4001a1121b8f6a443a643e40951',
    ]);
    expect(code).toBe(0);
    const doc = JSON.parse(stdout) as {
      schema: string;
      ok: boolean;
      chain: { chainId: number };
      data: { entry: { id: string } };
    };
    expect(doc.schema).toBe('rhchain-registry.cli/v1');
    expect(doc.ok).toBe(true);
    expect(doc.chain.chainId).toBe(4663);
    expect(doc.data.entry.id).toBe('uniswap-v4');
  });

  it('lookup exits 4 when not listed, 2 on a malformed address or another chain', async () => {
    expect((await cli(['lookup', '0x0000000000000000000000000000000000000001'])).code).toBe(4);
    expect((await cli(['lookup', '0x12'])).code).toBe(2);
    const other = await cli([
      'lookup',
      '--json',
      'eip155:8453:0x8366a39cc670b4001a1121b8f6a443a643e40951',
    ]);
    expect(other.code).toBe(2);
    expect((JSON.parse(other.stdout) as { error: { code: string } }).error.code).toBe(
      'unsupported_chain',
    );
  });

  it('get and list', async () => {
    expect((await cli(['get', 'permit2'])).code).toBe(0);
    expect((await cli(['get', 'nope'])).code).toBe(4);
    const listed = await cli(['list', 'dex']);
    expect(listed.code).toBe(0);
    expect(listed.stdout).toContain('uniswap-v2');
    expect((await cli(['list', 'wallet'])).code).toBe(2);
  });

  it('validate passes on the committed registry and fails on a bad tree', async () => {
    expect((await cli(['validate', '--quiet'])).code).toBe(0);
    mkdirSync(join(scratch, 'launchpads'), { recursive: true });
    writeFileSync(
      join(scratch, 'launchpads/example-launchpad.json'),
      canonicalJson(baseEntry({ chainId: 1 })),
    );
    const bad = await cli(['validate', scratch]);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('unsupported_chain');
    const json = await cli(['validate', '--json', scratch]);
    expect((JSON.parse(json.stdout) as { ok: boolean }).ok).toBe(false);
  });

  it('usage errors exit 2; --help and --version exit 0', async () => {
    expect((await cli([])).code).toBe(2);
    expect((await cli(['frobnicate'])).code).toBe(2);
    expect((await cli(['--bogus'])).code).toBe(2);
    expect((await cli(['--help'])).code).toBe(0);
    const version = await cli(['--version']);
    expect(version.code).toBe(0);
    expect(version.stdout.trim()).toBe('0.1.0');
  });
});
