/**
 * The regulations these tools cite, and where each figure came from.
 *
 * Until now the procedures were fictional and the clauses invented — `PR-101 §5` was a
 * label I made up so that decisions would cite *something*. That was honest as far as it
 * went, and it went nowhere: a reader could not check a single one.
 *
 * Every entry below was retrieved from the source on the date recorded, and the quoted
 * text is what the section actually says. **Nothing is cited from memory.** A rule I did
 * not open does not appear here, however confident I might feel about it — a portfolio
 * whose whole argument is "an automated decision must be defensible" cannot rest its own
 * citations on recollection.
 *
 * The verbatim quotes are short and are reproduced for identification. They are public
 * United States regulation.
 *
 * Copied identically into each repository.
 */

export type Regulation = {
  /** The citation a reader can look up, e.g. "31 CFR 1020.320(b)(3)". */
  cite: string;
  /** Short title, for a screen that has no room for the full citation. */
  short: string;
  /** What the section requires, in the tool's own words. */
  says: string;
  /** The operative figure, where there is one. */
  figure?: string;
  /** Exact words from the section, kept short and used for identification. */
  quote?: string;
  source: string;
  /** When it was retrieved. A regulation cited without a date is a regulation cited from memory. */
  retrieved: string;
};

/*
 * PAS DE DATE PARTAGÉE. Chaque entrée porte la sienne, en clair.
 *
 * Les neuf premières ont été relevées le même jour et se partageaient une constante. La
 * dixième prouve que la constante est un piège pour toutes les suivantes : écrite comme ses
 * voisines, elle aurait annoncé un relevé du 17 août pour une source ouverte le 24 — et le
 * contrôle qui garde ce champ ne vérifie que le FORMAT, donc il l'aurait validée.
 *
 * Ce fichier interdit de citer de mémoire. **Une date fausse est pire qu'une date absente :
 * l'absence se voit, la fausseté se fait valider.** Un champ qui atteste d'un acte — relevé
 * le, mesuré le, vérifié par — ne se factorise pas.
 */

