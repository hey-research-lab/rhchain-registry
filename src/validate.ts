import type { ZodIssue } from 'zod';

import { UnsupportedChainError } from './chain.js';
import { hasChecksumCase, isValidChecksum } from './checksum.js';
import { DEAD_ADDRESS, ZERO_ADDRESS, isAddress } from './evm.js';
import { type IssueCode, type RegistryIssue, issue } from './issues.js';
import {
  DATE_RE,
  ENTRY_TYPES,
  EntrySchema,
  FOLDER_TYPES,
  LIMITS,
  type EntryType,
  type RegistryContract,
  type RegistryEntry,
  type RegistryEntryInput,
  TYPES_WITHOUT_CONTRACTS,
} from './schema.js';
import { findForbiddenWording, hasUnsafeText } from './text.js';
import { checkStoredUrl } from './url.js';

/** One file of the registry tree, path relative to the registry root with `/` separators. */
export type RegistryFile = { path: string; text: string };

export type ValidateOptions = {
  /** Today as `YYYY-MM-DD` (UTC); an `addedAt` after it is refused. Omit to skip the check. */
  today?: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: RegistryIssue[];
  /** Valid entries, normalised (lowercase addresses) and sorted by type then id. */
  entries: RegistryEntry[];
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const encoder = new TextEncoder();

const escapePointer = (segment: string | number): string =>
  String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
export const toPointer = (path: readonly (string | number)[]): string =>
  path.map((segment) => `/${escapePointer(segment)}`).join('');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function findForbiddenKeys(value: unknown, path: (string | number)[], out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, [...path, index], out));
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) out.push(toPointer([...path, key]));
    else findForbiddenKeys(value[key], [...path, key], out);
  }
}

function mapZodIssue(
  file: string,
  zodIssue: ZodIssue,
  raw: Record<string, unknown>,
): RegistryIssue[] {
  const { path } = zodIssue;
  const pointer = toPointer(path);
  const last = path[path.length - 1];
  if (zodIssue.code === 'unrecognized_keys') {
    return zodIssue.keys.map((key) =>
      issue(
        'unknown_key',
        file,
        `Unknown key "${key}". Entries accept only the documented fields.`,
        toPointer([...path, key]),
      ),
    );
  }
  if (path.length === 1 && path[0] === 'chainId') {
    return [
      issue('unsupported_chain', file, new UnsupportedChainError(raw.chainId).message, pointer),
    ];
  }
  if (path[0] === 'contracts' && last === 'address') {
    return [issue('invalid_address', file, 'Expected a 0x-prefixed 20-byte hex address.', pointer)];
  }
  if (path[0] === 'contracts' && last === 'creationTx') {
    return [
      issue(
        'invalid_tx_hash',
        file,
        'Expected a 0x-prefixed 32-byte hex transaction hash.',
        pointer,
      ),
    ];
  }
  if (
    path.length === 1 &&
    path[0] === 'sources' &&
    (zodIssue.code === 'too_small' || raw.sources === undefined)
  ) {
    return [
      issue(
        'missing_sources',
        file,
        'Every entry needs at least one https source: official docs, a deployments file or an explorer verified-source page.',
        pointer,
      ),
    ];
  }
  return [
    issue(
      'schema_violation',
      file,
      `${pointer || '(root)'}: ${zodIssue.message}`,
      pointer || undefined,
    ),
  ];
}

function checkDate(
  file: string,
  value: unknown,
  options: ValidateOptions,
  out: RegistryIssue[],
): void {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return; // the schema reports the shape
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    out.push(issue('invalid_date', file, `"${value}" is not a calendar date.`, '/addedAt'));
    return;
  }
  if (options.today !== undefined && value > options.today) {
    out.push(
      issue(
        'date_in_future',
        file,
        `addedAt ${value} is after today (${options.today}).`,
        '/addedAt',
      ),
    );
  }
}

function checkText(
  file: string,
  pointer: string,
  value: unknown,
  out: RegistryIssue[],
  wording: boolean,
): void {
  if (typeof value !== 'string') return;
  if (hasUnsafeText(value)) {
    out.push(
      issue(
        'unsafe_text',
        file,
        'Control, bidirectional or zero-width characters are not allowed.',
        pointer,
      ),
    );
  }
  if (wording) {
    const found = findForbiddenWording(value);
    if (found !== null) {
      out.push(
        issue(
          'forbidden_wording',
          file,
          `"${found}" is not registry wording: entries state public facts, never a verdict, endorsement, advice or a verification claim.`,
          pointer,
        ),
      );
    }
  }
}

function checkUrlField(file: string, pointer: string, value: unknown, out: RegistryIssue[]): void {
  if (typeof value !== 'string') return;
  const problem = checkStoredUrl(value);
  if (problem !== null) out.push(issue(problem.code, file, problem.message, pointer));
}

