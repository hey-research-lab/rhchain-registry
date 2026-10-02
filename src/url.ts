import type { IssueCode } from './issues.js';
import { LIMITS } from './schema.js';

/**
 * URL rules for authored registry files (ecosystem conventions §3).
 *
 * `https:` only. Refused: every other scheme (`http:`, `javascript:`, `data:`, `file:`,
 * `blob:` …), credentials in the URL, IP-literal hosts, local names (`localhost`, `.local`,
 * `.internal`, single-label hosts), internationalised hosts (`xn--` or non-ASCII), whitespace,
 * control characters and backslashes, and anything longer than 500 characters.
 *
 * The registry stores URLs in their normalised form only — lowercase host without a trailing
 * dot, no default port, no fragment, exactly as `new URL(...).href` prints it — so two spellings
 * of one page cannot pass as two sources. Nothing in this package ever fetches these URLs:
 * they are data for people and tools to inspect.
 */
export type UrlCheck =
  { ok: true; url: string; hostname: string } | { ok: false; code: IssueCode; message: string };

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet'];
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
// Hosts written as a bare number (`https://2130706433/`) are IPv4 literals in another spelling.
const NUMERIC_HOST_RE = /^(0x[0-9a-f]+|\d+)$/i;

const fail = (code: IssueCode, message: string): UrlCheck => ({ ok: false, code, message });

export function checkAuthoredUrl(raw: string): UrlCheck {
  if (raw.length > LIMITS.maxUrlLength) {
    return fail('url_too_long', `URLs may be at most ${LIMITS.maxUrlLength} characters.`);
  }
  const scheme = SCHEME_RE.exec(raw)?.[1]?.toLowerCase();
  if (scheme === undefined) return fail('invalid_url', 'Expected an absolute https:// URL.');
  if (scheme !== 'https') {
    return fail('unsafe_url_scheme', `Only https: URLs are allowed; "${scheme}:" is not.`);
  }
  if (!/^https:\/\//i.test(raw)) return fail('invalid_url', 'Expected an absolute https:// URL.');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f\\]/.test(raw)) {
    return fail('invalid_url', 'URLs may not contain spaces, control characters or backslashes.');
  }
  const authority = raw.slice('https://'.length).split(/[/?#]/, 1)[0] ?? '';
  if (/[^!-~]/.test(authority)) {
    return fail(
      'url_idn_host',
      'Internationalised host names are not accepted; use the ASCII host name.',
    );
  }
  if (/[^!-~]/.test(raw)) {
    return fail('invalid_url', 'Non-ASCII characters in a URL must be percent-encoded.');
  }
  if (authority.includes('@')) {
    return fail('url_credentials', 'URLs may not carry a username or password.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail('invalid_url', 'Not a valid URL.');
  }
  if (url.username !== '' || url.password !== '') {
    return fail('url_credentials', 'URLs may not carry a username or password.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname === '') return fail('invalid_url', 'The URL has no host.');
  if (hostname.startsWith('[') || IPV4_RE.test(hostname) || NUMERIC_HOST_RE.test(hostname)) {
    return fail('url_ip_literal', 'URLs must name a host, not an IP address.');
  }
  if (
    hostname === 'localhost' ||
    !hostname.includes('.') ||
    LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return fail('url_local_host', `"${hostname}" is not a public host name.`);
  }
  if (hostname.split('.').some((label) => label.startsWith('xn--'))) {
    return fail('url_idn_host', 'Internationalised (punycode) host names are not accepted.');
  }
  url.hash = '';
  url.hostname = hostname;
  return { ok: true, url: url.href, hostname };
}

/**
 * Validate a URL and require it to be written in its normalised form. Returns the issue to
 * report, or `null` when the URL is acceptable as written.
 */
export function checkStoredUrl(raw: string): { code: IssueCode; message: string } | null {
  const result = checkAuthoredUrl(raw);
  if (!result.ok) return { code: result.code, message: result.message };
  if (result.url !== raw) {
    return {
      code: 'url_not_normalised',
      message: `Write this URL in its normalised form: ${result.url}`,
    };
  }
  return null;
}
