/**
 * La population d'alertes.
 *
 * Un système de surveillance transactionnelle note chaque opération. Au-dessus d'un
 * seuil, il lève une alerte qu'un analyste doit traiter. Baisser le seuil attrape plus
 * de vrais positifs — et coûte plus cher. Tout le projet consiste à chiffrer ce « plus
 * cher », que personne ne calcule avant de bouger le seuil.
 *
 * Deux choses que les modèles simples ratent, et qui sont les seules qui comptent :
 *
 *   1. Les scores des vrais et des faux positifs **se chevauchent massivement**. Ce n'est
 *      pas un défaut du système, c'est la nature du problème. S'ils se séparaient, le
 *      métier n'existerait pas.
 *
 *   2. Le temps de traitement n'est pas constant. Une alerte franche se classe en
 *      quelques minutes ; une alerte ambiguë prend une heure. Or baisser le seuil ajoute
 *      précisément des alertes ambiguës. Le coût croît donc **plus vite que le volume**,
 *      et un modèle en « coût moyen par alerte » se trompe dans le sens dangereux.
 *
 * Tirage déterministe : sans graine fixe, deux scénarios ne se comparent pas.
 */

export type Alerte = {
  /** Note du moteur de surveillance, de 0 à 1. */
  score: number;
  /** Ce que l'enquête a conclu. Connu ici, inconnu au moment de trier. */
  vraiPositif: boolean;
};

function tirage(graine: number) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1_664_525 + 1_013_904_223) >>> 0;
    return etat / 4_294_967_296;
  };
}

/** Somme de tirages uniformes : une cloche, sans dépendance. */
function normal(r: () => number, moyenne: number, ecart: number): number {
  const s = r() + r() + r() + r() + r() + r() - 3;
  return moyenne + s * ecart;
}

const borne = (x: number) => Math.min(0.999, Math.max(0.001, x));

export type Population = {
  alertes: Alerte[];
  /** Opérations examinées sur la période — sert à ramener les volumes à l'année. */
  operations: number;
  vraisPositifsTotal: number;
};

/**
 * Un an d'opérations pour un établissement de taille moyenne.
 *
 * Les proportions retenues sont celles qu'on observe en pratique : l'écrasante majorité
 * des opérations est parfaitement banale, une poignée mérite un signalement, et les deux
 * populations ne se séparent pas proprement.
 */
export function genererPopulation(
  operations = 400_000,
  partVraisPositifs = 0.0012,
  graine = 20260817,
): Population {
  const r = tirage(graine);
  const alertes: Alerte[] = [];
  let vraisPositifsTotal = 0;

  for (let i = 0; i < operations; i++) {
    const vraiPositif = r() < partVraisPositifs;
    if (vraiPositif) vraisPositifsTotal++;

    // Les vrais positifs notent plus haut en moyenne — mais la queue basse est épaisse,
    // et c'est elle qui rend le choix du seuil douloureux.
    const score = vraiPositif
      ? borne(normal(r, 0.62, 0.20))
      : borne(normal(r, 0.24, 0.16));

    // On ne conserve que ce qui peut un jour franchir un seuil plausible.
    if (score >= 0.30) alertes.push({ score, vraiPositif });
  }

  alertes.sort((a, b) => b.score - a.score);
  return { alertes, operations, vraisPositifsTotal };
}

/**
 * Le temps de traitement d'une alerte, en minutes.
 *
 * Maximal au milieu de l'échelle : une alerte à 0,95 se documente vite, une alerte à
 * 0,35 se classe vite, une alerte à 0,60 mobilise une heure et deux avis. C'est
 * exactement la population qu'on ajoute en baissant le seuil.
 */
export function minutesDeTraitement(
  score: number,
  minimum = 12,
  maximum = 55,
): number {
  const ambiguite = 1 - Math.abs(score - 0.6) / 0.6; // 1 au plus ambigu, 0 aux extrêmes
  return minimum + (maximum - minimum) * Math.max(0, ambiguite);
}