/** Field-level checks that the schema cannot express. Defensive: runs on unvalidated input. */
function checkSemantics(
  file: string,
  raw: Record<string, unknown>,
  options: ValidateOptions,
  out: RegistryIssue[],
): void {
  checkText(file, '/name', raw.name, out, true);
  checkText(file, '/notes', raw.notes, out, true);
  checkUrlField(file, '/website', raw.website, out);
  checkUrlField(file, '/docs', raw.docs, out);
  checkDate(file, raw.addedAt, options, out);

  if (Array.isArray(raw.sources)) {
    const seen = new Map<string, number>();
    raw.sources.forEach((source, index) => {
      const pointer = `/sources/${index}`;
      if (typeof source !== 'string') return;
      checkUrlField(file, pointer, source, out);
      const key = source.toLowerCase();
      const first = seen.get(key);
      if (first !== undefined) {
        out.push(issue('duplicate_source', file, `Same source as /sources/${first}.`, pointer));
      } else seen.set(key, index);
    });
  }

  if (Array.isArray(raw.contracts)) {
    const type = raw.type;
    if (
      raw.contracts.length === 0 &&
      typeof type === 'string' &&
      (ENTRY_TYPES as readonly string[]).includes(type) &&
      !TYPES_WITHOUT_CONTRACTS.includes(type as EntryType)
    ) {
      out.push(
        issue(
          'contracts_required',
          file,
          `A ${type} entry must list at least one contract.`,
          '/contracts',
        ),
      );
    }
    const seen = new Map<string, number>();
    raw.contracts.forEach((contract, index) => {
      if (!isRecord(contract)) return;
      checkText(file, `/contracts/${index}/name`, contract.name, out, true);
      checkText(file, `/contracts/${index}/version`, contract.version, out, false);
      const address = contract.address;
      if (!isAddress(address)) return; // the schema reports the shape
      const pointer = `/contracts/${index}/address`;
      if (hasChecksumCase(address) && !isValidChecksum(address)) {
        out.push(
          issue(
            'invalid_checksum',
            file,
            'Mixed-case address with a wrong EIP-55 checksum. Copy it again from the source, or write it all lowercase.',
            pointer,
          ),
        );
      }
      const lower = address.toLowerCase();
      if (lower === ZERO_ADDRESS || lower === DEAD_ADDRESS) {
        out.push(
          issue(
            'not_a_contract_identity',
            file,
            'The zero and dead addresses are never a contract identity.',
            pointer,
          ),
        );
      }
      const first = seen.get(lower);
      if (first !== undefined) {
        out.push(
          issue('duplicate_address', file, `Same address as /contracts/${first}/address.`, pointer),
        );
      } else seen.set(lower, index);
    });
  }
}

const normaliseContract = (contract: RegistryContract): RegistryContract => ({
  address: contract.address.toLowerCase(),
  role: contract.role,
  ...(contract.name !== undefined ? { name: contract.name } : {}),
  ...(contract.version !== undefined ? { version: contract.version } : {}),
  ...(contract.deployedBlock !== undefined ? { deployedBlock: contract.deployedBlock } : {}),
  ...(contract.creationTx !== undefined ? { creationTx: contract.creationTx.toLowerCase() } : {}),
});

/** The published form of a valid entry: fixed key order, lowercase addresses, no `$schema`. */
export const normaliseEntry = (entry: RegistryEntryInput): RegistryEntry => ({
  id: entry.id,
  name: entry.name,
  type: entry.type,
  chainId: entry.chainId,
  status: entry.status,
  contracts: entry.contracts.map(normaliseContract),
  ...(entry.website !== undefined ? { website: entry.website } : {}),
  ...(entry.docs !== undefined ? { docs: entry.docs } : {}),
  sources: [...entry.sources],
  ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
  addedAt: entry.addedAt,
});

/** The exact text a registry file must contain: two-space JSON and a final newline. */
export const canonicalJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const compareEntries = (a: RegistryEntry, b: RegistryEntry): number =>
  ENTRY_TYPES.indexOf(a.type) - ENTRY_TYPES.indexOf(b.type) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Parsed = {
  file: string;
  raw: Record<string, unknown>;
  entry: RegistryEntryInput | null;
  clean: boolean;
};

/**
 * Validate a registry tree given as files. Pure: no file system, no network. Every finding is
 * an error; `ok` is true only when there are none.
 */
