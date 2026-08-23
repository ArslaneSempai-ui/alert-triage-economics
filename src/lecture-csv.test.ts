/**
 * WHAT A HOSTILE FILE DOES TO THE READER.
 *
 * `readScoredCases` promises, in as many words, that "every line that cannot be read is
 * reported with its number and a reason". Two faults broke that promise, and every test
 * file this repository had was well-formed — which is exactly why nothing had seen them.
 *
 *   1. Blank lines were removed BEFORE numbering, so the reported number counted non-blank
 *      lines. And the out-of-range pass indexed the already-filtered rows while splicing
 *      them, so each removal shifted every later number by one more. **A reader following
 *      the number looked at the wrong line, and further off the more errors their file
 *      had.**
 *
 *   2. Splitting on `[,;\t]` with no state. A comma inside a quoted cell shifts every
 *      column after it; if the shift happens to land a number where the score is expected,
 *      the file parses, the run succeeds, and the tool reports on a column nobody chose.
 *      A sibling repository lost half its rows to the same shape — seven lines became
 *      three — and then printed "3 cases is below the point where a rate says anything":
 *      it warned that the sample was small **without saying it had made it small.**
 *
 * THE GUARD IS TESTED IN BOTH DIRECTIONS, and the second direction is the one that matters
 * for whether it survives: a guard that bites legitimate use is removed at the first
 * complaint. So a correctly escaped comma must still parse, and its value must come out
 * intact.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readScoredCases } from "./calibrate.ts";

test("the reported line number is the line number in the file", () => {
  /* Blank lines at 2 and 5, a bad score at 4, an unreadable outcome at 6. */
  const csv = [
    "score,outcome",      // 1
    "",                   // 2
    "0.9,true",           // 3
    "not-a-number,true",  // 4
    "",                   // 5
    "0.7,perhaps",        // 6
    "0.5,false",          // 7
  ].join("\n");

  const { rows, ignored } = readScoredCases(csv);

  assert.equal(rows.length, 2, "the two readable rows are kept");
  assert.deepEqual(ignored.map((i) => i.line), [4, 6],
    "the numbers are the file's own lines, blank lines included in the count");
});

test("an out-of-range score is reported against its own line, not its position after filtering", () => {
  /* Three out-of-range values: each splice used to shift the numbers of the ones after. */
  const csv = [
    "score,outcome",  // 1
    "0.5,true",       // 2
    "-1,true",        // 3
    "0.6,false",      // 4
    "-2,false",       // 5
    "0.7,true",       // 6
    "-3,true",        // 7
  ].join("\n");

  const { rows, ignored } = readScoredCases(csv);

  assert.equal(rows.length, 3);
  assert.deepEqual(ignored.map((i) => i.line), [3, 5, 7],
    "each rejected score names its own file line; the previous version drifted by one more "
    + "with every removal");
});

test("a comma inside a quoted cell does not shift the columns", () => {
  /* The legitimate case. If this fails the guard bites real files and gets deleted. */
  const csv = [
    'score,note,outcome',
    '0.82,"reviewed, escalated",true',
    '0.10,"cleared, no action",false',
  ].join("\n");

  const { rows, ignored } = readScoredCases(csv);

  assert.deepEqual(ignored, [], "a correctly quoted comma is not an error");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.score, 0.82, "the score column is still the score column");
  assert.equal(rows[0]!.truePositive, true);
  assert.equal(rows[1]!.truePositive, false);
});

test("a doubled quote inside a quoted cell is a literal quote", () => {
  const csv = ['score,note,outcome', '0.44,"he said ""maybe""",true'].join("\n");
  const { rows, ignored } = readScoredCases(csv);
  assert.deepEqual(ignored, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.score, 0.44);
});

test("an unterminated quote is refused by name, with the escape spelled out", () => {
  const csv = [
    "score,outcome",       // 1
    "0.9,true",            // 2
    '0.5,"never closed',   // 3
    "0.4,false",           // 4
  ].join("\n");

  const { rows, ignored } = readScoredCases(csv);

  assert.equal(rows.length, 2, "the readable lines are still read: one bad line is not a bad file");
  assert.equal(ignored.length, 1);
  assert.equal(ignored[0]!.line, 3, "the refusal names the line — unusable otherwise on five thousand");
  assert.match(ignored[0]!.reason, /unterminated quote/);
  assert.match(ignored[0]!.reason, /""/,
    "the message says how to write a literal quote: a refusal a reader cannot act on is "
    + "worked around by deleting the guard");
});

test("a file of nothing but blank lines yields nothing, and says nothing false", () => {
  const { rows, ignored, rescaled } = readScoredCases("\n\n   \n\n");
  assert.deepEqual(rows, []);
  assert.deepEqual(ignored, []);
  assert.equal(rescaled, false);
});

test("a file with no header is read as data from its first line", () => {
  const csv = ["0.9,true", "0.2,false"].join("\n");
  const { rows } = readScoredCases(csv);
  assert.equal(rows.length, 2, "no header means the first line is a case, not a discarded title");
});
