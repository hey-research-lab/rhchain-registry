import { CAIP2, CHAIN_ID, CHAIN_NAME } from './chain.js';
import {
  type AddressIndex,
  type AddressIndexRecord,
  type RegistryDocument,
  type RegistryEntry,
  SCHEMA_VERSION,
} from './schema.js';
import { canonicalJson } from './validate.js';

export type BuildArtifacts = {
  registry: RegistryDocument;
  addresses: AddressIndex;
};

/**
 * The two published artifacts, deterministic for a given set of entries (no timestamps), so CI
 * can rebuild them and fail when the committed copies are stale.
 *
 * - `registry.json`: every entry, normalised, sorted by type then id.
 * - `addresses.json`: lowercase address → `{ id, type, role, name? }`, keys sorted.
 */
export function buildArtifacts(entries: readonly RegistryEntry[]): BuildArtifacts {
  const registry: RegistryDocument = {
    schemaVersion: SCHEMA_VERSION,
    chain: { name: CHAIN_NAME, chainId: CHAIN_ID, caip2: CAIP2 },
    entryCount: entries.length,
    contractCount: entries.reduce((sum, entry) => sum + entry.contracts.length, 0),
    entries: [...entries],
  };

  const records: [string, AddressIndexRecord][] = [];
  for (const entry of entries) {
    for (const contract of entry.contracts) {
      records.push([
        contract.address.toLowerCase(),
        {
          id: entry.id,
          type: entry.type,
          role: contract.role,
          ...(contract.name !== undefined ? { name: contract.name } : {}),
        },
      ]);
    }
  }
  records.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const addresses: AddressIndex = {
    schemaVersion: SCHEMA_VERSION,
    chainId: CHAIN_ID,
    addresses: Object.fromEntries(records),
  };
  return { registry, addresses };
}

/** The exact bytes written to `dist/registry.json` and `dist/addresses.json`. */
export const serializeArtifacts = (
  artifacts: BuildArtifacts,
): { registry: string; addresses: string } => ({
  registry: canonicalJson(artifacts.registry),
  addresses: canonicalJson(artifacts.addresses),
});
