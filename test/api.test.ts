import { describe, expect, it } from 'vitest';

import {
  CHAIN_ID,
  ENTRY_TYPES,
  findByAddress,
  getEntry,
  list,
  parseAddressInput,
  registry,
  toChecksumAddress,
} from '../src/index.js';

const V3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa';

describe('library API', () => {
  it('exposes the registry document for Robinhood Chain only', () => {
    expect(registry.schemaVersion).toBe(1);
    expect(registry.chain).toEqual({
      name: 'Robinhood Chain',
      chainId: 4663,
      caip2: 'eip155:4663',
    });
    expect(registry.entryCount).toBe(registry.entries.length);
    expect(CHAIN_ID).toBe(4663);
  });

  it('getEntry returns an entry by id, or undefined', () => {
    expect(getEntry('uniswap-v3')?.type).toBe('dex');
    expect(getEntry('no-such-entry')).toBeUndefined();
  });

  it('list returns everything or one type, and throws on an unknown type', () => {
    expect(list()).toHaveLength(registry.entryCount);
    for (const type of ENTRY_TYPES) for (const entry of list(type)) expect(entry.type).toBe(type);
    expect(list('dex').map((entry) => entry.id)).toEqual([
      'uniswap-v2',
      'uniswap-v3',
      'uniswap-v4',
    ]);
    expect(() => list('wallet' as never)).toThrow(TypeError);
  });

  it('findByAddress matches in any case and through CAIP-10', () => {
    const match = findByAddress(toChecksumAddress(V3_FACTORY));
    expect(match?.entry.id).toBe('uniswap-v3');
    expect(match?.contract.role).toBe('factory');
    expect(findByAddress(V3_FACTORY.toUpperCase().replace('0X', '0x'))?.entry.id).toBe(
      'uniswap-v3',
    );
    expect(findByAddress(`eip155:4663:${V3_FACTORY}`)?.entry.id).toBe('uniswap-v3');
    expect(findByAddress(V3_FACTORY, 4663)?.entry.id).toBe('uniswap-v3');
  });

  it('answers undefined for an address the registry does not list', () => {
    expect(findByAddress('0x0000000000000000000000000000000000000001')).toBeUndefined();
  });

  it('rejects other chains with unsupported_chain', () => {
    expect(() => findByAddress(`eip155:1:${V3_FACTORY}`)).toThrow(
      expect.objectContaining({ code: 'unsupported_chain' }),
    );
    expect(() => findByAddress(V3_FACTORY, 1)).toThrow(
      expect.objectContaining({ code: 'unsupported_chain' }),
    );
    expect(() => findByAddress(`eip155:04663:${V3_FACTORY}`)).toThrow(
      expect.objectContaining({ code: 'unsupported_chain' }),
    );
  });

  it('rejects malformed addresses with invalid_address', () => {
    expect(() => findByAddress('0x1234')).toThrow(
      expect.objectContaining({ code: 'invalid_address' }),
    );
    expect(() => findByAddress('uniswap')).toThrow(
      expect.objectContaining({ code: 'invalid_address' }),
    );
  });

  it('normalises a 0X prefix in input', () => {
    expect(parseAddressInput(`0X${V3_FACTORY.slice(2)}`)).toBe(V3_FACTORY);
  });

  it('computes EIP-55 checksums (EIP-55 test vector)', () => {
    expect(toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
  });
});
