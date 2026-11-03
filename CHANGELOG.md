# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## 0.2.0 — unreleased (not yet on npm)

- Security: `zod` moves from `^3.24.1` to `^4.6.7` (GHSA-mrhx-c7xc-m3w5, memory exhaustion on large arrays, fixed only in 4.6.6). The exported schemas are now zod 4 schemas, hence the minor bump. Validation results and issue codes are unchanged; zod's own fallback messages in `schema_violation` issues read differently.
- Data: the published registry carries the BlockVectra RPC entry added on 2026-10-25 (npm 0.1.1 has 24 entries, this release 25).
- Development: vitest 4.1.12; `fast-uri` held at ^3.1.9 by a pnpm override (dev-only advisory through ajv).
- Development: vitest 4.1.11 / tsup 8.5.1, with esbuild held at ^0.28.1 by a pnpm override; clears dev-only advisories in the test and build toolchain. No runtime change.

## 0.1.1 — 2026-10-02

- The validator names every forbidden phrase in a field in one run (`"audited", "safe", "trusted" are not registry wording`) instead of one per run. New export `findAllForbiddenWording`.
- Issue templates (bug, idea) with private security reporting and HEY corrections linked.

## 0.1.0 — 2026-10-02

Initial release.

### Added

- Registry entry format (`schemaVersion` 1): JSON Schema `schema/registry-entry.v1.json` and zod
  schemas, nine type folders, required public `sources[]`, Robinhood Chain (4663) only.
- Validator covering duplicate ids, duplicate addresses across the registry, malformed addresses,
  EIP-55 checksums, zero/dead addresses, chain ids other than 4663 (`unsupported_chain`), unsafe
  or non-normalised URLs, missing sources, unknown type folders, unknown keys, prototype keys,
  canonical formatting, unsafe text and verdict wording.
- Build producing `dist/registry.json` and `dist/addresses.json` deterministically; CI fails when
  the committed copies are stale.
- Library API `getEntry`, `findByAddress` (either case, CAIP-10), `list(type)`, with the data
  inlined; CLI `rhchain-registry lookup | get | list | validate` with `--json`.
- 24 seed entries (68 contract addresses): Uniswap v2, v3 and v4 and the Liquidity Launchpad from
  Uniswap's deployment pages; Universal Router, Permit2 and Doppler; fifteen launchpads; the
  Robinhood Chain explorer and public RPC from Robinhood's chain documentation.
