# What was checked here, and what it cost

Six checks. **Four found something, two resisted, and naming the two is half the report** —
a report that lists only its findings does not let anyone tell a clean repository from an
unexamined one.

---

## Found

### 1. The reported line number was not the line number

`readScoredCases` promises, in as many words, that *every line that cannot be read is
reported with its number and a reason*. **Two faults cumulated, and the second grew as it
went.**

- Blank lines were removed **before** numbering, so `n + 1` counted non-blank lines.
- The out-of-range pass indexed `rows` — already filtered — while `rows.splice()` inside the
  same loop shifted every later index by one more.

A reader following the number looked at the wrong line, **and further off the more errors
their file had**. Anything that removes lines shifts everything after it; this is the same
fault as a comment stripper that collapses a block into a single space, which cost a shared
tool three symptoms from one cause today. The source index is now carried through every
pass.

### 2. Splitting on `[,;\t]` with no state

A comma inside a quoted cell shifts every column after it. If the shift lands a number where
the score is expected, **the file parses, the run succeeds, and the tool reports on a column
nobody chose.**

That is worse than a crash, because a crash is noticed and this returns a plausible number.
A sibling repository lost half its rows to the same shape — seven lines became three — and
then printed *"3 cases is below the point where a rate says anything"*: it warned that the
sample was small **without saying it had made it small**. Here it would not even shrink.

Quotes are honoured, `""` is a literal quote inside a quoted cell, and a line whose quote
never closes is refused **by name**, with the escape spelled out — a refusal a reader cannot
act on is worked around by deleting the guard.

**Seven witnesses, proved in both directions.** Four fail on the old parser and pass on the
new one. The direction that decides whether a guard survives is the second: a correctly
escaped comma must still parse and its score must come out intact, because a guard that
bites legitimate use is removed at the first complaint.

### 3. A comment figure had rusted

`inventory.ts` listed this repository's headline figures as *4,154 alerts, 3 FTE, 81 %
coverage, $1,442 a case*. Three are right. `ASSUMPTIONS.analystsInPost` is **8**, and the
published headline says *1 FTE out of 8*.

It is the comment that argues about what **measured** is allowed to mean — which makes it
the worst place in the repository for a figure that nothing re-derives. Corrected, and it
now says where to check it.

### 4. The citation table was a selection that did not say so

It publishes **5 of the 9** sections in the shared regulations file. The reason is good and
was already written in `inventory.ts` — but it was written for whoever edits the code, and
**the reader saw a table with no hint that it was a subset.**

*A figure that results from a selection carries the count of what was set aside, or it is
not a figure — it is a sample presented as a census.* The count is generated into the block,
so the two numbers cannot drift apart the day a section is added.

---

## Resisted

**Every marker block is generated, and the correspondence is exact in both directions.** Nine
markers in `README.md`, nine keys emitted by `src/readme.ts`: `citations`, `curve`,
`finding`, `headline`, `horizon`, `provenance`, `routes`, `simulation`, `staircase`. No
marker without a generator, no generated key without a marker. `--check` is wired into
`npm test` and was proved both ways: clean exits 0, a falsified count exits 1 naming
`citations`, regeneration returns to clean.

**Fence parity.** `README.md` carries 4 fences, even. No orphan.

**No dead guard.** No constant predicate, no `catch` returning a fixed value, no always-true
condition in the published paths.

**The four shared modules are byte-identical to `cascade`** — `figures.ts`, `interval.ts`,
`provenance.ts`, `cli.ts` — checked md5 for md5 before and after this work, and not touched.

---

## Not mine, and left alone

One test fails: `capturer.mjs` differs from `identite`. `identite`'s copy is **being edited
right now** — its tree shows the file modified. The divergence is in flight, not broken, and
recopying from a tree someone is working in is how a half-written change gets committed by
someone who did not write it.

---

## Verification

    tsc --noEmit                     clean
    node --test src/calibrate.test.ts    11 tests, 11 pass
    node --test src/lecture-csv.test.ts   7 tests,  7 pass
    npm run figures -- --check       up to date, proved both ways

The full `npm test` was not run to completion: it replays the generator, which takes longer
than four minutes on this machine. **That is a result, not an omission** — it is reported
here rather than being left to look like a suite that was run and passed.