export const REGULATIONS = {
  /* ── Suspicious activity reporting ─────────────────────────────── */

  sarThreshold: {
    cite: "31 CFR 1020.320(a)(2)",
    short: "SAR threshold",
    says: "A bank must report a suspicious transaction conducted or attempted by, at or through it once the amount involved or aggregated reaches the threshold.",
    figure: "$5,000",
    quote: "it involves or aggregates at least $5,000",
    source: "https://www.law.cornell.edu/cfr/text/31/1020.320",
    retrieved: "2026-08-17",
  },

  sarDeadline: {
    cite: "31 CFR 1020.320(b)(3)",
    short: "SAR deadline",
    says: "The report is due within thirty calendar days of initial detection. Where no suspect has been identified the bank may take a further thirty days, and never more than sixty in total.",
    figure: "30 days, 60 maximum",
    quote: "no later than 30 calendar days after the date of initial detection",
    source: "https://www.law.cornell.edu/cfr/text/31/1020.320",
    retrieved: "2026-08-17",
  },

  sarRetention: {
    cite: "31 CFR 1020.320(d)",
    short: "SAR retention",
    says: "The bank keeps a copy of the report and its supporting documentation for five years from the filing date.",
    figure: "5 years",
    quote: "for a period of five years from the date of filing the SAR",
    source: "https://www.law.cornell.edu/cfr/text/31/1020.320",
    retrieved: "2026-08-17",
  },

  /**
   * The prohibition that governs how these tools may display anything at all.
   *
   * It is why the review screen never shows why a file was escalated to anyone outside
   * the function, and why "an indirect hint such as an unexplained block" counts as
   * disclosure. A tool that leaks the existence of a report through its interface breaks
   * this as surely as an employee who says it out loud.
   */
  sarConfidentiality: {
    cite: "31 CFR 1020.320(e)",
    short: "SAR confidentiality",
    says: "Nobody at the bank may disclose a report, or any information that would reveal one exists.",
    quote: "shall disclose a SAR or any information that would reveal the existence of a SAR",
    source: "https://www.law.cornell.edu/cfr/text/31/1020.320",
    retrieved: "2026-08-17",
  },

  /* ── Customer due diligence ────────────────────────────────────── */

  beneficialOwnership: {
    cite: "31 CFR 1010.230(d)(1)",
    short: "beneficial ownership",
    says: "Each individual holding a quarter or more of the equity of a legal entity customer must be identified.",
    figure: "25 %",
    quote: "owns 25 percent or more of the equity interests of a legal entity customer",
    source: "https://www.law.cornell.edu/cfr/text/31/1010.230",
    retrieved: "2026-08-17",
  },

  controlPerson: {
    cite: "31 CFR 1010.230(d)(2)",
    short: "control person",
    says: "One individual with significant responsibility to control or direct the entity must be identified, in addition to any owners.",
    figure: "1 individual",
    quote: "A single individual with significant responsibility to control, manage, or direct a legal entity customer",
    source: "https://www.law.cornell.edu/cfr/text/31/1010.230",
    retrieved: "2026-08-17",
  },

  identificationTiming: {
    cite: "31 CFR 1010.230(a)",
    short: "identification timing",
    says: "Beneficial owners are identified when the account is opened, not afterwards.",
    quote: "at the time a new account is opened",
    source: "https://www.law.cornell.edu/cfr/text/31/1010.230",
    retrieved: "2026-08-17",
  },

  /* ── Currency transactions ─────────────────────────────────────── */

  currencyReport: {
    cite: "31 CFR 1010.311",
    short: "currency transaction report",
    says: "A currency transaction above the threshold is reported by the financial institution.",
    figure: "$10,000",
    quote: "more than $10,000",
    source: "https://www.law.cornell.edu/cfr/text/31/1010.311",
    retrieved: "2026-08-17",
  },
  /*
   * Why a name-screening system exists at all, and why a regression in one is a
   * compliance event rather than a quality metric.
   *
   * Every other section here is BSA. This one is sanctions, and it is the anchor the
   * regression bench was missing: property that becomes blocked has to be reported inside
   * ten business days. A screener that stops matching a name does not lower a score, it
   * starts a clock nobody knows is running.
   */
  blockedPropertyReport: {
    cite: "31 CFR 501.603(b)(1)",
    short: "blocked property report",
    says: "Property blocked under a sanctions programme is reported to OFAC within ten business days of being blocked.",
    figure: "10 business days",
    quote: "within 10 business days from the date that property becomes blocked",
    source: "https://www.law.cornell.edu/cfr/text/31/501.603",
    retrieved: "2026-08-17",
  },
  /*
   * Ce que la banque doit COLLECTER, et non plus seulement qui identifier et quand.
   *
   * Les neuf entrees ci-dessus disent QUI identifier, QUAND, et fixent des seuils monetaires
   * et des delais. Aucune ne dit QUELLES DONNEES. C'etait le lien manquant pour rattacher les
   * figures d'un extracteur a une obligation : mesurer le nom, la date de naissance, le
   * document et l'adresse n'est pas un choix de produit, c'est ce que le texte exige.
   *
   * Retrouve le 24 aout 2026 a la source. LE PAYS N'Y FIGURE PAS comme donnee propre — il se
   * deduit de l'adresse ou du document — donc il n'est rattache a rien ici. Forcer ce
   * cinquieme lien serait exactement ce que ce fichier existe pour interdire.
   */
  customerIdentification: {
    cite: "31 CFR 1020.220(a)(2)(i)(A)",
    short: "identifying information",
    says: "Before opening an account a bank must obtain, at a minimum, the customer's name, "
      + "date of birth for an individual, address, and identification number.",
    figure: "4 data elements",
    quote: "Name; Date of birth, for an individual; Address; Identification number",
    source: "https://www.law.cornell.edu/cfr/text/31/1020.220",
    retrieved: "2026-08-24",
  },
} as const satisfies Record<string, Regulation>;

export type RegulationKey = keyof typeof REGULATIONS;

/*
 * A view where every entry is a Regulation, optional fields included.
 *
 * `as const` narrows each entry to its literal shape, so an entry without a `figure`
 * has no such property at all and a caller iterating the values cannot read it. Anything
 * walking the whole registry uses this.
 */
export const ALL: Regulation[] = Object.values(REGULATIONS);

/** How a rule cites itself on screen: the reference, then what it requires. */
export function citation(key: RegulationKey): string {
  const r = REGULATIONS[key];
  return `${r.cite} — ${r.says}`;
}

/** The line that lets a reader go and check. */
export function provenance(key: RegulationKey): string {
  const r = REGULATIONS[key];
  return `${r.cite} · ${r.source} · retrieved ${r.retrieved}`;
}
