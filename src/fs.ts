import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { type RegistryIssue, issue } from './issues.js';
import { FOLDER_TYPES, LIMITS } from './schema.js';
import type { RegistryFile } from './validate.js';

export type LoadedTree = { files: RegistryFile[]; issues: RegistryIssue[] };

const MAX_DEPTH = 3;

/**
 * Read a registry tree from disk for validation (Node only; not part of the library entry).
 *
 * Symlinks are never followed and are reported; every path is confined under `root`; file
 * count, file size and depth are capped. Files are read as UTF-8 and handed to the pure
 * validator, which decides everything else.
 */
export function loadRegistryTree(root: string): LoadedTree {
  const base = resolve(root);
  const files: RegistryFile[] = [];
  const issues: RegistryIssue[] = [];
  let seen = 0;

  const rel = (path: string): string => relative(base, path).split(sep).join('/');

  const walk = (dir: string, depth: number): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const relPath = rel(path);
      if (relPath.startsWith('..')) continue; // never leaves the root
      if (++seen > LIMITS.maxFiles) {
        if (seen === LIMITS.maxFiles + 1) {
          issues.push(
            issue('too_many_files', '', `The registry may hold at most ${LIMITS.maxFiles} files.`),
          );
        }
        return;
      }
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        issues.push(
          issue('symlink_not_allowed', relPath, 'Symlinks are not allowed in the registry.'),
        );
        continue;
      }
      if (stat.isDirectory()) {
        if (depth >= 1) {
          issues.push(
            issue('nested_directory', relPath, 'Type folders hold files only, no subfolders.'),
          );
          continue;
        }
        if (depth === 0 && !Object.hasOwn(FOLDER_TYPES, name)) {
          issues.push(
            issue(
              'unknown_type_folder',
              relPath,
              `"${name}" is not a registry type folder (${Object.keys(FOLDER_TYPES).join(', ')}).`,
            ),
          );
          continue;
        }
        if (depth + 1 < MAX_DEPTH) walk(path, depth + 1);
        continue;
      }
      if (!stat.isFile()) {
        issues.push(issue('unexpected_file', relPath, 'Only regular files are allowed.'));
        continue;
      }
      if (stat.size > LIMITS.maxFileBytes) {
        issues.push(
          issue(
            'file_too_large',
            relPath,
            `Entry files may be at most ${LIMITS.maxFileBytes} bytes.`,
          ),
        );
        continue;
      }
      files.push({ path: relPath, text: readFileSync(path, 'utf8') });
    }
  };

  const rootStat = lstatSync(base);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    issues.push(issue('unexpected_file', '', `${root} is not a directory.`));
    return { files, issues };
  }
  walk(base, 0);
  return { files, issues };
}
