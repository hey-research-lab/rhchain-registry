# rhchain-registry

A community-maintained, CI-validated registry of Robinhood Chain infrastructure — factories,
DEXes, launchpads, bridges, oracles, explorers, lockers, protocols — where every entry cites the
public sources it rests on.

[![CI](https://github.com/hey-research-lab/rhchain-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/hey-research-lab/rhchain-registry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-informational.svg)](package.json)
[![Robinhood Chain 4663](https://img.shields.io/badge/Robinhood%20Chain-4663-informational.svg)](https://robinhoodchain.blockscout.com)

> **Registry presence ≠ Verified Builder.** A contract listed here does not prove who owns a
> project, and inclusion is not HEY verification.

## Why it exists

Every tool that reads Robinhood Chain ends up keeping its own private list of "which contract is
the Uniswap v3 factory" or "which address launches hood.fun tokens". Those lists drift, and a
wrong constant in one of them is invisible. This repository keeps one public list instead: one
JSON file per entry, each with the URLs a reader can open to check it, validated in CI, published
as a typed npm package and two plain JSON files.

## Why Robinhood Chain only

The registry covers Robinhood Chain mainnet — chain id `4663`, CAIP-2 `eip155:4663` — and nothing
else. `chainId` must be the JSON integer `4663`; any other value (including `"4663"` or the
testnet's `46630`) fails validation with `unsupported_chain`, and the library and CLI reject other
chains the same way. There is no network option.

## Install

```sh
npm i @hey-research-lab/rhchain-registry
```

Or use the data without a package: [`dist/registry.json`](dist/registry.json) (every entry) and
[`dist/addresses.json`](dist/addresses.json) (lowercase address → entry id, type, role).

## Smallest working example

```ts
import { findByAddress, getEntry, list } from '@hey-research-lab/rhchain-registry';

findByAddress('0x1f7d7550B1b028f7571E69A784071F0205FD2EfA');
// → { entry: { id: 'uniswap-v3', type: 'dex', … }, contract: { address: '0x1f7d…2efa', role: 'factory', name: 'UniswapV3Factory' } }

getEntry('robinlaunch')?.contracts.length; // 15
list('launchpad').map((entry) => entry.id); // ['ape-store', 'bags', 'clanker', …]
```

```sh
npx @hey-research-lab/rhchain-registry lookup 0x8366a39cc670b4001a1121b8f6a443a643e40951
```

Everything runs offline: the data ships inside the package.

## Reference

### Library

| Export                                                       | What it does                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getEntry(id)`                                               | The entry with that id, or `undefined`.                                                                                                                                                                  |
| `findByAddress(address, chainId?)`                           | `{ entry, contract }` for a listed address, or `undefined`. Accepts either case and CAIP-10 (`eip155:4663:0x…`). Another chain throws `unsupported_chain`; a malformed address throws `invalid_address`. |
| `list(type?)`                                                | All entries, or one type's, sorted by type then id. An unknown type throws.                                                                                                                              |
| `registry`                                                   | The whole document (`schemaVersion`, `chain`, `entryCount`, `contractCount`, `entries`).                                                                                                                 |
| `validateRegistryFiles(files, { today })`                    | The validator CI runs, as a pure function over `{ path, text }` files.                                                                                                                                   |
| `buildArtifacts(entries)`                                    | The two published documents, deterministic (no timestamps).                                                                                                                                              |
| `EntrySchema`, `RegistryDocumentSchema`, types               | zod schemas and TypeScript types.                                                                                                                                                                        |
| `CHAIN_ID`, `CAIP2`, `assertChainId`, `toChecksumAddress`, … | Shared chain and address helpers.                                                                                                                                                                        |

Subpath exports: `@hey-research-lab/rhchain-registry/registry.json`, `…/addresses.json` and
`…/schema/registry-entry.v1.json`.

`undefined` from `findByAddress` means only that this registry has no entry for the address. It
says nothing else about the contract.

### CLI

```
rhchain-registry lookup <address>     Which entry lists this address (also eip155:4663:<address>)
rhchain-registry get <id>             One entry by id
rhchain-registry list [type]          Entries, optionally of one type
rhchain-registry validate [dir]       Validate a registry tree (default: ./registry)
```

Flags: `--json` (exactly one JSON document on stdout, schema `rhchain-registry.cli/v1`),
`--quiet`, `--no-color`, `--help`, `--version`. Exit codes: `0` ok, `1` invalid registry, `2`
usage error or `unsupported_chain`, `4` not listed.

### Entry format

One file per entry at `registry/<folder>/<id>.json`. Folders and types:

| Folder            | `type`           |
| ----------------- | ---------------- |
| `factories/`      | `factory`        |
| `dexes/`          | `dex`            |
| `launchpads/`     | `launchpad`      |
| `bridges/`        | `bridge`         |
| `oracles/`        | `oracle`         |
| `explorers/`      | `explorer`       |
| `lockers/`        | `locker`         |
| `protocols/`      | `protocol`       |
| `infrastructure/` | `infrastructure` |

```json
{
  "$schema": "../../schema/registry-entry.v1.json",
  "id": "uniswap-v2",
  "name": "Uniswap v2",
  "type": "dex",
  "chainId": 4663,
  "status": "active",
  "contracts": [
    {
      "address": "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
      "role": "factory",
      "name": "UniswapV2Factory"
    }
  ],
  "website": "https://app.uniswap.org/",
  "docs": "https://developers.uniswap.org/docs/protocols/v2/deployments",
  "sources": ["https://developers.uniswap.org/docs/protocols/v2/deployments"],
  "notes": "Uniswap's v2 deployments page lists the factory and V2Router02 for Robinhood Chain.",
  "addedAt": "2026-10-02"
}
```

| Field             | Required | Rule                                                                                                                                 |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | yes      | kebab-case, unique across the registry, equal to the file name                                                                       |
| `name`            | yes      | printable ASCII, ≤ 80 characters                                                                                                     |
| `type`            | yes      | one of the nine types; must match the folder                                                                                         |
| `chainId`         | yes      | the integer `4663`                                                                                                                   |
| `status`          | yes      | `active`, `deprecated` or `unknown` — of the entry, by its sources                                                                   |
| `contracts[]`     | yes      | `address` + `role`, optional `name`, `version`, `deployedBlock`, `creationTx`; may be empty only for `explorer` and `infrastructure` |
| `website`, `docs` | no       | https URL                                                                                                                            |
| `sources[]`       | yes      | 1–10 https URLs to public evidence: official docs, a deployments file, an explorer verified-source page                              |
| `notes`           | no       | ≤ 1000 characters; how the sources support the entry                                                                                 |
| `addedAt`         | yes      | `YYYY-MM-DD`, not in the future                                                                                                      |

Roles: `factory`, `launch-factory`, `auction-factory`, `router`, `pool-manager`,
`position-manager`, `position-descriptor`, `quoter`, `lens`, `multicall`, `library`, `strategy`,
`permit`, `locker`, `bridge`, `oracle`, `other`.

The JSON Schema is [`schema/registry-entry.v1.json`](schema/registry-entry.v1.json). The validator
adds what a schema cannot say:

- **Addresses**: `0x` + 40 hex; a mixed-case address must carry a correct EIP-55 checksum
  (`invalid_checksum`); all-lowercase is accepted; the zero and dead addresses are refused
  (`not_a_contract_identity`); **an address appears in one entry only**, compared in lowercase
  (`duplicate_address`).
- **Ids** are unique across every folder (`duplicate_id`).
- **Chain**: anything but `4663` is `unsupported_chain`.
- **Sources**: at least one (`missing_sources`), no repeats (`duplicate_source`).
- **URLs** (`website`, `docs`, `sources`): `https:` only; no credentials, IP-literal hosts,
  `localhost`/`.local`/`.internal`/single-label hosts, punycode or non-ASCII hosts, fragments, or
  more than 500 characters; written in normal form (lowercase host, no default port, a path —
  `https://example.com/`, not `https://example.com`).
- **Files**: only the nine folders, only `<id>.json` (and `.gitkeep`) inside them, no subfolders,
  no symlinks, ≤ 64 KB; canonical two-space JSON with a final newline (`pnpm format:registry`),
  which also catches a duplicated key that a JSON parser would silently collapse; no
  `__proto__`, `constructor` or `prototype` keys; no unknown keys.
- **Text**: no control, bidirectional-override or zero-width characters; no verdict, endorsement
  or verification wording ("safe", "audited", "endorsed", "verified builder", "official
  Robinhood", …).

### Published artifacts

`pnpm build` validates `registry/` and writes `dist/registry.json` and `dist/addresses.json`.
Both are committed, contain no timestamps, and CI rebuilds them and fails if the committed copies
are stale.

## What is in it today

24 entries, 68 contract addresses, all added on 2026-10-02:

| Type           | Entries                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dex            | `uniswap-v2`, `uniswap-v3`, `uniswap-v4` — from Uniswap's own Robinhood Chain deployment pages                                                                              |
| factory        | `uniswap-liquidity-launcher` — Uniswap's Liquidity Launchpad deployments page                                                                                               |
| protocol       | `uniswap-universal-router`, `permit2`, `doppler`                                                                                                                            |
| launchpad      | `ape-store`, `bags`, `clanker`, `flap`, `flaunch`, `hood-fun`, `klik`, `launchhood`, `letscash`, `long-xyz`, `pair-fund`, `pons`, `robinlaunch`, `robinpad`, `trench-today` |
| explorer       | `robinhood-chain-blockscout` — from Robinhood's chain documentation                                                                                                         |
| infrastructure | `robinhood-chain-public-rpc` — from Robinhood's chain documentation                                                                                                         |

`bridges/`, `oracles/` and `lockers/` are empty: nothing with a public source has been
submitted yet.

The launchpad entries started from the factory list in HEY Research Lab's public source code,
each re-checked against a public page that names the address. Where the public evidence is a
web app's own JavaScript, the source is the app's URL and the notes say so. Launchpad `status` is
`unknown`: a page that ships an address does not say whether it is still in use.

**Left out until someone can cite a public source** (contributions welcome):

- Robinhood's stock-token factory. Robinhood's documentation describes a Stock Token API that
  lists token deployments, but no public page found names a factory contract.
- A third hood.fun launch contract, the EasyA Kickstart and Hoodit launchers, a newer Long.xyz
  factory proxy and the Pons launch-and-buy router: HEY's own research reads them from the
  chain, but no public page names them.
- Uniswap LiquidityLauncher v3.0.0: Uniswap's deployments page now lists only v3.2.0.

## How it relates to HEY Research Lab

HEY Research Lab maintains this repository as a public good for the Robinhood Chain ecosystem.
HEY does not read it in production today; a future HEY source adapter could, and would treat an
entry as a lead to check, never as proof. HEY's private quality gate stays authoritative for
everything HEY publishes about a project.

The registry could be useful to HEY, RHTools, CHIT, bots, AI agents, dashboards and builders —
anyone who needs to name a Robinhood Chain contract. Naming them describes potential consumers;
it implies no partnership, integration or endorsement.

## What it does NOT prove

Registry presence is not a Verified Builder and not an endorsement. An entry lists public facts
about infrastructure with their sources; it does not establish who owns a contract, that it is
safe, or that HEY or anyone verified the project.

A contract does not prove project ownership, and inclusion is not HEY verification. An entry's
`name` and `role` say what its sources call the contract, nothing more.

HEY Research Lab is an independent research project and is not affiliated with, endorsed by or
partnered with Robinhood Markets, Inc. or Robinhood Chain.

## Security

See [SECURITY.md](SECURITY.md). The package reads only the files you point the validator at,
never fetches any URL (the URLs in entries are data, not something it opens), never runs a
child process and has two runtime dependencies (`zod`, `@noble/hashes` for EIP-55).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every new entry needs a public source. Before opening a
pull request: `pnpm validate`, `pnpm test`, `pnpm build` (and commit the rebuilt `dist/*.json`),
`pnpm scan`. Never commit secrets.

## Licence

[MIT](LICENSE), code and data, © 2026 HEY Research Lab.
