/**
 * Le modèle économique du seuil.
 *
 * Il traduit un réglage de conformité en trois choses qu'un comité comprend : des heures,
 * des personnes, et de l'argent — en face de ce que ça attrape.
 *
 * Le chiffre qui décide n'est aucun des trois. C'est le **coût du vrai positif
 * supplémentaire** : ce que coûte le prochain dossier attrapé quand on baisse encore le
 * seuil. Il explose bien avant que le coût total ne paraisse déraisonnable, et presque
 * personne ne le calcule.
 */

import { genererPopulation, minutesDeTraitement } from "./alertes.ts";
import type { Population } from "./alertes.ts";

export type Hypotheses = {
  /** Heures réellement productives par analyste et par jour. Jamais 8. */
  heuresProductivesParJour: number;
  joursTravaillesParAn: number;
  /** Coût annuel chargé d'un analyste : salaire, charges, poste, encadrement. */
  coutChargeParAnalyste: number;
  /** Délai maximal de traitement d'une alerte, en jours ouvrés. */
  delaiMaxJours: number;
  /** Effectif réellement en poste.0 = on dimensionne sans contrainte. */
  effectifActuel: number;
};

export const HYPOTHESES: Hypotheses = {
  heuresProductivesParJour: 6,
  joursTravaillesParAn: 220,
  coutChargeParAnalyste: 62_000,
  delaiMaxJours: 5,
  effectifActuel: 8,
};

export type Point = {
  seuil: number;
  alertes: number;
  vraisPositifsAttrapes: number;
  vraisPositifsManques: number;
  /** Part des alertes qui ne mènent à rien. Le chiffre que tout le monde cite. */
  tauxFauxPositifs: number;
  heures: number;
  /** ETP nécessaires, en continu — utile pour comprendre, impossible à recruter. */
  etpExact: number;
  /** Ce qu'on embauche réellement : des personnes entières. */
  etpEntiers: number;
  /** Recrutements à faire au-delà de l'effectif déjà en poste. */
  recrutements: number;
  coutAnnuel: number;
  /** Coût du vrai positif supplémentaire par rapport au seuil précédent. */
  coutMarginalParVraiPositif: number | null;
  /** Le stock se résorbe-t-il ? Faux dès que la charge atteint 1. */
  fileTient: boolean;
  /** Taux d'occupation. `null` sans effectif : indéfini, pas nul. */
  charge: number | null;
  /** Jours ouvrés d'attente au régime permanent ; null si la file diverge. */
  attenteJours: number | null;
  /** L'attente respecte-t-elle le délai que la procédure promet ? */
  delaiTenu: boolean;
};

const heuresParEtp = (h: Hypotheses) => h.heuresProductivesParJour * h.joursTravaillesParAn;

/**
 * Un seuil, évalué.
 *
 * `capaciteHeures` sert au verdict de file : on regarde si l'effectif en poste absorbe
 * la charge, pas seulement combien il en faudrait.
 */
