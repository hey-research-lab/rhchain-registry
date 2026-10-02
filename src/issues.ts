/**
 * Every finding the validator can report. Codes are stable machine strings; messages are for
 * people. All of them are errors: CI fails on any finding.
 */
export const ISSUE_CODES = [
  // layout
  'unknown_type_folder',
  'unexpected_file',
  'nested_directory',
  'symlink_not_allowed',
  'too_many_files',
  'file_too_large',
  'file_name_mismatch',
  'type_folder_mismatch',
  // parsing
  'invalid_json',
  'non_canonical_json',
  'forbidden_key',
  'schema_violation',
  'unknown_key',
  // identity
  'duplicate_id',
  'unsupported_chain',
  // contracts
  'invalid_address',
  'invalid_checksum',
  'not_a_contract_identity',
  'duplicate_address',
  'invalid_tx_hash',
  'contracts_required',
  // provenance and links
  'missing_sources',
  'duplicate_source',
  'invalid_url',
  'unsafe_url_scheme',
  'url_credentials',
  'url_ip_literal',
  'url_local_host',
  'url_idn_host',
  'url_too_long',
  'url_not_normalised',
  // text and dates
  'unsafe_text',
  'forbidden_wording',
  'invalid_date',
  'date_in_future',
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export type RegistryIssue = {
  code: IssueCode;
  message: string;
  /** Path relative to the registry root, e.g. `dexes/uniswap-v3.json`. */
  file: string;
  /** JSON pointer inside the file, when the finding is about one field. */
  pointer?: string;
};

export const issue = (
  code: IssueCode,
  file: string,
  message: string,
  pointer?: string,
): RegistryIssue =>
  pointer === undefined ? { code, message, file } : { code, message, file, pointer };
