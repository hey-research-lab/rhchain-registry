# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
