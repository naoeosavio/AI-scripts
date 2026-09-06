import path from 'node:path';

/**
 * Resolve `candidate` inside `baseDir`, or return null when it escapes it
 * (relative traversal, absolute paths outside, sibling-prefix tricks).
 */
export function resolveWithin(baseDir: string, candidate: string): string | null {
  const resolved = path.resolve(baseDir, candidate);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}
