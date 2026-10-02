import { CHAIN_ID, UnsupportedChainError, assertChainId } from './chain.js';
import {
  type RegistryContract,
  ENTRY_TYPES,
  type EntryType,
  type RegistryEntry,
} from './schema.js';
import { registry } from './data.js';
import { isAddress } from './evm.js';

export { registry };
export * from './chain.js';
export * from './evm.js';
export { toChecksumAddress, isValidChecksum, hasChecksumCase } from './checksum.js';
export * from './schema.js';
export { ISSUE_CODES, type IssueCode, type RegistryIssue } from './issues.js';
export {
  validateRegistryFiles,
  normaliseEntry,
  canonicalJson,
  countByCode,
  type RegistryFile,
  type ValidateOptions,
  type ValidationResult,
} from './validate.js';
export { buildArtifacts, serializeArtifacts, type BuildArtifacts } from './build.js';
export { checkAuthoredUrl, checkStoredUrl, type UrlCheck } from './url.js';
export {
  FORBIDDEN_WORDING,
  findAllForbiddenWording,
  findForbiddenWording,
  hasUnsafeText,
} from './text.js';

const byId = new Map<string, RegistryEntry>(registry.entries.map((entry) => [entry.id, entry]));
const byAddress = new Map<string, { entry: RegistryEntry; contract: RegistryContract }>();
for (const entry of registry.entries) {
  for (const contract of entry.contracts) byAddress.set(contract.address, { entry, contract });
}

export type AddressMatch = { entry: RegistryEntry; contract: RegistryContract };

/** The entry with this id, or `undefined`. */
export function getEntry(id: string): RegistryEntry | undefined {
  return byId.get(id);
}

/**
 * Every entry, or the entries of one type, sorted by type then id. An unknown type throws a
 * `TypeError` rather than answering "none".
 */
export function list(type?: EntryType): readonly RegistryEntry[] {
  if (type === undefined) return registry.entries;
  if (!(ENTRY_TYPES as readonly string[]).includes(type)) {
    throw new TypeError(
      `Unknown registry type "${String(type)}". Known: ${ENTRY_TYPES.join(', ')}.`,
    );
  }
  return registry.entries.filter((entry) => entry.type === type);
}

/**
 * Parse an address argument: a bare address in either case, or a CAIP-10 account id
 * (`eip155:4663:0x…`). Another chain throws `UnsupportedChainError` (`unsupported_chain`); a
 * malformed value throws an error with code `invalid_address`.
 */
export function parseAddressInput(input: string, chainId?: number): string {
  if (chainId !== undefined) assertChainId(chainId);
  let value = input.trim();
  const caip = /^eip155:([^:]*):(.*)$/.exec(value);
  if (caip) {
    if (caip[1] !== String(CHAIN_ID)) throw new UnsupportedChainError(caip[1]);
    value = caip[2] as string;
  }
  if (/^0X/.test(value)) value = `0x${value.slice(2)}`;
  if (!isAddress(value)) {
    throw Object.assign(new Error(`not an EVM address: ${JSON.stringify(input).slice(0, 80)}`), {
      code: 'invalid_address',
    });
  }
  return value.toLowerCase();
}

/**
 * The entry and contract that list this address on Robinhood Chain, or `undefined` when the
 * registry does not list it. Absence means only that this registry has no entry for it — not
 * that the contract is unknown, unused or anything else.
 */
export function findByAddress(address: string, chainId?: number): AddressMatch | undefined {
  return byAddress.get(parseAddressInput(address, chainId));
}
