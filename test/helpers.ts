import { canonicalJson, type RegistryFile } from '../src/validate.js';

/** A valid launchpad entry using documentation-style addresses (0x…01 style). */
export const baseEntry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'example-launchpad',
  name: 'Example Launchpad',
  type: 'launchpad',
  chainId: 4663,
  status: 'unknown',
  contracts: [{ address: '0x0000000000000000000000000000000000000001', role: 'launch-factory' }],
  website: 'https://example.com/',
  sources: ['https://example.com/docs/deployments'],
  addedAt: '2026-10-01',
  ...overrides,
});

export const file = (path: string, value: unknown): RegistryFile => ({
  path,
  text: typeof value === 'string' ? value : canonicalJson(value),
});

export const TODAY = '2026-10-02';
