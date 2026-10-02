import { describe, expect, it } from 'vitest';

import type { IssueCode } from '../src/issues.js';
import { validateRegistryFiles } from '../src/validate.js';
import { TODAY, baseEntry, file } from './helpers.js';

const codesOf = (files: Parameters<typeof validateRegistryFiles>[0]): IssueCode[] =>
  validateRegistryFiles(files, { today: TODAY }).issues.map((found) => found.code);

const one = (overrides: Record<string, unknown>, path = 'launchpads/example-launchpad.json') =>
  codesOf([file(path, baseEntry(overrides))]);

describe('validateRegistryFiles — valid input', () => {
  it('accepts a valid entry and publishes it normalised', () => {
    const result = validateRegistryFiles(
      [
        file(
          'launchpads/example-launchpad.json',
          baseEntry({
            $schema: '../../schema/registry-entry.v1.json',
            contracts: [
              {
                address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
                role: 'launch-factory',
                name: 'LAUNCH_FACTORY',
                version: 'v2 (current)',
                deployedBlock: 123,
                creationTx: `0x${'AB'.repeat(32)}`,
              },
            ],
            notes: 'Listed in the project documentation.',
          }),
        ),
        file('explorers/example-explorer.json', {
          ...baseEntry({ id: 'example-explorer', type: 'explorer', contracts: [] }),
        }),
        file('launchpads/.gitkeep', ''),
      ],
      { today: TODAY },
    );
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.entries.map((entry) => entry.id)).toEqual([
      'example-launchpad',
      'example-explorer',
    ]);
    const [launchpad] = result.entries;
    expect(launchpad).not.toHaveProperty('$schema');
    expect(launchpad?.contracts[0]?.address).toBe('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
    expect(launchpad?.contracts[0]?.creationTx).toBe(`0x${'ab'.repeat(32)}`);
    expect(Object.keys(launchpad ?? {})).toEqual([
      'id',
      'name',
      'type',
      'chainId',
      'status',
      'contracts',
      'website',
      'sources',
      'notes',
      'addedAt',
    ]);
  });

  it('accepts all-uppercase and all-lowercase addresses without a checksum', () => {
    expect(
      one({
        contracts: [{ address: '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED', role: 'factory' }],
      }),
    ).toEqual([]);
    expect(
      one({
        contracts: [{ address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', role: 'factory' }],
      }),
    ).toEqual([]);
  });
});

describe('validateRegistryFiles — layout', () => {
  it('refuses unknown type folders, stray files, nested folders and misnamed files', () => {
    expect(codesOf([file('wallets/x.json', baseEntry())])).toEqual(['unknown_type_folder']);
    expect(codesOf([file('__proto__/x.json', baseEntry())])).toEqual(['unknown_type_folder']);
    expect(codesOf([file('README.md', '# hi')])).toEqual(['unexpected_file']);
    expect(codesOf([file('launchpads/notes.txt', 'x')])).toEqual(['unexpected_file']);
    expect(codesOf([file('launchpads/sub/example-launchpad.json', baseEntry())])).toEqual([
      'nested_directory',
    ]);
    expect(one({}, 'launchpads/other-name.json')).toEqual(['file_name_mismatch']);
    expect(one({}, 'dexes/example-launchpad.json')).toEqual(['type_folder_mismatch']);
  });

  it('refuses oversized files', () => {
    expect(codesOf([file('launchpads/example-launchpad.json', ' '.repeat(70 * 1024))])).toEqual([
      'file_too_large',
    ]);
  });
});

describe('validateRegistryFiles — parsing', () => {
  it('refuses invalid JSON, non-objects and non-canonical formatting', () => {
    expect(codesOf([file('launchpads/a.json', '{nope')])).toEqual(['invalid_json']);
    expect(codesOf([file('launchpads/a.json', '[]\n')])).toEqual(['schema_violation']);
    expect(
      codesOf([file('launchpads/example-launchpad.json', JSON.stringify(baseEntry()))]),
    ).toEqual(['non_canonical_json']);
  });

  it('catches a duplicated key that JSON.parse would silently collapse', () => {
    const text = JSON.stringify(baseEntry(), null, 2).replace(
      '"chainId": 4663,',
      '"chainId": 1,\n  "chainId": 4663,',
    );
    expect(codesOf([file('launchpads/example-launchpad.json', `${text}\n`)])).toEqual([
      'non_canonical_json',
    ]);
  });

  it('refuses prototype-pollution keys anywhere', () => {
    const text = (inner: string) => `{\n  "id": "a",\n  ${inner}\n}\n`;
    expect(codesOf([file('launchpads/a.json', text('"__proto__": {"x": 1}'))])).toEqual([
      'forbidden_key',
    ]);
    expect(codesOf([file('launchpads/a.json', text('"contracts": [{"constructor": 1}]'))])).toEqual(
      ['forbidden_key'],
    );
    expect(codesOf([file('launchpads/a.json', text('"prototype": 1'))])).toEqual(['forbidden_key']);
  });

  it('refuses unknown keys at the top level and on contracts', () => {
    expect(one({ verified: true })).toEqual(['unknown_key']);
    expect(
      one({
        contracts: [
          { address: '0x0000000000000000000000000000000000000001', role: 'factory', owner: 'x' },
        ],
      }),
    ).toEqual(['unknown_key']);
  });

  it('refuses a bad status, type, id, role and an unknown $schema', () => {
    expect(one({ status: 'live' })).toEqual(['schema_violation']);
    expect(one({ role: 'x' })).toEqual(['unknown_key']);
    expect(one({ $schema: 'https://example.com/other.json' })).toEqual(['schema_violation']);
    expect(
      one({
        contracts: [{ address: '0x0000000000000000000000000000000000000001', role: 'owner' }],
      }),
    ).toEqual(['schema_violation']);
    expect(codesOf([file('launchpads/Bad_Id.json', baseEntry({ id: 'Bad_Id' }))])).toEqual([
      'schema_violation',
    ]);
    expect(codesOf([file('wallets/x.json', baseEntry({ type: 'wallet' }))])).toEqual([
      'unknown_type_folder',
    ]);
  });
});

describe('validateRegistryFiles — chain and identity', () => {
  it('refuses any chain other than 4663 as unsupported_chain', () => {
    for (const chainId of [1, 46630, '4663', 4663.5, null]) {
      expect(one({ chainId })).toEqual(['unsupported_chain']);
    }
    const [found] = validateRegistryFiles([
      file('launchpads/example-launchpad.json', baseEntry({ chainId: 8453 })),
    ]).issues;
    expect(found?.message).toBe(
      'HEY supports Robinhood Chain (4663) only; chain 8453 is not supported.',
    );
    expect(found?.pointer).toBe('/chainId');
  });

  it('refuses duplicate ids across folders', () => {
    expect(
      codesOf([
        file('launchpads/example-launchpad.json', baseEntry()),
        file(
          'factories/example-launchpad.json',
          baseEntry({
            type: 'factory',
            contracts: [{ address: '0x0000000000000000000000000000000000000002', role: 'factory' }],
          }),
        ),
      ]),
    ).toEqual(['duplicate_id']);
  });
});

describe('validateRegistryFiles — contracts', () => {
  const contract = (address: string, extra: Record<string, unknown> = {}) => ({
    address,
    role: 'factory',
    ...extra,
  });

  it('refuses malformed addresses, including the 0X prefix', () => {
    for (const address of [
      '0x123',
      '0X0000000000000000000000000000000000000001',
      'not-an-address',
      `0x${'g'.repeat(40)}`,
    ]) {
      expect(one({ contracts: [contract(address)] })).toEqual(['invalid_address']);
    }
  });

  it('refuses a mixed-case address with a wrong checksum', () => {
    expect(one({ contracts: [contract('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD')] })).toEqual([
      'invalid_checksum',
    ]);
  });

  it('refuses the zero and dead addresses as contract identities', () => {
    expect(one({ contracts: [contract('0x0000000000000000000000000000000000000000')] })).toEqual([
      'not_a_contract_identity',
    ]);
    expect(one({ contracts: [contract('0x000000000000000000000000000000000000dEaD')] })).toEqual([
      'not_a_contract_identity',
    ]);
  });

  it('refuses duplicate addresses inside an entry and across the registry, case-insensitively', () => {
    expect(
      one({
        contracts: [
          contract('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
          contract('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED'),
        ],
      }),
    ).toEqual(['duplicate_address']);
    const result = validateRegistryFiles(
      [
        file('launchpads/example-launchpad.json', baseEntry()),
        file('dexes/example-dex.json', baseEntry({ id: 'example-dex', type: 'dex' })),
      ],
      { today: TODAY },
    );
    expect(result.issues.map((found) => [found.code, found.file])).toEqual([
      ['duplicate_address', 'launchpads/example-launchpad.json'],
    ]);
    expect(result.entries.map((entry) => entry.id)).toEqual(['example-dex']);
  });

  it('refuses a malformed creation transaction hash', () => {
    expect(
      one({
        contracts: [
          contract('0x0000000000000000000000000000000000000001', { creationTx: '0x1234' }),
        ],
      }),
    ).toEqual(['invalid_tx_hash']);
  });

  it('requires contracts except for explorers and infrastructure', () => {
    expect(one({ contracts: [] })).toEqual(['contracts_required']);
    expect(
      codesOf([
        file(
          'infrastructure/rpc.json',
          baseEntry({ id: 'rpc', type: 'infrastructure', contracts: [] }),
        ),
      ]),
    ).toEqual([]);
  });
});

describe('validateRegistryFiles — provenance and URLs', () => {
  it('requires at least one source', () => {
    expect(one({ sources: [] })).toEqual(['missing_sources']);
    const withoutSources = baseEntry();
    delete withoutSources.sources;
    expect(codesOf([file('launchpads/example-launchpad.json', withoutSources)])).toEqual([
      'missing_sources',
    ]);
  });

  it('refuses duplicate sources', () => {
    expect(one({ sources: ['https://example.com/a', 'https://example.com/a'] })).toEqual([
      'duplicate_source',
    ]);
  });

  const cases: [string, IssueCode][] = [
    ['http://example.com/', 'unsafe_url_scheme'],
    ['javascript:alert(1)', 'unsafe_url_scheme'],
    ['data:text/html,hi', 'unsafe_url_scheme'],
    ['file:///etc/passwd', 'unsafe_url_scheme'],
    ['https://user:pass@example.com/', 'url_credentials'],
    ['https://192.0.2.1/', 'url_ip_literal'],
    ['https://[::1]/', 'url_ip_literal'],
    ['https://2130706433/', 'url_ip_literal'],
    ['https://localhost/', 'url_local_host'],
    ['https://printer.local/', 'url_local_host'],
    ['https://intranet/', 'url_local_host'],
    ['https://xn--exmple-cua.com/', 'url_idn_host'],
    ['https://exämple.com/', 'url_idn_host'],
    [`https://example.com/${'a'.repeat(500)}`, 'url_too_long'],
    ['https://Example.com/', 'url_not_normalised'],
    ['https://example.com', 'url_not_normalised'],
    ['https://example.com:443/', 'url_not_normalised'],
    ['https://example.com/#section', 'url_not_normalised'],
    ['https://example.com/a b', 'invalid_url'],
    ['example.com', 'invalid_url'],
  ];
  it.each(cases)('refuses %s as %s in sources, website and docs', (url, code) => {
    expect(one({ sources: [url] })).toContain(code);
    expect(one({ website: url })).toContain(code);
    expect(one({ docs: url })).toContain(code);
  });
});

describe('validateRegistryFiles — text and dates', () => {
  it('refuses control, bidi and zero-width characters', () => {
    expect(one({ notes: 'Listed in docs‮.' })).toEqual(['unsafe_text']);
    expect(one({ notes: 'zero​width' })).toEqual(['unsafe_text']);
    expect(
      one({
        contracts: [
          {
            address: '0x0000000000000000000000000000000000000001',
            role: 'factory',
            version: 'v1\u0007',
          },
        ],
      }),
    ).toContain('schema_violation');
  });

  it('keeps names to printable ASCII', () => {
    expect(one({ name: 'Exаmple' })).toEqual(['schema_violation']); // Cyrillic a
    expect(one({ name: ' Example' })).toEqual(['schema_violation']);
  });

  it('refuses verdict, endorsement and verification wording', () => {
    for (const notes of [
      'A safe launchpad.',
      'Audited by someone.',
      'HEY verified.',
      'Official Robinhood launchpad.',
      'A partnership.',
    ]) {
      expect(one({ notes })).toEqual(['forbidden_wording']);
    }
    expect(one({ name: 'Scam Finder' })).toEqual(['forbidden_wording']);
    expect(one({ notes: 'Sourcify holds a verified source for it.' })).toEqual([]);
  });

  it('refuses impossible and future dates', () => {
    expect(one({ addedAt: '2026-02-30' })).toEqual(['invalid_date']);
    expect(one({ addedAt: '2026-10-03' })).toEqual(['date_in_future']);
    expect(one({ addedAt: '02-10-2026' })).toEqual(['schema_violation']);
  });
});
