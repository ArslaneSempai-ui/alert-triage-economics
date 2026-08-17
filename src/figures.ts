/**
 * README tables that cannot go stale.
 *
 * Twice this week a model changed and its README kept publishing the old numbers, and
 * both times a human had to notice. That is not a discipline problem, it is a design
 * problem: a figure typed by hand has no link to the thing it describes.
 *
 * So the tables are generated. A block in the README is delimited by two markers, and a
 * script rewrites what sits between them from the tool's own output:
 *
 *     <!-- figures:name -->
 *     ...generated, do not edit...
 *     <!-- /figures:name -->
 *
 * The prose around them stays hand-written — it carries the reasoning, and no generator
 * can produce that. Only the numbers are mechanical, and only the numbers were ever
 * wrong.
 *
 * `check` is the half that matters. Run in CI, it fails when the README no longer matches
 * what the code produces, which turns "someone will notice" into "the build stops".
 *
 * Copied identically into each repository.
 */

import { readFileSync, writeFileSync } from "node:fs";

export type Blocks = Record<string, string>;

const open = (name: string) => `<!-- figures:${name} -->`;
const close = (name: string) => `<!-- /figures:${name} -->`;

/** The document with every known block replaced by its freshly computed content. */
export function render(markdown: string, blocks: Blocks): string {
  let out = markdown;
  for (const [name, body] of Object.entries(blocks)) {
    const a = out.indexOf(open(name));
    const b = out.indexOf(close(name));
    if (a === -1 || b === -1 || b < a) {
      throw new Error(`README has no block named "${name}" — add the markers first`);
    }
    out = out.slice(0, a + open(name).length) + "\n" + body.trim() + "\n" + out.slice(b);
  }
  return out;
}

export type Outcome = { path: string; stale: string[]; written: boolean };

/**
 * Write the blocks, or report which ones had drifted.
 *
 * `mode: "check"` never writes. It is what runs in CI, and its exit code is the whole
 * point: a README that disagrees with the code stops the build instead of quietly
 * misinforming whoever reads it.
 */
export function figures(path: string, blocks: Blocks, mode: "write" | "check" = "write"): Outcome {
  const before = readFileSync(path, "utf8");
  const after = render(before, blocks);

  const stale = Object.keys(blocks).filter((name) => {
    const cut = (s: string) => {
      const a = s.indexOf(open(name)) + open(name).length;
      const b = s.indexOf(close(name));
      return s.slice(a, b).trim();
    };
    return cut(before) !== cut(after);
  });

  if (mode === "write" && stale.length > 0) writeFileSync(path, after);
  return { path, stale, written: mode === "write" && stale.length > 0 };
}

/** A markdown table from rows of cells. Kept here so every tool aligns the same way. */
export function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  return [
    line(headers),
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map(line),
  ].join("\n");
}

/**
 * The command-line half, shared by every tool.
 *
 * `npm run figures` rewrites; `npm run figures -- --check` reports and exits non-zero.
 */
export function run(path: string, blocks: Blocks): void {
  const mode = process.argv.includes("--check") ? "check" : "write";
  const result = figures(path, blocks, mode);

  if (result.stale.length === 0) {
    console.log(`${path} is up to date.`);
    return;
  }
  if (mode === "check") {
    console.error(`${path} is stale — these blocks no longer match the code:`);
    for (const name of result.stale) console.error(`  - ${name}`);
    console.error("\nRun: npm run figures");
    process.exit(1);
  }
  console.log(`${path} updated: ${result.stale.join(", ")}`);
}
