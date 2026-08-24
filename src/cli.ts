/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
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

/**
 * REFUSER UN DRAPEAU QU'ON NE CONNAÎT PAS.
 *
 * Le défaut que ceci ferme n'est pas un plantage, c'est pire : `npm run optimise --
 * --nimportequoi` tournait entièrement, avec les réglages par défaut, et sortait 0. Un
 * acheteur qui écrit `--fields` au lieu de `--field` obtient un résultat complet, juste, et
 * qui ne répond pas à la question qu'il a posée — puis il le cite. Un succès qui ment sur ce
 * qu'il a fait coûte plus cher qu'un échec, parce que rien ne le signale.
 *
 * Le refus nomme le drapeau ET liste ceux qui existent : sans la liste, le lecteur ne peut
 * que deviner, et un refus sans issue se contourne en le retirant.
 *
 * `--` seul est laissé passer : c'est le séparateur de npm, pas un drapeau.
 */
export function refuserDrapeauxInconnus(connus: readonly string[], depuis = 2): void {
  const argv = args();
  if (argv === undefined) return;            /* pas de ligne de commande : rien à refuser */
  const inconnus = argv.slice(depuis)
    .filter((a) => a.startsWith("--") && a !== "--")
    .map((a) => a.split("=")[0]!)
    .filter((f) => !connus.includes(f));
  if (inconnus.length === 0) return;
  const sortie = (globalThis as { process?: { stderr?: { write?: (s: string) => void }; exit?: (n: number) => never } }).process;
  const dire = (l: string) => sortie?.stderr?.write?.(l + "\n");
  dire(`Unknown option${inconnus.length > 1 ? "s" : ""}: ${inconnus.join(", ")}`);
  dire(connus.length
    ? `This command accepts: ${connus.join(", ")}`
    : `This command accepts no options.`);
  dire(`Nothing was run — a command that ignores an option you typed would answer a`);
  dire(`question you did not ask, and look right doing it.`);
  sortie?.exit?.(2);
}
