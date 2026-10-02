import { z } from 'zod';

import { CAIP2, CHAIN_ID, CHAIN_NAME } from './chain.js';
import { ADDRESS_RE, TX_HASH_RE } from './evm.js';

/** Registry document schema version (independent of the package version). */
export const SCHEMA_VERSION = 1 as const;

/** The `$schema` value an entry may carry so editors can validate it while it is written. */
export const ENTRY_SCHEMA_REF = '../../schema/registry-entry.v1.json' as const;

/** Published `$id` of the entry JSON Schema (served from this repository until HEY serves it). */
export const ENTRY_SCHEMA_ID =
  'https://raw.githubusercontent.com/hey-research-lab/rhchain-registry/main/schema/registry-entry.v1.json' as const;

/**
 * Entry types and the folder each lives in, in the order the built registry lists them.
 * A folder that is not here fails validation (`unknown_type_folder`).
 */
export const TYPE_FOLDERS = {
  factory: 'factories',
  dex: 'dexes',
  launchpad: 'launchpads',
  bridge: 'bridges',
  oracle: 'oracles',
  explorer: 'explorers',
  locker: 'lockers',
  protocol: 'protocols',
  infrastructure: 'infrastructure',
} as const;

export type EntryType = keyof typeof TYPE_FOLDERS;
export type TypeFolder = (typeof TYPE_FOLDERS)[EntryType];

export const ENTRY_TYPES = Object.keys(TYPE_FOLDERS) as readonly EntryType[];

export const FOLDER_TYPES: Readonly<Record<string, EntryType>> = Object.fromEntries(
  ENTRY_TYPES.map((type) => [TYPE_FOLDERS[type], type]),
);

/** Types whose entries may list no contract (an explorer or an RPC endpoint is not a contract). */
export const TYPES_WITHOUT_CONTRACTS: readonly EntryType[] = ['explorer', 'infrastructure'];

/**
 * What a contract does inside its entry, as its sources describe it. A role is a description
 * of infrastructure, never a statement about who controls the contract.
 */
export const CONTRACT_ROLES = [
  'factory',
  'launch-factory',
  'auction-factory',
  'router',
  'pool-manager',
  'position-manager',
  'position-descriptor',
  'quoter',
  'lens',
  'multicall',
  'library',
  'strategy',
  'permit',
  'locker',
  'bridge',
  'oracle',
  'other',
] as const;
export type ContractRole = (typeof CONTRACT_ROLES)[number];

/** Of the infrastructure entry, by its sources (ecosystem conventions §4.4). */
export const ENTRY_STATUSES = ['active', 'deprecated', 'unknown'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Names are printable ASCII: look-alike Unicode in a name is how a malicious entry hides. */
export const NAME_RE = /^[\x20-\x7e]+$/;
export const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9 _.()+-]*$/;

export const LIMITS = {
  maxIdLength: 64,
  maxNameLength: 80,
  maxLabelLength: 64,
  maxVersionLength: 32,
  maxNotesLength: 1000,
  maxContracts: 50,
  maxSources: 10,
  maxUrlLength: 500,
  maxFileBytes: 64 * 1024,
  maxFiles: 2000,
} as const;

const trimmed = (value: string): boolean => value === value.trim();

export const ContractSchema = z
  .object({
    address: z.string().regex(ADDRESS_RE, 'expected a 0x-prefixed 20-byte hex address'),
    role: z.enum(CONTRACT_ROLES),
    name: z
      .string()
      .min(1)
      .max(LIMITS.maxLabelLength)
      .regex(LABEL_RE, 'letters, digits, spaces and _.()+- only')
      .optional(),
    version: z
      .string()
      .min(1)
      .max(LIMITS.maxVersionLength)
      .regex(LABEL_RE, 'letters, digits, spaces and _.()+- only')
      .optional(),
    deployedBlock: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    creationTx: z.string().regex(TX_HASH_RE, 'expected a 0x-prefixed 32-byte hex hash').optional(),
  })
  .strict();

export type RegistryContract = z.infer<typeof ContractSchema>;

/** One authored file under `registry/<folder>/<id>.json`. */
export const EntrySchema = z
  .object({
    $schema: z.literal(ENTRY_SCHEMA_REF).optional(),
    id: z
      .string()
      .min(1)
      .max(LIMITS.maxIdLength)
      .regex(ID_RE, 'kebab-case: a-z, 0-9 and single hyphens'),
    name: z
      .string()
      .min(1)
      .max(LIMITS.maxNameLength)
      .regex(NAME_RE, 'printable ASCII only')
      .refine(trimmed, 'no leading or trailing spaces'),
    type: z.enum(ENTRY_TYPES as [EntryType, ...EntryType[]]),
    chainId: z.literal(CHAIN_ID),
    status: z.enum(ENTRY_STATUSES),
    contracts: z.array(ContractSchema).max(LIMITS.maxContracts),
    website: z.string().max(LIMITS.maxUrlLength).optional(),
    docs: z.string().max(LIMITS.maxUrlLength).optional(),
    sources: z.array(z.string().max(LIMITS.maxUrlLength)).min(1).max(LIMITS.maxSources),
    notes: z
      .string()
      .min(1)
      .max(LIMITS.maxNotesLength)
      .refine(trimmed, 'no leading or trailing spaces')
      .optional(),
    addedAt: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  })
  .strict();

export type RegistryEntryInput = z.infer<typeof EntrySchema>;

/** An entry as the built registry publishes it: lowercase addresses and hashes, no `$schema`. */
export type RegistryEntry = Omit<RegistryEntryInput, '$schema'>;

export const PublishedEntrySchema = EntrySchema.omit({ $schema: true });

export const RegistryDocumentSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    chain: z
      .object({
        name: z.literal(CHAIN_NAME),
        chainId: z.literal(CHAIN_ID),
        caip2: z.literal(CAIP2),
      })
      .strict(),
    entryCount: z.number().int().nonnegative(),
    contractCount: z.number().int().nonnegative(),
    entries: z.array(PublishedEntrySchema),
  })
  .strict();

export type RegistryDocument = {
  schemaVersion: typeof SCHEMA_VERSION;
  chain: { name: typeof CHAIN_NAME; chainId: typeof CHAIN_ID; caip2: typeof CAIP2 };
  entryCount: number;
  contractCount: number;
  entries: RegistryEntry[];
};

export type AddressIndexRecord = {
  id: string;
  type: EntryType;
  role: ContractRole;
  name?: string;
};

export type AddressIndex = {
  schemaVersion: typeof SCHEMA_VERSION;
  chainId: typeof CHAIN_ID;
  addresses: Record<string, AddressIndexRecord>;
};
