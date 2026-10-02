import raw from '../dist/registry.json';
import { type RegistryDocument, RegistryDocumentSchema } from './schema.js';

/**
 * The registry this package version ships, inlined at build time from `dist/registry.json`
 * and checked against its schema once when the module loads.
 */
export const registry: RegistryDocument = RegistryDocumentSchema.parse(raw) as RegistryDocument;
