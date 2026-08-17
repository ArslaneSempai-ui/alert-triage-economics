/**
 * Is this module the one the user ran?
 *
 * Every tool here uses the same idiom to decide whether to print a report: compare
 * `import.meta.filename` against `process.argv[1]`. Written inline it is a small landmine —
 * `process` is a bare identifier, so the moment one of these modules is loaded in a browser
 * the comparison throws a ReferenceError at import time, before a single line of the page
 * runs. That is exactly what happened building the hosted demos.
 *
 * `typeof process` is the one form that is safe on an undeclared identifier, and it belongs
 * in one place rather than in twenty.
 *
 * Copied identically into each repository.
 */

const args = (): string[] | undefined =>
  (globalThis as { process?: { argv?: string[] } }).process?.argv;

export function isMain(meta: ImportMeta): boolean {
  const filename = (meta as { filename?: string }).filename;
  const argv = args();
  return filename !== undefined && argv !== undefined && filename === argv[1];
}

/**
 * A command-line argument, safely.
 *
 * Same reasoning as `isMain`: a bare `process.argv[2]` inside a CLI block never *runs* in a
 * browser, but it still has to type-check in a build with no Node types — and one bare
 * reference is enough to make a module unloadable if the guard around it is ever removed.
 */
export const arg = (n: number): string | undefined => args()?.[n];