export function evaluer(pop: Population, seuil: number, h = HYPOTHESES): Omit<Point, "coutMarginalParVraiPositif"> {
  const retenues = pop.alertes.filter((a) => a.score >= seuil);
  const attrapes = retenues.filter((a) => a.vraiPositif).length;
  const minutes = retenues.reduce((s, a) => s + minutesDeTraitement(a.score), 0);
  const heures = minutes / 60;

  const etpExact = heures / heuresParEtp(h);
  const etpEntiers = Math.ceil(etpExact);

  const capaciteHeures = h.effectifActuel * heuresParEtp(h);
  /*
   * Sans effectif, la charge n'est pas un nombre.
   *
   * `Infinity` traversait JSON en `null`, et l'écran affichait « 0 % d'occupation » pour
   * une équipe inexistante et submergée — exactement l'inverse. Une grandeur indéfinie
   * se transporte comme telle, elle ne se déguise pas en zéro.
   */
  const charge: number | null = capaciteHeures === 0 ? null : heures / capaciteHeures;

  /*
   * La file d'attente n'est pas une pente, c'est une falaise.
   *
   * Tant que la charge reste sous 1, le stock se résorbe. À 1, il diverge : chaque
   * journée ajoute plus d'alertes qu'elle n'en traite, et l'attente part à l'infini.
   * Un modèle en « coût par alerte » lisse ce mur et laisse croire qu'une hausse de 10 %
   * du volume coûte 10 % de plus. Elle peut coûter l'échéance réglementaire.
   *
   * L'approximation d'attente ci-dessous vient de la théorie des files : le temps
   * d'attente croît en 1/(1−charge). Elle n'a pas vocation à être exacte, seulement à
   * montrer que la courbe se redresse violemment bien avant 100 % d'occupation.
   */
  /*
   * La file diverge à charge 1, pas à 0,95.
   *
   * Le plafond de 0,95 était un nombre magique de ma part, et il court-circuitait le
   * délai : aucune configuration ne pouvait « se résorber tout en dépassant l'échéance »,
   * ce qui rendait le paramètre de délai décoratif. C'est la promesse faite au régulateur
   * qui doit trancher, pas une constante choisie par celui qui écrit le modèle.
   */
  const fileTient = charge !== null && charge < 1;

  /*
   * L'attente, en jours ouvrés.
   *
   * La première version multipliait par 1/joursTravaillés puis par joursTravaillés — une
   * opération qui s'annule — et livrait des heures sous un nom qui promettait des jours.
   * Le chiffre était faux d'un facteur six et n'était affiché nulle part, ce qui l'avait
   * mis à l'abri de toute vérification.
   */
  const heuresParAlerte = heures / Math.max(retenues.length, 1);
  const attenteJours = fileTient && charge !== null
    ? (charge / (1 - charge)) * heuresParAlerte / h.heuresProductivesParJour
    : null;

  /*
   * Tenir la file et tenir le délai sont deux choses différentes.
   *
   * Une file peut se résorber et mettre malgré tout douze jours quand la procédure en
   * promet cinq. Le paramètre de délai était modifiable à l'écran sans être utilisé
   * nulle part : un réglage qui ne change rien apprend à l'utilisateur à ne pas croire
   * les autres.
   */
  const delaiTenu = attenteJours !== null && attenteJours <= h.delaiMaxJours;

  /*
   * On paie l'effectif en poste, pas l'effectif nécessaire.
   *
   * La première version facturait les ETP comme si l'on recrutait depuis zéro à chaque
   * seuil. C'est faux et ça masque le seul arbitrage intéressant : tant qu'on reste sous
   * l'effectif déjà payé, resserrer la détection ne coûte **rien**. L'organisation a
   * déjà dépensé l'argent ; la question est de savoir si elle s'en sert.
   */
  const effectifPaye = Math.max(h.effectifActuel, etpEntiers);
  const recrutements = Math.max(0, etpEntiers - h.effectifActuel);

  return {
    seuil,
    alertes: retenues.length,
    vraisPositifsAttrapes: attrapes,
    vraisPositifsManques: pop.vraisPositifsTotal - attrapes,
    tauxFauxPositifs: retenues.length === 0 ? 0 : 1 - attrapes / retenues.length,
    heures,
    etpExact,
    etpEntiers,
    recrutements,
    coutAnnuel: effectifPaye * h.coutChargeParAnalyste,
    fileTient,
    charge,
    attenteJours,
    delaiTenu,
  };
}

/** Du plus strict au plus large : on lit la courbe dans le sens où on la parcourt. */
export const SEUILS = [0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35];

