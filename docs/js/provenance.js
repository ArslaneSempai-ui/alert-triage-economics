/**
 * Where a number came from, which is a different question from whether it is right.
 *
 * Every one of these tools puts figures on a page. A reader has no way to tell, looking at
 * a table, whether a number was retrieved from a regulation, produced by running the code,
 * taken as an input nobody can know, or picked by me. Those four have wildly different
 * standing, and a table that renders them in the same typeface quietly claims they are
 * equivalent.
 *
 * They are not, and the ranking is not subtle:
 *
 *   retrieved  — a public source says this, on a date, in words anyone can go and read.
 *                It needs no defence from me at all.
 *   measured   — running the code in this repository produces it. Reproducible by a
 *                stranger with `npm test`; wrong only if the code is wrong.
 *   assumed    — an input nobody here can know: a growth rate, a loaded salary. Editable,
 *                and swept, so the page can say which of them the conclusion survives.
 *   chosen     — my judgement and nothing else. The weakest kind of number in any of
 *                these repositories, and the one most likely to be read as authoritative
 *                because it appears in the same table as the others.
 *
 * The discipline this encodes: **a chosen number must never appear unlabelled**. If it
 * decides an outcome it has to be swept and reported; if it decides nothing it should say
 * so. Neither is possible while it looks exactly like a retrieved one.
 *
 * Copied identically into each repository.
 */
export const ORDER = ["retrieved", "measured", "assumed", "chosen"];
/** What each kind is, and what a reader is entitled to ask of it. */
export const MEANING = {
    retrieved: {
        label: "retrieved",
        means: "a public source says this, on the date recorded, in words linked from the page",
        ask: "follow the link",
    },
    measured: {
        label: "measured",
        means: "running the code in this repository produces it",
        ask: "run it yourself — the draws are seeded",
    },
    assumed: {
        label: "assumed",
        means: "an input nobody here can know; yours to supply",
        ask: "put your own figure in, and read the band around it",
    },
    chosen: {
        label: "chosen",
        means: "my judgement and nothing else",
        ask: "check whether the sweep says it decides anything",
    },
};
export function count(inv) {
    const n = { retrieved: 0, measured: 0, assumed: 0, chosen: 0 };
    for (const f of inv)
        n[f.provenance]++;
    return n;
}
/**
 * The inventory as a README block.
 *
 * Generated rather than written. An inventory of a page's own numbers, typed by hand, goes
 * stale the first time anyone adds a figure — and it goes stale in the flattering
 * direction, because the figure people forget to declare is the one they were least
 * comfortable declaring.
 */
export function markdown(inv, table) {
    const n = count(inv);
    const summary = ORDER.filter((p) => n[p] > 0)
        .map((p) => `**${n[p]} ${MEANING[p].label}**`)
        .join(", ");
    const rows = ORDER.flatMap((p) => inv.filter((f) => f.provenance === p)
        .map((f) => [MEANING[p].label, "`" + f.name + "`", f.what, f.note ?? "—"]));
    return `${summary}. What each kind means, and what you are entitled to ask of it:\n\n` +
        ORDER.filter((p) => n[p] > 0)
            .map((p) => `- **${MEANING[p].label}** — ${MEANING[p].means}. *${MEANING[p].ask}.*`)
            .join("\n") +
        `\n\n${table(["Kind", "Name", "What it is", "Note"], rows)}`;
}
