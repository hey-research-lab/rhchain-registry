## What this changes

<!-- Added / changed / deprecated entry ids, or the code change. -->

## Sources (required for every registry change)

<!--
One line per address: the address, and a public https URL where it appears on Robinhood Chain
(project docs, a deployments file, an explorer verified-source page). PRs without a source for
every address are closed.
-->

| Address | Source URL | Where on that page |
| ------- | ---------- | ------------------ |
|         |            |                    |

## Checklist

- [ ] Every address appears, character for character, in a cited public source for chain 4663.
- [ ] `name` and `role` are what the source calls the contract, not a guess.
- [ ] `notes` state facts only — no verdicts, endorsements or claims that anyone verified the project.
- [ ] `pnpm format:registry && pnpm validate && pnpm test` pass.
- [ ] `pnpm build` was run and the regenerated `dist/registry.json` and `dist/addresses.json` are committed.
- [ ] No secrets, keys or personal data.

I understand that registry presence is not a Verified Builder, not an endorsement and not HEY
verification, and that a listed contract does not establish who owns a project.