export function validateRegistryFiles(
  files: readonly RegistryFile[],
  options: ValidateOptions = {},
): ValidationResult {
  const issues: RegistryIssue[] = [];
  const parsed: Parsed[] = [];
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  if (sorted.length > LIMITS.maxFiles) {
    issues.push(
      issue('too_many_files', '', `The registry may hold at most ${LIMITS.maxFiles} files.`),
    );
  }

  for (const { path: file, text } of sorted.slice(0, LIMITS.maxFiles)) {
    const own: RegistryIssue[] = [];
    const parts = file.split('/');
    const [folder, name] = parts;
    if (parts.length === 1 || folder === undefined || name === undefined) {
      issues.push(
        issue('unexpected_file', file, 'Files belong in a type folder, e.g. dexes/<id>.json.'),
      );
      continue;
    }
    if (FOLDER_TYPES[folder] === undefined || !Object.hasOwn(FOLDER_TYPES, folder)) {
      issues.push(
        issue(
          'unknown_type_folder',
          file,
          `"${folder}" is not a registry type folder (${Object.keys(FOLDER_TYPES).join(', ')}).`,
        ),
      );
      continue;
    }
    if (parts.length > 2) {
      issues.push(issue('nested_directory', file, 'Type folders hold files only, no subfolders.'));
      continue;
    }
    if (name === '.gitkeep') continue;
    if (!name.endsWith('.json')) {
      issues.push(issue('unexpected_file', file, 'Type folders hold <id>.json files only.'));
      continue;
    }
    if (encoder.encode(text).length > LIMITS.maxFileBytes) {
      issues.push(
        issue('file_too_large', file, `Entry files may be at most ${LIMITS.maxFileBytes} bytes.`),
      );
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      issues.push(
        issue('invalid_json', file, `Not valid JSON: ${(error as Error).message.slice(0, 160)}`),
      );
      continue;
    }
    const forbidden: string[] = [];
    findForbiddenKeys(value, [], forbidden);
    if (forbidden.length > 0) {
      for (const pointer of forbidden) {
        issues.push(
          issue(
            'forbidden_key',
            file,
            'The keys __proto__, constructor and prototype are refused.',
            pointer,
          ),
        );
      }
      continue;
    }
    if (!isRecord(value)) {
      issues.push(issue('schema_violation', file, 'An entry is a JSON object.'));
      continue;
    }
    if (text !== canonicalJson(value)) {
      own.push(
        issue(
          'non_canonical_json',
          file,
          'Write the file as two-space JSON with a final newline and no duplicate keys (run `pnpm format:registry`).',
        ),
      );
    }

    const result = EntrySchema.safeParse(value);
    if (!result.success)
      for (const zodIssue of result.error.issues) own.push(...mapZodIssue(file, zodIssue, value));
    checkSemantics(file, value, options, own);

    const expectedType = FOLDER_TYPES[folder];
    if (typeof value.id === 'string' && `${value.id}.json` !== name) {
      own.push(
        issue(
          'file_name_mismatch',
          file,
          `The file must be named ${value.id}.json after its id.`,
          '/id',
        ),
      );
    }
    if (typeof value.type === 'string' && value.type !== expectedType) {
      own.push(
        issue(
          'type_folder_mismatch',
          file,
          `A "${value.type}" entry does not belong in ${folder}/ (expected type "${expectedType}").`,
          '/type',
        ),
      );
    }
    issues.push(...own);
    parsed.push({
      file,
      raw: value,
      entry: result.success ? result.data : null,
      clean: own.length === 0,
    });
  }

  // Cross-file: ids and addresses are unique across the whole registry.
  const ids = new Map<string, string>();
  const addresses = new Map<string, string>();
  const crossDirty = new Set<string>();
  for (const { file, raw } of parsed) {
    if (typeof raw.id === 'string') {
      const other = ids.get(raw.id);
      if (other !== undefined) {
        issues.push(
          issue('duplicate_id', file, `The id "${raw.id}" is already used by ${other}.`, '/id'),
        );
        crossDirty.add(file);
      } else ids.set(raw.id, file);
    }
    if (Array.isArray(raw.contracts)) {
      const local = new Set<string>();
      raw.contracts.forEach((contract, index) => {
        if (!isRecord(contract) || !isAddress(contract.address)) return;
        const lower = contract.address.toLowerCase();
        if (local.has(lower)) return; // reported inside the file
        local.add(lower);
        const other = addresses.get(lower);
        if (other !== undefined) {
          issues.push(
            issue(
              'duplicate_address',
              file,
              `${lower} is already listed in ${other}; one address belongs to one entry.`,
              `/contracts/${index}/address`,
            ),
          );
          crossDirty.add(file);
        } else addresses.set(lower, file);
      });
    }
  }

  const unique = new Map<string, RegistryIssue>();
  for (const found of issues) {
    const key = `${found.file}\u0000${found.pointer ?? ''}\u0000${found.code}`;
    if (!unique.has(key)) unique.set(key, found);
  }
  const finalIssues = [...unique.values()].sort(
    (a, b) =>
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
      ((a.pointer ?? '') < (b.pointer ?? '') ? -1 : (a.pointer ?? '') > (b.pointer ?? '') ? 1 : 0),
  );

  const entries = parsed
    .filter((item) => item.clean && item.entry !== null && !crossDirty.has(item.file))
    .map((item) => normaliseEntry(item.entry as RegistryEntryInput))
    .sort(compareEntries);

  return { ok: finalIssues.length === 0, issues: finalIssues, entries };
}

/** Group issue codes for a summary line. */
export const countByCode = (
  issues: readonly RegistryIssue[],
): Partial<Record<IssueCode, number>> => {
  const counts: Partial<Record<IssueCode, number>> = {};
  for (const found of issues) counts[found.code] = (counts[found.code] ?? 0) + 1;
  return counts;
};
