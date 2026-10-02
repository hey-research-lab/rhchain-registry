# Contributing

Thank you for helping keep Robinhood Chain's infrastructure list accurate. The registry is only
useful if every line in it can be checked by anyone, so the rules are strict.

## Adding or changing an entry

1. Find a **public source** that names the address on Robinhood Chain (chain id 4663):
   - the project's own documentation or deployments page (best);
   - a deployments file in the project's public repository;
   - an explorer verified-source page (Blockscout, Sourcify) whose contract name matches;
   - a public API or web app of the project that ships the address (say so in `notes`).
     A social post, a chat message, a screenshot or "I deployed it" is not a source. If you cannot
     cite one, do not add the entry.
2. Create `registry/<folder>/<id>.json` (see the folder table in the README). Copy an existing
   entry as a template; the `$schema` line gives your editor completion and checking.
3. Write addresses all-lowercase, or EIP-55 checksummed exactly as the source prints them. One
   address belongs to one entry.
4. Keep `notes` short and factual: which source names which address. No opinions, no
   verdicts ("safe", "audited", "trusted"), no claims that anyone verified the project.
5. Set `status` from what the sources say: `active`, `deprecated`, or `unknown` when they do not
   say.
6. Run:

   ```sh
   corepack enable
   pnpm install
   pnpm format:registry   # canonical JSON formatting
   pnpm validate          # every registry rule
   pnpm build             # regenerates dist/registry.json and dist/addresses.json
   pnpm test
   pnpm scan              # leak and attribution scan
   ```

7. Commit the entry **and** the regenerated `dist/registry.json` / `dist/addresses.json`. CI
   rebuilds them and fails if they are stale.
8. Open a pull request using the template; list every source.

## What reviewers check

- Each address appears in the cited source, on Robinhood Chain, character for character.
- The name and role are what the source calls the contract — not a guess.
- No look-alike names or URLs (the validator refuses non-ASCII names and punycode hosts, but a
  reviewer still reads them).
- The change does not move an address from one entry to another without a source explaining why.

Being listed is not an endorsement, a verification or a statement about who owns a contract.
Removing an entry needs a source too (for example, the project's docs marking it retired —
prefer `status: "deprecated"` over deletion so consumers keep the history).

## Code changes

TypeScript strict, ESLint, Prettier, Vitest with network access blocked. `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm scan` must pass. Keep runtime dependencies to
`zod` and `@noble/hashes`.

Commits use conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`); a
registry addition is `feat(registry): add <id>`. Keep commits small, with no generated-by or
co-author trailers.

## Maintainers' notes

- **Parity.** The validator's address, checksum, chain and URL rules follow the HEY Research Lab
  ecosystem conventions shared by the other `hey-research-lab` repositories (`src/chain.ts` and
  `src/evm.ts` are kept identical across them). The first launchpad entries were seeded from the
  public launch-factory list in `hey-research-lab/hey-research-open`
  (`packages/sources/src/factories`), extracted from HEY Research Lab's production contract at
  `21775391f6c0fb4494575e0b4463df535c65cb96`, and each was re-checked against a public page on
  2026-10-02. HEY's indexing details (start blocks, event topics) are deliberately not copied.
- **Releases.** `pnpm build` then `npm pack` produces the package; publishing to npm is done by
  hand by the organisation owners.
- **Data licence.** Code and data are MIT today; switching the data to CC0 or CC BY is a decision
  for the organisation owners.
