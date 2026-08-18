/*
 * LES TYPES DE `graphes.js`.
 *
 * Le module est écrit en JavaScript parce qu'il est servi tel quel au navigateur : aucun
 * outil de compilation ne tourne entre le disque et la page. Mais il est aussi importé
 * depuis du TypeScript — la vitrine construit ses figures au moment du build — et sans
 * déclaration, `tsc --noEmit` s'arrête sur un `any` implicite.
 *
 * Ce fichier n'ajoute pas de vérification à l'exécution ; il écrit noir sur blanc ce que
 * chaque fonction accepte. Les tests de `graphes.js`, eux, vérifient l'arithmétique — c'est
 * là que sont attrapées les vraies erreurs, pas ici.
 */

/** Une teinte sémantique. Elle ne porte jamais le sens seule : voir la règle des hachures. */
export type Ton = "accent" | "alerte" | "attention" | "neutre";

export type Etendue = { bas: number; haut: number };

export function etendue(
  valeurs: number[],
  options?: { zero?: boolean; jeu?: number },
): Etendue | null;

export type Serie<P> = {
  /** La valeur d'un point ; `null` coupe le tracé plutôt que d'inventer une continuité. */
  cle: (p: P) => number | null | undefined;
  nom: string;
  ton?: Ton;
  aire?: boolean;
  /** Le format long, celui de l'info-bulle. */
  fmt?: (v: number) => string;
  /** Le format court des graduations, quand `fmt` déborde sur le cran voisin. */
  fmtCran?: (v: number) => string;
  /** `racine` compresse une série qui explose ; l'axe le dit alors en toutes lettres. */
  mode?: "racine";
  /** Inclure le zéro dans l'étendue. Vrai par défaut : une base tronquée exagère les écarts. */
  zero?: boolean;
  /** Lire cette série sur l'axe de la première, quand les deux ont la même unité. */
  partage?: boolean;
};

export type Bande = { de: number; a: number; ton?: Ton; nom?: string };
export type SeuilLigne = { y: number; serie?: number; texte?: string };

export function courbe<P>(o: {
  points: P[];
  x: (p: P) => number;
  series: Serie<P>[];
  marque?: { x: number; texte?: string };
  bandes?: Bande[];
  seuils?: SeuilLigne[];
  fmtX?: (v: number) => string;
  hauteur?: number;
  legende?: boolean;
  aria: string;
}): string;

export type Barre = {
  nom: string;
  valeur: number;
  /** Les bornes d'un intervalle. Dessinées, et lisibles au survol. */
  bas?: number;
  haut?: number;
  ton?: Ton;
  note?: string;
  ici?: boolean;
};

export function barres(o: {
  items: Barre[];
  fmt?: (v: number) => string;
  max?: number;
  repere?: { v: number; texte: string };
  aria: string;
}): string;

export type Part = { valeur: number; nom: string; ton?: Ton };

export function empile(o: {
  items: { nom: string; parts: Part[]; bout?: string }[];
  fmt?: (v: number) => string;
  aria: string;
}): string;

export type Marche = {
  de: number;
  a: number;
  valeur: number;
  ici?: boolean;
  /** Prix nul : un résultat, pas une absence de donnée. Dessinée en accent. */
  gratuite?: boolean;
  /** N'achète rien. Grise. */
  morte?: boolean;
};

export function escalier(o: {
  marches: Marche[];
  fmt?: (v: number) => string;
  fmtX?: (v: number) => string;
  hauteur?: number;
  aria: string;
}): string;

/** Branche les lectures au survol. Sans effet là où aucune figure n'a d'information de plus. */
export function brancher(racine?: ParentNode): void;
