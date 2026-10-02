/**
 * No test may touch the network. The registry is validated from files on disk; nothing in this
 * package fetches a URL, and any call reaching the real `fetch` is a mistake that fails loudly.
 */
const blocked = async (input: unknown): Promise<never> => {
  const target = typeof input === 'string' ? input : String(input);
  throw new Error(`Network access is disabled in tests. Something tried to fetch ${target}.`);
};

globalThis.fetch = blocked as unknown as typeof fetch;
