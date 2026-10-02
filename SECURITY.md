# Security policy

## Reporting a vulnerability

Please report privately through GitHub's "Report a vulnerability" (Security → Advisories) on this
repository, or email hi@heyresearch.xyz with "security" in the subject. Do not open a public issue.
We aim to acknowledge within 3 working days. There is no bug bounty for this repository.

A wrong or malicious address in the registry is a security issue: report it the same way if it
could mislead people, or open a pull request with the source showing the correct value.

## Scope

- The library reads no files and makes no network calls; its data is inlined at build time.
- The validator (`rhchain-registry validate`, `pnpm validate`) reads only the directory it is
  given: it never follows symlinks (they are reported), never leaves that directory, caps file
  count (2,000) and size (64 KB), parses JSON then validates it strictly, and refuses
  `__proto__`, `constructor` and `prototype` keys.
- URLs inside entries are data. Nothing in this package fetches them; the validator only checks
  their shape (`https:` only, no credentials, no IP-literal, local or punycode hosts).
- Registry pull requests are an attack surface: look-alike addresses, phishing URLs, Unicode
  tricks. The validator refuses non-ASCII names, bidirectional and zero-width characters and
  internationalised hosts; CODEOWNERS review is required for every change to `registry/`.
- No child processes. CI runs with `contents: read` and no secrets.

## Handling secrets

This project never needs HEY credentials or any other token. Never commit a `.env` with values.

## Supported versions

The latest 0.x minor receives fixes.
