import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { version } from '../package.json';
import { CAIP2, CHAIN_ID, CHAIN_NAME } from './chain.js';
import { loadRegistryTree } from './fs.js';
import { findByAddress, getEntry, list, registry } from './index.js';
import { ENTRY_TYPES, type EntryType, type RegistryEntry } from './schema.js';
import { validateRegistryFiles } from './validate.js';

export type CliIo = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  /** Today as YYYY-MM-DD; injected by tests. */
  today?: string;
};

const HELP = `rhchain-registry ${version} — Robinhood Chain (${CHAIN_ID}) infrastructure registry

Usage:
  rhchain-registry lookup <address>     Which entry lists this address (also eip155:4663:<address>)
  rhchain-registry get <id>             One entry by id
  rhchain-registry list [type]          Entries, optionally of one type (${ENTRY_TYPES.join(', ')})
  rhchain-registry validate [dir]       Validate a registry tree (default: ./registry)

Options:
  --json        Print exactly one JSON document on stdout
  --quiet       Print nothing on success (validate)
  --no-color    Accepted for compatibility; output is never coloured
  --help        Show this help
  --version     Print the version

Exit codes: 0 ok · 1 invalid registry · 2 usage error or unsupported_chain · 4 not listed

Registry presence is not a Verified Builder and not an endorsement. An entry lists public facts
about infrastructure with their sources; it does not establish who owns a contract.
`;

type Envelope = {
  schema: 'rhchain-registry.cli/v1';
  command: string;
  ok: boolean;
  chain: { name: typeof CHAIN_NAME; chainId: typeof CHAIN_ID; caip2: typeof CAIP2 };
  data: unknown;
  error: { code: string; message: string } | null;
};

const envelope = (command: string, ok: boolean, data: unknown, error: Envelope['error']): string =>
  `${JSON.stringify(
    {
      schema: 'rhchain-registry.cli/v1',
      command,
      ok,
      chain: { name: CHAIN_NAME, chainId: CHAIN_ID, caip2: CAIP2 },
      data,
      error,
    } satisfies Envelope,
    null,
    2,
  )}\n`;

const describe = (entry: RegistryEntry): string => {
  const lines = [
    `${entry.name} (${entry.id}) — ${entry.type}, status ${entry.status}`,
    ...entry.contracts.map(
      (contract) =>
        `  ${contract.address}  ${contract.role}${contract.name ? ` · ${contract.name}` : ''}${contract.version ? ` ${contract.version}` : ''}`,
    ),
  ];
  if (entry.website) lines.push(`  website: ${entry.website}`);
  if (entry.docs) lines.push(`  docs:    ${entry.docs}`);
  for (const source of entry.sources) lines.push(`  source:  ${source}`);
  if (entry.notes) lines.push(`  notes:   ${entry.notes}`);
  lines.push(`  added:   ${entry.addedAt}`);
  return `${lines.join('\n')}\n`;
};

const DISCLAIMER =
  'Registry presence is not HEY verification and does not establish who owns a contract.\n';

/** Run the CLI. Returns the exit code; never calls process.exit and never touches the network. */
export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean', default: false },
        quiet: { type: 'boolean', default: false },
        'no-color': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const json = values.json === true;
  const [command, ...rest] = positionals;

  if (values.version) {
    io.stdout(`${version}\n`);
    return 0;
  }
  if (values.help || command === undefined || command === 'help') {
    (command === undefined && !values.help ? io.stderr : io.stdout)(HELP);
    return command === undefined && !values.help ? 2 : 0;
  }

  const usage = (message: string, code = 'usage'): number => {
    if (json) io.stdout(envelope(command, false, null, { code, message }));
    else io.stderr(`${message}\n`);
    return 2;
  };

  switch (command) {
    case 'lookup': {
      const [input] = rest;
      if (input === undefined || rest.length > 1) return usage('lookup takes exactly one address.');
      let match;
      try {
        match = findByAddress(input);
      } catch (error) {
        const code = (error as { code?: string }).code ?? 'invalid_address';
        return usage((error as Error).message, code);
      }
      if (match === undefined) {
        const message =
          'This registry has no entry listing that address. That says nothing else about it.';
        if (json) io.stdout(envelope(command, false, null, { code: 'not_found', message }));
        else io.stderr(`${message}\n`);
        return 4;
      }
      if (json) io.stdout(envelope(command, true, match, null));
      else
        io.stdout(
          `${match.contract.address} is listed as ${match.contract.role} of:\n${describe(match.entry)}${DISCLAIMER}`,
        );
      return 0;
    }
    case 'get': {
      const [id] = rest;
      if (id === undefined || rest.length > 1) return usage('get takes exactly one id.');
      const entry = getEntry(id);
      if (entry === undefined) {
        const message = `No entry with id "${id}".`;
        if (json) io.stdout(envelope(command, false, null, { code: 'not_found', message }));
        else io.stderr(`${message}\n`);
        return 4;
      }
      if (json) io.stdout(envelope(command, true, entry, null));
      else io.stdout(`${describe(entry)}${DISCLAIMER}`);
      return 0;
    }
    case 'list': {
      const [type] = rest;
      if (rest.length > 1) return usage('list takes at most one type.');
      if (type !== undefined && !(ENTRY_TYPES as readonly string[]).includes(type)) {
        return usage(`Unknown type "${type}". Known: ${ENTRY_TYPES.join(', ')}.`);
      }
      const entries = list(type as EntryType | undefined);
      if (json) io.stdout(envelope(command, true, { count: entries.length, entries }, null));
      else {
        for (const entry of entries) {
          io.stdout(
            `${entry.type.padEnd(14)} ${entry.id.padEnd(32)} ${entry.contracts.length} contract(s)  ${entry.name}\n`,
          );
        }
        io.stdout(`${entries.length} of ${registry.entryCount} entries\n`);
      }
      return 0;
    }
    case 'validate': {
      const [dir] = rest;
      if (rest.length > 1) return usage('validate takes at most one directory.');
      const root = resolve(io.cwd, dir ?? 'registry');
      let tree;
      try {
        tree = loadRegistryTree(root);
      } catch (error) {
        return usage(`Cannot read ${root}: ${(error as Error).message}`);
      }
      const result = validateRegistryFiles(tree.files, {
        today: io.today ?? new Date().toISOString().slice(0, 10),
      });
      const issues = [...tree.issues, ...result.issues];
      const ok = issues.length === 0;
      if (json) {
        io.stdout(
          envelope(
            command,
            ok,
            { entryCount: result.entries.length, issues },
            ok ? null : { code: 'invalid_registry', message: `${issues.length} problem(s)` },
          ),
        );
      } else {
        for (const found of issues) {
          io.stderr(
            `${found.code}: ${found.file || '.'}${found.pointer ? ` ${found.pointer}` : ''} — ${found.message}\n`,
          );
        }
        if (!ok) io.stderr(`${issues.length} problem(s).\n`);
        else if (!values.quiet) io.stdout(`registry valid: ${result.entries.length} entries\n`);
      }
      return ok ? 0 : 1;
    }
    default:
      return usage(`Unknown command "${command}".\n\n${HELP}`);
  }
}

const isMain = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && /(?:^|[\\/])(cli\.js|rhchain-registry)$/.test(entry);
};

if (isMain()) {
  run(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    cwd: process.cwd(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exitCode = 1;
    },
  );
}
