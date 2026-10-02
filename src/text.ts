/**
 * Text rules for authored strings (names, labels, notes).
 *
 * Control, bidirectional-override and zero-width characters are refused: they let a line read
 * differently from what it contains. Notes may use Unicode letters; names are ASCII (see
 * `NAME_RE`).
 */
const UNSAFE_TEXT_RE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

export const hasUnsafeText = (value: string): boolean => UNSAFE_TEXT_RE.test(value);

/**
 * Wording a registry entry may not use. An entry lists public facts about infrastructure; it
 * never carries a verdict, an endorsement, advice or a claim of verification by HEY. Matched
 * case-insensitively on word boundaries.
 */
export const FORBIDDEN_WORDING: readonly string[] = [
  'rug',
  'rugpull',
  'rug pull',
  'scam',
  'safe',
  'unsafe',
  'trusted',
  'bullish',
  'bearish',
  '100x',
  'alpha',
  'undervalued',
  'guaranteed',
  'smart money',
  'whale',
  'dev wallet',
  'partnership',
  'partnered',
  'audited',
  'endorsed',
  'endorsement',
  'official robinhood',
  'verified by hey',
  'hey verified',
  'hey-verified',
  'verified builder',
];

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FORBIDDEN_RE = new RegExp(
  `(?<![A-Za-z0-9])(${FORBIDDEN_WORDING.map(escapeRe).join('|')})(?![A-Za-z0-9])`,
  'i',
);

/** The first forbidden phrase found in `value`, or `null`. */
export const findForbiddenWording = (value: string): string | null => {
  const match = FORBIDDEN_RE.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
};

const FORBIDDEN_RE_ALL = new RegExp(FORBIDDEN_RE.source, 'gi');

/** Every distinct forbidden phrase in `value`, in order of first appearance (so one run reports them all). */
export const findAllForbiddenWording = (value: string): string[] => {
  const found = new Set<string>();
  for (const match of value.matchAll(FORBIDDEN_RE_ALL)) {
    if (match[1] !== undefined) found.add(match[1].toLowerCase());
  }
  return [...found];
};