export function balayer(pop: Population, seuils = SEUILS, h = HYPOTHESES): Point[] {
  const points = seuils.map((s) => evaluer(pop, s, h));

  return points.map((p, i) => {
    if (i === 0) return { ...p, coutMarginalParVraiPositif: null };
    const precedent = points[i - 1];
    const gagnes = p.vraisPositifsAttrapes - precedent.vraisPositifsAttrapes;
    const surcout = p.coutAnnuel - precedent.coutAnnuel;
    return {
      ...p,
      // Zéro vrai positif gagné pour un surcoût réel : le coût marginal est infini, et
      // c'est une information, pas une division ratée.
      coutMarginalParVraiPositif: gagnes <= 0 ? (surcout > 0 ? Infinity : null) : surcout / gagnes,
    };
  });
}

if (import.meta.filename === process.argv[1]) {
  const pop = genererPopulation();
  const euro = (n: number) => "€" + Math.round(n).toLocaleString("en-GB");

  console.log(`\n${pop.operations.toLocaleString("en-GB")} opérations sur l'année, ${pop.vraisPositifsTotal} vrais positifs à trouver`);
  console.log(`Effectif en poste : ${HYPOTHESES.effectifActuel} analystes\n`);
  console.log("seuil  alertes    heures   ETP  recrut.  coût/an     attrapés  ratés   coût du VP suppl.   file");
  console.log("─".repeat(104));

  for (const p of balayer(pop)) {
    const marginal = p.coutMarginalParVraiPositif === null ? "—"
      : p.coutMarginalParVraiPositif === Infinity ? "aucun gain"
      : p.coutMarginalParVraiPositif === 0 ? "gratuit"
      : euro(p.coutMarginalParVraiPositif);
    console.log(
      `${p.seuil.toFixed(2)}  ${String(p.alertes).padStart(7)}  ${String(Math.round(p.heures)).padStart(8)}` +
      `  ${String(p.etpEntiers).padStart(4)}  ${String(p.recrutements).padStart(7)}  ${euro(p.coutAnnuel).padStart(9)}` +
      `  ${String(p.vraisPositifsAttrapes).padStart(8)}  ${String(p.vraisPositifsManques).padStart(5)}` +
      `  ${marginal.padStart(17)}   ${p.fileTient ? "tient" : "DÉBORDE"}`,
    );
  }
  console.log("\ncoût du VP suppl. = ce que coûte chaque vrai positif gagné en descendant d'un cran\n");
}

/**
 * Le seuil le plus large que l'effectif en poste absorbe réellement.
 *
 * C'est la recommandation que le modèle produit, et elle tient en une phrase : descendre
 * jusque-là ne coûte rien, descendre au-delà casse la file avant de coûter de l'argent.
 *
 * Le point important n'est pas la valeur trouvée — elle dépend des hypothèses — mais le
 * fait qu'elle existe et que personne ne la calcule. Les seuils de détection se règlent
 * en réunion, à l'intuition, sans que quiconque sache combien d'ETP l'organisation a
 * déjà payés et n'utilise pas.
 */
export function recommander(pop: Population, seuils = SEUILS, h = HYPOTHESES) {
  const points = balayer(pop, seuils, h);
  const tenables = points.filter((p) => p.fileTient && p.delaiTenu && p.recrutements === 0);
  if (tenables.length === 0) return null;

  const retenu = tenables[tenables.length - 1];   // le plus large qui tienne
  const actuel = points[0];                        // le plus strict, point de départ

  return {
    seuil: retenu.seuil,
    vraisPositifsGagnes: retenu.vraisPositifsAttrapes - actuel.vraisPositifsAttrapes,
    surcout: retenu.coutAnnuel - actuel.coutAnnuel,
    /** Capacité déjà payée et inutilisée au seuil de départ, en ETP. */
    capaciteDormante: Math.max(0, h.effectifActuel - actuel.etpEntiers),
    couvertureAvant: actuel.vraisPositifsAttrapes / pop.vraisPositifsTotal,
    couvertureApres: retenu.vraisPositifsAttrapes / pop.vraisPositifsTotal,
  };
}
