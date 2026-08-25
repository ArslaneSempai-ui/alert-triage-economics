/* PARTAGÉ — la source de ce fichier est ~/Documents/identite ; les dépôts du portfolio
   en portent une copie identique. Corrigez-le DANS identite, puis recopiez. Corriger une
   copie sur place fait refuser le commit, et le refus arrive après le travail. */
/*
 * LES GRAPHIQUES.
 *
 * Ces outils avaient un défaut que les tableaux cachent bien : ils énoncent des *formes* et
 * ne montrent que des *nombres*. « Le coût du vrai positif suivant reste nul, puis il
 * explose », « l'attente diverge quand la charge approche de 1 », « aucune cohorte ne tombe
 * sur la moyenne » — ce sont trois affirmations sur des courbes, et jusqu'ici il fallait
 * lire douze lignes de tableau pour les vérifier. Une courbe le montre en une seconde.
 *
 * Quatre règles, tenues partout :
 *
 *  1. **Un graphique n'illustre pas, il démontre.** On ne dessine que ce dont la *forme*
 *     porte la conclusion. Redessiner un tableau en barres n'ajoute rien et coûte de la
 *     place. Chaque graphique de ces écrans répond à une question que son tableau ne
 *     répond pas d'un coup d'œil.
 *  2. **Le réglage courant est toujours marqué.** Ces écrans ont des curseurs ; une courbe
 *     qui ne dit pas où l'on se trouve dessus est une décoration. Le repère bouge avec le
 *     curseur, et la courbe entière se redessine quand les hypothèses changent.
 *  3. **Rien qui ne soit dans les données.** Pas de lissage, pas d'interpolation inventée
 *     entre deux points mesurés, pas d'axe tronqué en silence. Une échelle non linéaire est
 *     écrite sur l'axe.
 *  4. **Le dessin n'est jamais le seul porteur.** Chaque figure porte un `aria-label` qui
 *     énonce sa forme en toutes lettres, et le tableau d'origine reste sous la figure.
 *
 * Zéro dépendance, comme le reste : du SVG écrit à la main, dans le repère ci-dessous, mis
 * à l'échelle par le `viewBox`. La page choisit la largeur, le dessin garde ses
 * proportions. Les couleurs viennent de `registre.css` par des classes — changer la palette
 * change les courbes, sans toucher ici.
 *
 * Recopié à l'identique dans chaque dépôt, comme `registre.css` : aucun n'a de dépendance,
 * et chacun doit tourner seul après un clone.
 */

/*
 * LA TRAME.
 *
 * Une zone disqualifiée ne peut pas se signaler par sa seule couleur. « Rouge = mauvais »
 * est une convention occidentale : sur les places chinoises et japonaises le rouge marque
 * la hausse et le vert la baisse, exactement l'inverse. Et sans parler de culture, près
 * d'un homme sur douze ne distingue pas le rouge du vert.
 *
 * Toute bande porte donc trois signaux, dont deux survivent à un tirage en noir et blanc :
 * des hachures, un libellé écrit, et — en renfort seulement — une teinte. Le test tient en
 * une phrase : si la figure passée en niveaux de gris ne dit plus la même chose, elle est
 * fausse.
 */
let compteur = 0;
const trames = (id, classe = "") => `<defs><pattern id="${id}" class="${classe}" width="7" height="7"
  patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" /></pattern></defs>`;

/** Le repère interne. Les marges laissent la place aux graduations. */
const L = 760;
const M = { haut: 18, bas: 34, gauche: 60, droite: 20 };

const ech = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/*
 * ─── LE TEXTE QUI VOYAGE DANS `data-lecture` DOIT ÊTRE ÉCHAPPÉ DEUX FOIS ───
 *
 * `data-lecture` porte du balisage VOULU — `<u>`, `<br>`, `<b>` — et la bulle de survol le
 * rend par `innerHTML`. `ech()` protège donc l'ATTRIBUT, pas le rendu.
 *
 * Et ce sont deux couches, pas une. Le navigateur DÉCODE l'attribut quand `getAttribute` le
 * rend : ce qui a été écrit `&lt;img src=x onerror=…&gt;` revient `<img src=x onerror=…>`,
 * et `innerHTML` l'exécute. Un nom de champ fourni par le client traverse ainsi intact.
 *
 * Signalé par CodeQL sur le dépôt public — « DOM text reinterpreted as HTML », gravité haute,
 * ouverte et jamais lue. Vérifié en rejouant l'aller-retour plutôt qu'en le supposant : la
 * balise du client ressort du `getAttribute` telle quelle.
 *
 * `echLecture` échappe UNE FOIS DE PLUS les valeurs dynamiques. Après le `ech()` de
 * l'attribut, elles reviennent du `getAttribute` sous leur forme échappée, donc `innerHTML`
 * les rend comme du TEXTE — pendant que les balises de structure, elles, restent des balises.
 */
/*
 * UNE PASSE, PAS DEUX — MESURÉ DANS UN VRAI NAVIGATEUR LE 25 AOÛT 2026.
 *
 * La correction de la XSS avait mis DEUX `ech` ici. Elle ferme bien la faille, et elle
 * abîme la donnée : la valeur traverse `ech` trois fois en tout — deux ici, une par
 * l'enveloppe de l'attribut — alors que le trajet n'en défait que deux (le navigateur
 * décode l'attribut au parsing, puis `innerHTML` décode en interprétant le balisage).
 *
 * Les trois formes, éprouvées côte à côte dans Chrome sur le trajet complet — attribut,
 * `getAttribute`, `innerHTML` — et non simulées :
 *
 *              « Smith & Co »        « a<b »   « <img src=x onerror=…> »
 *   aucun      Smith & Co            « a »     ÉLÉMENT CRÉÉ — la faille
 *   UNE        Smith & Co            a<b       texte inerte
 *   deux       Smith &amp; Co        a&lt;b    texte inerte
 *
 * Une passe est donc la seule qui soit à la fois SÛRE et FIDÈLE. Deux passes affichaient
 * « Smith &amp; Co » à un client dont un champ contient une esperluette — et un nom de
 * société en contient souvent une.
 *
 * Le nom reste `echLecture` bien qu'il ne fasse plus qu'appeler `ech` : il dit à quel
 * endroit du trajet on se trouve, et une garde dérive les sites de ce fichier en le
 * cherchant. Le renommer rendrait cette garde aveugle.
 */
const echLecture = (t) => ech(t);
const fini = (v) => typeof v === "number" && Number.isFinite(v);
const arr = (n) => Math.round(n * 100) / 100;

/**
 * L'étendue d'un axe.
 *
 * Le zéro est inclus par défaut : sur ces écrans les séries sont des coûts, des effectifs
 * et des comptages, et une base tronquée y exagère les écarts — c'est le mensonge le plus
 * courant du graphique d'entreprise, et il n'a pas sa place sur une page qui se réclame de
 * la vérification.
 */
export function etendue(valeurs, { zero = true, jeu = 0.08 } = {}) {
  const f = valeurs.filter(fini);
  if (!f.length) return null;
  let bas = Math.min(...f), haut = Math.max(...f);
  if (zero) { bas = Math.min(0, bas); haut = Math.max(0, haut); }
  if (haut === bas) haut = bas + (Math.abs(bas) || 1);
  const d = (haut - bas) * jeu;
  return { bas: bas < 0 ? bas - d : bas, haut: haut + d };
}

/** Transformation valeur → ordonnée, éventuellement en racine pour les séries qui explosent. */
function verticale(e, hauteur, mode) {
  const bas = M.haut, plage = hauteur - M.haut - M.bas;
  const p = mode === "racine"
    ? (v) => Math.sqrt(Math.max(0, v - e.bas)) / (Math.sqrt(e.haut - e.bas) || 1)
    : (v) => (v - e.bas) / ((e.haut - e.bas) || 1);
  return (v) => arr(bas + plage - p(v) * plage);
}

/** Graduations « rondes » : on préfère 0 / 2 500 / 5 000 à 0 / 2 317 / 4 634. */
function crans(e, n = 3, mode) {
  if (mode === "racine") {
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      out.push(e.bas + (e.haut - e.bas) * f * f);
    }
    return out;
  }
  const plage = e.haut - e.bas;
  if (!(plage > 0)) return [e.bas, e.haut];
  /*
   * On prend le pas dont le nombre de crans tombe le plus près de `n`, pas le premier plus
   * grand que l'écart moyen : ce dernier surestime systématiquement et laissait une figure
   * d'étendue 0 à 8,6 graduée « 0 » et « 5 », deux crans pour toute la hauteur. Le 2,5 est
   * pénalisé d'un cran entier pour que 0/2/4/6/8 l'emporte sur 0/2,5/5/7,5 à égalité.
   */
  const magnitude = Math.pow(10, Math.floor(Math.log10(plage / n)));
  let pas = plage / (n - 1), mieux = Infinity;
  for (const [m, penalite] of [[1, 0], [2, 0], [5, 0], [10, 0], [2.5, 1]]) {
    const candidat = m * magnitude;
    const combien = Math.floor(e.haut / candidat) - Math.ceil(e.bas / candidat) + 1;
    if (combien < 2) continue;
    const ecart = Math.abs(combien - n) + penalite;
    if (ecart < mieux) { mieux = ecart; pas = candidat; }
  }
  const out = [];
  for (let v = Math.ceil(e.bas / pas) * pas; v <= e.haut + 1e-9; v += pas) out.push(arr(v));
  return out.length >= 2 ? out : [e.bas, e.haut];
}

/** Un tracé qui se coupe proprement là où la série n'a pas de valeur. */
function chemin(pts) {
  let d = "", ouvert = false;
  for (const p of pts) {
    if (p === null) { ouvert = false; continue; }
    d += `${ouvert ? "L" : "M"}${p[0]} ${p[1]}`;
    ouvert = true;
  }
  return d;
}

/**
 * LA COURBE.
 *
 * Un axe des abscisses partagé, une ou deux séries, un repère vertical sur le réglage
 * courant, des bandes pour les zones disqualifiées (file qui déborde, délai dépassé) et des
 * lignes de seuil horizontales.
 *
 * @param {object} o
 * @param {any[]} o.points        Les points, croissants en x.
 * @param {(p:any)=>number} o.x   L'abscisse d'un point.
 * @param {Array<{cle:(p:any)=>number|null, nom:string, ton?:string, aire?:boolean, fmt?:(v:number)=>string, mode?:string}>} o.series
 *   Une ou deux séries. La seconde est lue sur l'axe de droite.
 * @param {{x:number, texte?:string}} [o.marque]  Le « vous êtes ici ».
 * @param {Array<{de:number, a:number, ton?:string, nom?:string}>} [o.bandes]
 * @param {Array<{y:number, serie?:number, texte?:string}>} [o.seuils]
 * @param {(v:number)=>string} [o.fmtX]
 * `fmtCran` formate les graduations quand `fmt` est trop long pour un axe : « $496k »
 * sur le cran, « $496,000 » dans l'info-bulle.
 * @param {number} [o.hauteur]
 * @param {string} o.aria         La forme, en toutes lettres.
 */
export function courbe({
  points, x, series, marque, bandes = [], seuils = [], fmtX = String,
  hauteur = 250, aria, legende = true,
}) {
  if (!points || points.length < 2 || !series?.length) return "";
  const deux = series.length > 1;
  const droite = deux && !series[1].partage ? 60 : M.droite;
  const xs = points.map(x);
  const eX = { bas: Math.min(...xs), haut: Math.max(...xs) };
  const px = (v) => arr(M.gauche + ((v - eX.bas) / ((eX.haut - eX.bas) || 1)) * (L - M.gauche - droite));

  /*
   * Deux séries, un ou deux axes.
   *
   * `partage` met la seconde série sur l'axe de la première. C'est le cas quand les deux
   * mesurent la même chose dans la même unité — un effectif nécessaire contre un effectif
   * en poste, par exemple — et les mettre sur deux axes séparés y serait un mensonge :
   * elles se croisent, et le croisement *est* le résultat.
   */
  const axes = series.map((s, i) => {
    const vals = (s.partage && i ? [...points.map(series[0].cle), ...points.map(s.cle)] : points.map(s.cle)).filter(fini);
    return { e: etendue(vals, { zero: s.zero !== false }), mode: s.mode, partage: !!s.partage && i > 0 };
  });
  if (axes.some((a) => a.partage)) {
    const tous = series.flatMap((s) => points.map(s.cle)).filter(fini);
    const commune = etendue(tous, { zero: series[0].zero !== false });
    axes.forEach((a) => { a.e = commune; });
  }
  if (!axes[0].e) return "";
  const py = axes.map((a) => a.e ? verticale(a.e, hauteur, a.mode) : null);

  const solX = hauteur - M.bas;
  /* Un identifiant par figure : deux `<defs>` du même nom sur une page, c'est du HTML
   * invalide, et `url(#…)` ne résoudrait que le premier. */
  const idTrame = `tr${++compteur}`;
  let svg = bandes.length ? trames(idTrame) : "";

  /*
   * Les bandes passent par-dessus, en voile.
   *
   * Dessinées en fond elles disparaissaient sous l'aire de la première série — la zone
   * disqualifiée était donc invisible sur la seule figure où elle compte. Un voile
   * translucide laisse voir la courbe *et* dit que ce réglage n'est pas au choix.
   */
  let voile = "";
  for (const b of bandes) {
    const g = px(b.de), d = px(b.a);
    if (d <= g) continue;
    voile += `<rect class="bande ${b.ton ? "t-" + b.ton : ""}" x="${g}" y="${M.haut}" width="${arr(d - g)}" height="${arr(solX - M.haut)}" />`
      + `<rect class="hachure" fill="url(#${idTrame})" x="${g}" y="${M.haut}" width="${arr(d - g)}" height="${arr(solX - M.haut)}" />`;
    /* L'intitulé se pose au pied de la bande, pas en tête : le haut d'une figure est
     * l'endroit où passent les courbes qui saturent, et l'étiquette y tombait pile sur
     * la ligne de justesse. Le bas d'une aire est un aplat — on y lit toujours. */
    /* Le libellé n'est pas optionnel : c'est le seul des trois signaux qui dise *quoi*. */
    if (b.nom) voile += `<text class="etiq-bande" x="${arr(g + 7)}" y="${arr(solX - 8)}">${ech(b.nom)}</text>`;
  }

  /*
   * Graduations, teintées à la couleur de leur série quand il y a deux axes.
   *
   * Sans ça, une figure qui portait l'attente à gauche (0 à 5,5 jours) et la charge à droite
   * (0 à 4,5) affichait « 0 / 2 / 4 » des deux côtés : deux échelles différentes, des
   * nombres identiques, et rien pour dire laquelle appartient à quelle courbe. La couleur
   * le dit sans une ligne de légende de plus.
   */
  const deuxAxes = deux && axes[1].e && !axes[1].partage;
  const teinte = (i) => deuxAxes ? " " + (series[i].ton ? "t-" + series[i].ton : "t-accent") : "";
  for (const c of crans(axes[0].e, 4, axes[0].mode)) {
    const y = py[0](c);
    if (y < M.haut - 1 || y > solX + 1) continue;
    svg += `<line class="grille" x1="${M.gauche}" y1="${y}" x2="${L - droite}" y2="${y}" />`
      + `<text class="grad${teinte(0)}" x="${M.gauche - 8}" y="${arr(y + 4)}" text-anchor="end">${ech((series[0].fmtCran || series[0].fmt || String)(c))}</text>`;
  }
  if (deuxAxes) {
    for (const c of crans(axes[1].e, 4, axes[1].mode)) {
      const y = py[1](c);
      if (y < M.haut - 1 || y > solX + 1) continue;
      svg += `<text class="grad droite${teinte(1)}" x="${L - droite + 8}" y="${arr(y + 4)}">${ech((series[1].fmtCran || series[1].fmt || String)(c))}</text>`;
    }
  }

  // Les seuils de référence : une ligne tiretée et son intitulé.
  for (const s of seuils) {
    const f = py[s.serie ?? 0];
    if (!f) continue;
    const y = f(s.y);
    if (y < M.haut - 1 || y > solX + 1) continue;
    svg += `<line class="seuil-ligne" x1="${M.gauche}" y1="${y}" x2="${L - droite}" y2="${y}" />`;
    if (s.texte) svg += `<text class="etiq-seuil" x="${L - droite - 4}" y="${arr(y - 6)}" text-anchor="end">${ech(s.texte)}</text>`;
  }

  // Les séries.
  series.forEach((s, i) => {
    if (!axes[i].e) return;
    const f = py[i];
    const pts = points.map((p) => {
      const v = s.cle(p);
      return fini(v) ? [px(x(p)), f(v)] : null;
    });
    const ton = s.ton ? " t-" + s.ton : "";
    if (s.aire) {
      const pleins = pts.filter(Boolean);
      if (pleins.length > 1) {
        svg += `<path class="aire${ton}" d="${chemin(pts)}L${pleins[pleins.length - 1][0]} ${solX}L${pleins[0][0]} ${solX}Z" />`;
      }
    }
    /* `pathLength="1"` normalise la longueur du tracé : l'animation d'apparition l'écrit
     * en `stroke-dasharray: 1`, et sans cette normalisation « 1 » vaudrait une unité du
     * repère — la courbe sortirait en pointillés au lieu de se tracer. */
    svg += `<path class="trace${ton}${i ? " secondaire" : ""}" pathLength="1" d="${chemin(pts)}" />`;
    // Les points : ces séries ont dix à quinze mesures, pas dix mille. Chacune est une
    // exécution du modèle et mérite d'être visible en tant que telle.
    if (points.length <= 24) {
      for (const p of pts) if (p) svg += `<circle class="point${ton}" cx="${p[0]}" cy="${p[1]}" r="3" />`;
    }
  });

  svg += voile;

  // Le « vous êtes ici ».
  if (marque && fini(marque.x)) {
    const mx = px(marque.x);
    svg += `<line class="repere" x1="${mx}" y1="${M.haut - 4}" x2="${mx}" y2="${solX}" />`;
    const v0 = series[0].cle(points.find((p) => Math.abs(x(p) - marque.x) < 1e-9) ?? {});
    if (fini(v0)) svg += `<circle class="point-actif" cx="${mx}" cy="${py[0](v0)}" r="5" />`;
    if (marque.texte) {
      const ancre = mx > L - droite - 90 ? "end" : "start";
      svg += `<text class="etiq-repere" x="${arr(ancre === "end" ? mx - 6 : mx + 6)}" y="${M.haut + 2}" text-anchor="${ancre}">${ech(marque.texte)}</text>`;
    }
  }

  // Le sol et les abscisses.
  svg += `<line class="sol" x1="${M.gauche}" y1="${solX}" x2="${L - droite}" y2="${solX}" />`;
  const saut = Math.ceil(points.length / 9);
  points.forEach((p, i) => {
    if (i % saut && i !== points.length - 1) return;
    svg += `<text class="grad" x="${px(x(p))}" y="${solX + 18}" text-anchor="middle">${ech(fmtX(x(p)))}</text>`;
  });

  // Les cibles de survol : une bande par point, sur toute la hauteur.
  const pas = (L - M.gauche - droite) / (points.length - 1);
  points.forEach((p, i) => {
    const c = px(x(p));
    const infos = series.map((s) => {
      const v = s.cle(p);
      return `<b>${ech(s.nom)}</b> ${ech(fini(v) ? (s.fmt || String)(v) : "—")}`;
    }).join("<br>");
    svg += `<rect class="cible" x="${arr(c - pas / 2)}" y="${M.haut}" width="${arr(pas)}" height="${arr(solX - M.haut)}"`
      + ` data-lecture="${ech(`<u>${echLecture(fmtX(x(p)))}</u><br>${echLecture(infos)}`)}" />`;
  });

  const leg = legende && deux
    ? `<div class="legende">${series.map((s) => `<span class="cle${s.ton ? " t-" + s.ton : ""}">${ech(s.nom)}</span>`).join("")}</div>`
    : "";

  return cadre(svg, hauteur, aria) + leg + "</figure>";
}

/*
 * Le cadre commun.
 *
 * Le SVG n'est pas mis à l'échelle avec la page : un `viewBox` étiré réduit les graduations
 * avec la largeur, et sur téléphone elles deviennent illisibles bien avant que la courbe ne
 * devienne inutile. Le dessin garde donc une largeur plancher et défile dans son conteneur
 * — exactement ce que font déjà les tableaux de ces écrans, et le corps de page ne défile
 * jamais horizontalement.
 */
function cadre(svg, hauteur, aria) {
  return `<figure class="graphe"><div class="defile cadre-graphe">
    <svg viewBox="0 0 ${L} ${hauteur}" role="img" aria-label="${ech(aria)}">${svg}</svg>
    <div class="lecture-flottante" hidden></div></div>`;
}

/**
 * LES BARRES.
 *
 * Horizontales, parce que les intitulés de ces écrans sont des phrases (« dossiers repassés
 * deux fois », « canal payant, étape 3 ») et qu'un intitulé vertical ne se lit pas.
 * L'intervalle, quand il existe, est dessiné : sur ces outils l'incertitude est le résultat
 * aussi souvent que la valeur.
 *
 * @param {{items: Array<{nom:string, valeur:number, bas?:number, haut?:number, ton?:string, note?:string, ici?:boolean}>,
 *          fmt?:(v:number)=>string, max?:number, aria:string, repere?:{v:number,texte:string}}} o
 */
export function barres({ items, fmt = String, max, aria, repere }) {
  if (!items?.length) return "";
  const plafond = max ?? Math.max(...items.flatMap((i) => [i.valeur, i.haut ?? 0]).filter(fini)) * 1.02;
  const pc = (v) => `${arr(Math.max(0, Math.min(100, (v / (plafond || 1)) * 100)))}%`;

  const lignes = items.map((i) => {
    const aInter = fini(i.bas) && fini(i.haut);
    const inter = aInter
      ? `<span class="fourchette" style="left:${pc(i.bas)};width:${pc(i.haut - i.bas)}"></span>` : "";
    /*
     * L'info-bulle n'apparaît que si elle a quelque chose de plus à dire.
     *
     * La barre écrit déjà son intitulé, sa valeur et sa note : redire les trois au survol
     * n'ajoute rien et fait du bruit. Les bornes de l'intervalle, elles, sont dessinées
     * sans être écrites nulle part — et sur ces outils elles décident si deux lignes se
     * classent ou non.
     */
    const lecture = aInter
      ? ` data-lecture="${ech(`<u>${echLecture(i.nom)}</u>${echLecture(fmt(i.valeur))}<br><b>[${echLecture(fmt(i.bas))} – ${echLecture(fmt(i.haut))}]</b>`)}"` : "";
    return `<div class="barre-ligne${i.ici ? " ici" : ""}"${lecture}>
      <span class="barre-nom">${ech(i.nom)}</span>
      <span class="barre-piste">
        <span class="barre-plein${i.ton ? " t-" + i.ton : ""}" style="width:${pc(i.valeur)}"></span>${inter}
        ${repere && fini(repere.v) ? `<span class="barre-repere" style="left:${pc(repere.v)}" title="${ech(repere.texte)}"></span>` : ""}
      </span>
      <span class="barre-val">${ech(fmt(i.valeur))}${i.note ? `<span class="barre-note">${ech(i.note)}</span>` : ""}</span>
    </div>`;
  }).join("");

  const note = repere ? `<div class="renvoi barre-legende">${ech(repere.texte)}</div>` : "";
  return `<figure class="graphe barres" role="img" aria-label="${ech(aria)}">${lignes}${note}</figure>`;
}

/**
 * LES BARRES EMPILÉES.
 *
 * Une seule chose à montrer et elle est décisive : la part. Quand 95 % d'un délai est de
 * l'attente, le rapport se voit dans la barre avant d'être lu dans le pourcentage.
 *
 * @param {{items: Array<{nom:string, bout?:string, parts: Array<{valeur:number, nom:string, ton?:string}>}>,
 *          fmt?:(v:number)=>string, aria:string}} o
 */
export function empile({ items, fmt = String, aria }) {
  if (!items?.length) return "";
  const total = Math.max(...items.map((i) => i.parts.reduce((s, p) => s + (fini(p.valeur) ? p.valeur : 0), 0)));
  const lignes = items.map((i) => {
    const segs = i.parts.map((p) => {
      const l = (p.valeur / (total || 1)) * 100;
      /* Sous un dixième de la piste, le chiffre ne tient pas dans le segment et déborde sur
       * le voisin. Le survol natif le donne, et le tableau dessous aussi. */
      return l <= 0 ? "" : `<span class="seg${p.ton ? " t-" + p.ton : ""}" style="width:${arr(l)}%"
        title="${ech(`${p.nom} — ${fmt(p.valeur)}`)}">${l > 10 ? ech(fmt(p.valeur)) : ""}</span>`;
    }).join("");
    /*
     * À droite, la somme — sauf si l'appelant en dit une meilleure.
     *
     * Quand toutes les lignes totalisent la même chose (vingt-deux cas passés à quatre
     * versions), répéter « 22 » quatre fois n'apprend rien : c'est le taux qu'on vient
     * lire. `bout` permet de le mettre là plutôt que de doubler la figure d'une liste.
     */
    const somme = i.parts.reduce((s, p) => s + (fini(p.valeur) ? p.valeur : 0), 0);
    const droite = i.bout ?? fmt(somme);
    return `<div class="barre-ligne"><span class="barre-nom">${ech(i.nom)}</span>
      <span class="barre-piste empilee">${segs}</span>
      <span class="barre-val">${ech(droite)}</span></div>`;
  }).join("");
  const cles = items[0].parts.map((p) => `<span class="cle${p.ton ? " t-" + p.ton : ""}">${ech(p.nom)}</span>`).join("");
  return `<figure class="graphe barres" role="img" aria-label="${ech(aria)}">${lignes}<div class="legende">${cles}</div></figure>`;
}

/**
 * L'ESCALIER.
 *
 * Une fonction en marches, dessinée en marches. C'est la seule figure de ce jeu où
 * l'interpolation serait un mensonge : entre deux marches il n'y a rien à acheter, et une
 * ligne oblique dirait le contraire.
 *
 * `gratuite` marque une marche dont le prix est nul — sur ces outils c'est le résultat, pas
 * une absence de donnée, et elle se dessine en accent. `morte` marque une marche qui
 * n'achète rien : celle-là est grise.
 * @param {{marches: Array<{de:number, a:number, valeur:number, ici?:boolean, gratuite?:boolean, morte?:boolean}>,
 *          fmt?:(v:number)=>string, fmtX?:(v:number)=>string, hauteur?:number, aria:string,
 *          nomX?:string}} o
 */
export function escalier({ marches, fmt = String, fmtX = String, hauteur = 210, aria, choix = false, iciTexte }) {
  if (!marches?.length) return "";
  const xs = marches.flatMap((m) => [m.de, m.a]);
  const eX = { bas: Math.min(...xs), haut: Math.max(...xs) };
  const e = etendue(marches.map((m) => m.valeur));
  if (!e) return "";
  const px = (v) => arr(M.gauche + ((v - eX.bas) / ((eX.haut - eX.bas) || 1)) * (L - M.gauche - M.droite));
  const py = verticale(e, hauteur, null);
  const sol = hauteur - M.bas;

  let svg = "";
  for (const c of crans(e, 4)) {
    const y = py(c);
    if (y < M.haut - 1 || y > sol + 1) continue;
    svg += `<line class="grille" x1="${M.gauche}" y1="${y}" x2="${L - M.droite}" y2="${y}" />`
      + `<text class="grad" x="${M.gauche - 8}" y="${arr(y + 4)}" text-anchor="end">${ech(fmt(c))}</text>`;
  }
  /*
   * La marche retenue se marque sur toute la hauteur.
   *
   * Neuf marches sur dix valent zéro ici — le coût du vrai positif suivant reste nul
   * longtemps, c'est le propos de la figure. Une marche à zéro fait deux pixels de haut :
   * la mettre en avant par sa couleur revenait à ne rien montrer, et la rendre cliquable
   * revenait à demander de viser un trait. La bande marque une *position*, pas une valeur.
   */
  for (const m of marches) {
    if (!m.ici) continue;
    svg += `<rect class="marche-ici" x="${px(m.de)}" y="${M.haut}"
      width="${arr(Math.max(1, px(m.a) - px(m.de)))}" height="${arr(sol - M.haut)}" />`;
    /* Sans mot écrit, une bande teintée se lit comme une valeur de plus. */
    if (iciTexte) {
      svg += `<text class="marche-ici-mot" x="${arr((px(m.de) + px(m.a)) / 2)}" y="${M.haut - 4}"
        text-anchor="middle">${ech(iciTexte)}</text>`;
    }
  }
  for (const m of marches) {
    const g = px(m.de), d = px(m.a), y = py(m.valeur);
    const lecture = ech(`<u>${echLecture(fmtX(m.de))} → ${echLecture(fmtX(m.a))}</u><br>${m.morte ? "—" : echLecture(fmt(m.valeur))}`);
    svg += `<rect class="marche${m.ici ? " ici" : ""}${m.gratuite ? " gratuite" : ""}${m.morte ? " morte" : ""}" x="${g}" y="${y}"
      width="${arr(Math.max(1, d - g))}" height="${arr(Math.max(1, sol - y))}"
      ${choix ? "" : `data-lecture="${lecture}"`} />`;
    svg += `<line class="dessus${m.ici ? " ici" : ""}${m.gratuite ? " gratuite" : ""}${m.morte ? " morte" : ""}" x1="${g}" y1="${y}" x2="${d}" y2="${y}" />`;
  }
  svg += `<line class="sol" x1="${M.gauche}" y1="${sol}" x2="${L - M.droite}" y2="${sol}" />`;

  /* En dernier pour être au-dessus : c'est la colonne entière qui se vise, pas la marche. */
  if (choix) {
    for (const m of marches) {
      svg += `<rect class="marche-zone" x="${px(m.de)}" y="${M.haut}"
        width="${arr(Math.max(1, px(m.a) - px(m.de)))}" height="${arr(sol - M.haut)}"
        data-choix="${m.de}"
        data-lecture="${ech(`<u>${echLecture(fmtX(m.de))} → ${echLecture(fmtX(m.a))}</u><br>${m.morte ? "—" : echLecture(fmt(m.valeur))}`)}" />`;
    }
  }

  const bornes = [...new Set(xs)].sort((a, b) => a - b);
  const saut = Math.ceil(bornes.length / 9);
  bornes.forEach((v, i) => {
    if (i % saut && i !== bornes.length - 1) return;
    svg += `<text class="grad" x="${px(v)}" y="${sol + 18}" text-anchor="middle">${ech(fmtX(v))}</text>`;
  });

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * L'HISTOGRAMME COUPÉ PAR UN SEUIL.
 *
 * Un écran qui annonce « quatre cents dossiers » et n'en montre aucun demande qu'on le
 * croie. Ici la population est dessinée, le seuil est posé dessus comme une ligne, et le
 * curseur la déplace : les dossiers traversent sous les yeux du lecteur.
 *
 * La seconde série — `part` — n'est pas une décoration. C'est ce que le seuil *ne déplace
 * pas* : la part de chaque bande qui part à l'humain quelle que soit la position de la
 * ligne. Sans elle, un lecteur qui tire le curseur d'un bout à l'autre voit deux nombres
 * bouger à peine et conclut que l'outil est cassé.
 *
 * Elle est hachurée, pas seulement colorée : la figure doit tenir en niveaux de gris, et
 * la légende écrit les deux mots en toutes lettres.
 *
 * @param {{bandes: Array<{de:number, a:number, valeur:number, part?:number}>,
 *          seuil?: {v:number, etiquette?:string, avant?:string, apres?:string},
 *          fmt?:(v:number)=>string, fmtX?:(v:number)=>string,
 *          legende?: Array<{texte:string, trame?:boolean}>, hauteur?:number, aria:string}} o
 */
export function histogramme({ bandes, seuil, fmt = String, fmtX = String, legende, hauteur = 232, aria }) {
  if (!bandes?.length) return "";
  const e = etendue(bandes.map((b) => b.valeur));
  if (!e) return "";
  const x0 = bandes[0].de, x1 = bandes[bandes.length - 1].a;
  const px = (v) => arr(M.gauche + ((v - x0) / ((x1 - x0) || 1)) * (L - M.gauche - M.droite));
  const sol = hauteur - M.bas - (legende?.length ? 22 : 0);
  /*
   * Les annotations vivent au-dessus du cadre, jamais dedans.
   *
   * Posées à l'intérieur elles tombaient sur la barre la plus haute — et c'est toujours la
   * plus haute qu'on annote. Deux lignes réservées coûtent trente pixels et suppriment la
   * collision au lieu de l'espérer.
   */
  const dit = seuil && (seuil.etiquette || seuil.avant || seuil.apres) ? 34 : 0;
  const ciel = M.haut + dit;
  const py = (v) => arr(ciel + (1 - v / (e.haut || 1)) * (sol - ciel));
  const id = `tr${++compteur}`;

  let svg = trames(id, "alerte");

  /* La zone sous le seuil, teintée avant les barres : posée après, elle les voilerait. */
  if (seuil && fini(seuil.v)) {
    svg += `<rect class="zone-seuil" x="${px(x0)}" y="${ciel}" width="${arr(px(seuil.v) - px(x0))}"
      height="${arr(sol - ciel)}" />`;
  }
  for (const c of crans(e, 3)) {
    const y = py(c);
    if (y < M.haut - 1 || y > sol + 1) continue;
    svg += `<line class="grille" x1="${M.gauche}" y1="${y}" x2="${L - M.droite}" y2="${y}" />`
      + `<text class="grad" x="${M.gauche - 8}" y="${arr(y + 4)}" text-anchor="end">${ech(fmt(c))}</text>`;
  }

  for (const b of bandes) {
    if (!(b.valeur > 0)) continue;
    const g = px(b.de), d = px(b.a), large = Math.max(1, d - g - 3);
    const y = py(b.valeur);
    /*
     * En mode commande, pas de lecture au survol.
     *
     * La prise couvre le cadre pour que la ligne s'attrape n'importe où ; elle intercepte
     * donc le survol des barres. Laisser les `data-lecture` en place serait promettre une
     * lecture qui ne s'affiche jamais. Ce qu'elles disaient passe dans l'étiquette du
     * seuil, qui, elle, suit la main.
     */
    const lecture = seuil?.saisissable ? "" : ech(`<u>${echLecture(fmtX(b.de))} – ${echLecture(fmtX(b.a))}</u><br>${echLecture(fmt(b.valeur))}`
      + (fini(b.part) ? ` · ${echLecture(fmt(b.part))}` : ""));
    svg += `<rect class="bande-hist" x="${arr(g + 1.5)}" y="${y}" width="${arr(large)}"
      height="${arr(Math.max(1, sol - y))}"${lecture ? ` data-lecture="${lecture}"` : ""} />`;
    if (fini(b.part) && b.part > 0) {
      const h = Math.max(1, sol - py(b.part));
      svg += `<rect class="bande-part" fill="url(#${id})" x="${arr(g + 1.5)}" y="${arr(sol - h)}"
        width="${arr(large)}" height="${arr(h)}" />`;
    }
  }

  svg += `<line class="sol" x1="${M.gauche}" y1="${sol}" x2="${L - M.droite}" y2="${sol}" />`;

  if (seuil && fini(seuil.v)) {
    const x = px(seuil.v);
    svg += `<line class="repere-seuil" x1="${x}" y1="${ciel - 6}" x2="${x}" y2="${sol + 8}" />`;
    if (seuil.etiquette) {
      /* Contre le bord gauche, l'étiquette ancrée à la fin sortirait du cadre. */
      const colle = x - M.gauche < 90;
      svg += `<text class="etiq-seuil" x="${arr(x + (colle ? 8 : -8))}" y="${M.haut + 10}"
        text-anchor="${colle ? "start" : "end"}">${ech(seuil.etiquette)}</text>`;
    }
    if (seuil.avant) svg += `<text class="dit-avant" x="${M.gauche}" y="${M.haut + 27}">${ech(seuil.avant)}</text>`;
    if (seuil.apres) svg += `<text class="dit-apres" x="${L - M.droite}" y="${M.haut + 27}" text-anchor="end">${ech(seuil.apres)}</text>`;
  }

  for (const v of seuil && fini(seuil.v) ? [x0, seuil.v, x1] : [x0, x1]) {
    if (seuil && v !== seuil.v && Math.abs(px(v) - px(seuil.v)) < 42) continue;
    const ancrage = v === x0 ? "start" : v === x1 ? "end" : "middle";
    svg += `<text class="grad" x="${px(v)}" y="${sol + 18}" text-anchor="${ancrage}">${ech(fmtX(v))}</text>`;
  }

  /* La prise, en dernier pour être au-dessus : on attrape la ligne n'importe où dans le
   * cadre, pas sur son trait. */
  if (seuil?.saisissable && fini(seuil.v)) {
    svg += `<rect class="carte-prise" x="${M.gauche}" y="${ciel}" width="${arr(L - M.gauche - M.droite)}"
      height="${arr(sol - ciel)}" data-x0="${x0}" data-x1="${x1}" data-y0="0" data-y1="1" />`;
  }

  if (legende?.length) {
    let x = M.gauche;
    for (const c of legende) {
      svg += `<rect class="cle-hist${c.trame ? " part" : ""}" ${c.trame ? `fill="url(#${id})" ` : ""}x="${x}" y="${hauteur - 21}" width="11" height="9" />`
        + `<text class="grad" x="${x + 17}" y="${hauteur - 13}">${ech(c.texte)}</text>`;
      x += 28 + String(c.texte).length * 6.4;
    }
  }

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * LA GRILLE DES CAS.
 *
 * Un banc de régression existe pour dire qu'un taux qui monte peut cacher un cas qui vient
 * de casser. L'afficher sous forme de taux revient à demander qu'on le croie : il faut
 * cliquer, comparer, lire une liste. Ici chaque cas est une colonne, chaque version une
 * ligne, et une régression devient un trou qui apparaît — visible sans rien lire.
 *
 * Les quatre états ne se distinguent pas par la couleur seule : plein contre vide porte
 * déjà l'essentiel, le contour rouge et le libellé écrit font le reste. La casse et la
 * réparation sont calculées par rapport à la ligne précédente, parce que c'est le passage
 * d'une version à la suivante qui est la nouvelle, pas l'état.
 *
 * Ce que cette figure ne supporte pas : le nombre. À deux mille cas la grille devient une
 * texture et il faut revenir à des listes. L'appelant décide ; la figure ne ment pas pour
 * autant, elle devient seulement illisible, ce qui se voit.
 *
 * @param {{colonnes: Array<string|{nom:string}>,
 *          lignes: Array<{nom:string, cellules:Array<boolean|null>, instables?:boolean[], bout?:string}>,
 *          legende?: Array<{texte:string, etat:string}>, aria:string}} o
 */
export function grille({ colonnes, lignes, legende, aria, choix = false, iciTexte }) {
  if (!colonnes?.length || !lignes?.length) return "";
  const cols = colonnes.map((c) => (typeof c === "string" ? { nom: c } : c));
  const GAUCHE = 122, DROITE = 54, HAUT = 16, LIGNE = 26, CELL = 18;
  const pas = (L - GAUCHE - DROITE) / cols.length;
  const large = Math.max(6, Math.min(26, pas - 4));

  /*
   * La légende est disposée avant de connaître la hauteur, parce qu'elle la décide.
   *
   * À quatre entrées elle tenait sur une ligne ; la cinquième sortait du cadre et se
   * faisait couper au milieu d'un mot. Une légende tronquée est pire qu'une légende
   * absente : elle donne l'illusion d'avoir été lue.
   */
  const RANG_LEG = 18;
  const cles = (legende ?? []).map((c) => ({ ...c, w: 32 + String(c.texte).length * 6.2 }));
  let cx = GAUCHE, rangs = cles.length ? 1 : 0;
  for (const c of cles) {
    if (cx + c.w > L - 12 && cx > GAUCHE) { rangs++; cx = GAUCHE; }
    c.x = cx; c.rang = rangs - 1;
    cx += c.w;
  }
  const hauteur = HAUT + lignes.length * LIGNE + 22 + rangs * RANG_LEG + (rangs ? 6 : 0);

  let svg = "";
  /*
   * La ligne retenue, marquée sur toute la largeur.
   *
   * Quand les lignes *sont* les choix — une version par ligne —, deux listes déroulantes
   * et un bouton posés à côté demandent au lecteur de refaire à la main le lien avec la
   * figure qu'il regarde déjà.
   */
  lignes.forEach((l, i) => {
    if (!l.ici) return;
    const y = HAUT + i * LIGNE;
    svg += `<rect class="grille-ici" x="${GAUCHE - 116}" y="${arr(y - 4)}" width="${arr(L - GAUCHE + 116 - 8)}" height="${CELL + 8}" />`;
    if (iciTexte) {
      svg += `<text class="marche-ici-mot" x="${L - DROITE + 10}" y="${y - 8}">${ech(iciTexte)}</text>`;
    }
  });
  lignes.forEach((l, i) => {
    const y = HAUT + i * LIGNE;
    svg += `<text class="grille-nom${l.ici ? " ici" : ""}" x="${GAUCHE - 10}" y="${y + CELL - 4}" text-anchor="end">${ech(l.nom)}</text>`;
    l.cellules.forEach((v, j) => {
      const avant = i > 0 ? lignes[i - 1].cellules[j] : null;
      /*
       * L'instabilité prime sur le résultat du jour.
       *
       * Un cas qui réussit sept fois sur huit n'est pas un cas qui réussit — et une
       * exécution unique en donne pile-ou-face. Sans cet état, la grille marquait « cassé
       * par cette version » une visite sur huit, sur un cas qui n'avait rien cassé : la
       * confusion exacte que ce banc existe pour lever.
       */
      const etat = l.instables?.[j] ? "instable"
        : v === null ? "vide"
        : v ? (avant === false ? "repare" : "ok")
        : (avant === true ? "casse" : "ko");
      const x = arr(GAUCHE + j * pas + (pas - large) / 2);
      svg += `<rect class="case-${etat}" x="${x}" y="${y}" width="${arr(large)}" height="${CELL}"
        data-lecture="${ech(`<u>${echLecture(cols[j]?.nom ?? j + 1)}</u><br>${echLecture(l.nom)}`)}" />`;
    });
    if (l.bout) {
      svg += `<text class="grille-bout" x="${L - DROITE + 10}" y="${y + CELL - 4}">${ech(l.bout)}</text>`;
    }
  });

  /* Les numéros de colonne, pas les intitulés : « court-01 » à la verticale ne se lit pas,
   * et le nom complet est dans la lecture au survol. Un sur deux quand ils se serrent. */
  const saut = pas < 22 ? 2 : 1;
  const yNum = HAUT + lignes.length * LIGNE + 14;
  cols.forEach((c, j) => {
    if (j % saut && j !== cols.length - 1) return;
    svg += `<text class="grille-num" x="${arr(GAUCHE + j * pas + pas / 2)}" y="${yNum}" text-anchor="middle">${j + 1}</text>`;
  });

  /* En dernier, donc au-dessus : c'est la ligne entière qui se vise, pas une case. */
  if (choix) {
    lignes.forEach((l, i) => {
      if (l.choix === null || l.choix === undefined) return;
      const y = HAUT + i * LIGNE;
      svg += `<rect class="grille-zone" x="${GAUCHE - 116}" y="${arr(y - 4)}"
        width="${arr(L - GAUCHE + 116 - 8)}" height="${CELL + 8}" data-choix="${ech(l.choix)}" />`;
    });
  }

  for (const c of cles) {
    const y = hauteur - 6 - (rangs - c.rang) * RANG_LEG;
    svg += `<rect class="case-${c.etat}" x="${c.x}" y="${y}" width="12" height="10" />`
      + `<text class="grad" x="${c.x + 18}" y="${y + 9}">${ech(c.texte)}</text>`;
  }

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * LES DEUX POPULATIONS.
 *
 * Une barre de décision affichée seule — « 0,84 » — demande qu'on la croie. Ce qui la
 * justifie n'est pas un nombre mais une forme : deux populations posées sur le même axe,
 * et le fait qu'elles se recouvrent. Dans le recouvrement, aucune position ne sépare
 * proprement, et chaque déplacement de la barre échange une erreur contre l'autre.
 *
 * Un point = un cas, pas une densité lissée. Sur vingt-cinq questions, une courbe promet
 * une précision que l'échantillon n'a pas ; des carrés qu'on peut compter disent le
 * plancher en même temps que la forme.
 *
 * @param {{groupes: Array<{nom:string, valeurs:number[], sens?:"haut"|"bas"}>,
 *          seuil?: {v:number, etiquette?:string, avant?:string, apres?:string},
 *          fmtX?:(v:number)=>string, motRecouvrement?:string, aria:string}} o
 */
export function populations({ groupes, seuil, fmtX = String, motRecouvrement, aria }) {
  if (!groupes?.length) return "";
  const toutes = groupes.flatMap((g) => g.valeurs).filter(fini);
  if (!toutes.length) return "";
  const bas = Math.min(...toutes), haut = Math.max(...toutes);
  const marge = (haut - bas) * 0.08 || 0.01;
  const x0 = bas - marge, x1 = haut + marge;
  const NB = 16, CELL = 12, PAS = 14;
  const px = (v) => arr(M.gauche + ((v - x0) / ((x1 - x0) || 1)) * (L - M.gauche - M.droite));
  const colonne = (v) => Math.min(NB - 1, Math.max(0, Math.floor(((v - x0) / ((x1 - x0) || 1)) * NB)));
  const largeCol = (L - M.gauche - M.droite) / NB;

  const piles = groupes.map((g) => {
    const cols = Array.from({ length: NB }, () => 0);
    for (const v of g.valeurs) if (fini(v)) cols[colonne(v)]++;
    return { ...g, cols, plus: Math.max(...cols) };
  });
  const enHaut = piles.filter((p) => p.sens !== "bas");
  const enBas = piles.filter((p) => p.sens === "bas");
  const hHaut = Math.max(1, ...enHaut.map((p) => p.plus));
  const hBas = Math.max(1, ...enBas.map((p) => p.plus));

  const dit = seuil && (seuil.avant || seuil.apres) ? 20 : 0;
  /* Les intitulés de groupe ont leur propre bande. Posés au niveau des carrés, ils
   * tombaient sur la pile la plus haute — et la plus haute est toujours du côté où on
   * veut écrire. Dix-huit pixels réservés valent mieux qu'une collision espérée. */
  const NOM = 18;
  const ciel = M.haut + (seuil?.etiquette ? 16 : 0) + dit + NOM;
  const axe = ciel + hHaut * PAS + 6;
  const sol = axe + hBas * PAS + 6 + NOM;
  const hauteur = sol + 42;

  let svg = "";

  /* Le recouvrement, teinté avant tout le reste : c'est le fond sur lequel se lit la barre. */
  if (piles.length === 2) {
    const a = piles[0].valeurs.filter(fini), b = piles[1].valeurs.filter(fini);
    const g = Math.max(Math.min(...a), Math.min(...b)), d = Math.min(Math.max(...a), Math.max(...b));
    if (d > g) {
      svg += `<rect class="zone-seuil" x="${px(g)}" y="${ciel}" width="${arr(px(d) - px(g))}" height="${arr(sol - ciel)}" />`;
      if (motRecouvrement) {
        svg += `<text class="grad" x="${arr((px(g) + px(d)) / 2)}" y="${sol + 34}" text-anchor="middle">${ech(motRecouvrement)}</text>`;
      }
    }
  }

  for (const p of piles) {
    const versLeBas = p.sens === "bas";
    p.cols.forEach((n, j) => {
      const x = arr(M.gauche + j * largeCol + (largeCol - CELL) / 2);
      for (let k = 0; k < n; k++) {
        const y = versLeBas ? axe + 2 + k * PAS : axe - 2 - (k + 1) * PAS + 2;
        svg += `<rect class="pop${versLeBas ? " bas" : ""}" x="${x}" y="${arr(y)}" width="${CELL}" height="${CELL}" />`;
      }
    });
    const y = versLeBas ? sol - 4 : ciel - 6;
    svg += `<text class="pop-nom${versLeBas ? " bas" : ""}" x="${L - M.droite}" y="${arr(y)}" text-anchor="end">${ech(p.nom)}</text>`;
  }

  svg += `<line class="sol" x1="${M.gauche}" y1="${axe}" x2="${L - M.droite}" y2="${axe}" />`;

  if (seuil && fini(seuil.v)) {
    const x = px(seuil.v);
    svg += `<line class="repere-seuil" x1="${x}" y1="${M.haut + 4}" x2="${x}" y2="${sol + 6}" />`;
    if (seuil.etiquette) {
      const colle = x - M.gauche < 90;
      svg += `<text class="etiq-seuil" x="${arr(x + (colle ? 8 : -8))}" y="${M.haut + 10}"
        text-anchor="${colle ? "start" : "end"}">${ech(seuil.etiquette)}</text>`;
    }
    if (seuil.avant) svg += `<text class="dit-avant" x="${arr(x - 8)}" y="${M.haut + (seuil.etiquette ? 27 : 11)}" text-anchor="end">${ech(seuil.avant)}</text>`;
    if (seuil.apres) svg += `<text class="dit-apres" x="${arr(x + 8)}" y="${M.haut + (seuil.etiquette ? 27 : 11)}">${ech(seuil.apres)}</text>`;
  }

  const marques = [x0, ...(seuil && fini(seuil.v) ? [seuil.v] : []), x1];
  for (const v of marques) {
    if (seuil && fini(seuil.v) && v !== seuil.v && Math.abs(px(v) - px(seuil.v)) < 40) continue;
    const ancrage = v === x0 ? "start" : v === x1 ? "end" : "middle";
    svg += `<text class="grad" x="${px(v)}" y="${sol + 16}" text-anchor="${ancrage}">${ech(fmtX(v))}</text>`;
  }

  /* La prise, en dernier pour être au-dessus : la barre s'attrape n'importe où entre les
   * deux populations qu'elle sépare, pas sur son trait. */
  if (seuil?.saisissable && fini(seuil.v)) {
    svg += `<rect class="carte-prise" x="${M.gauche}" y="${M.haut}" width="${arr(L - M.gauche - M.droite)}"
      height="${arr(sol + 6 - M.haut)}" data-x0="${x0}" data-x1="${x1}" data-y0="0" data-y1="1" />`;
  }

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * LES DEUX SENS.
 *
 * Deux fonctions qui ne veulent pas la même chose, sur le même axe, de part et d'autre du
 * zéro. C'est la figure que la réunion n'a jamais : chacun arrive avec son tableau, et les
 * deux tableaux n'ont pas d'origine commune.
 *
 * Pourquoi pas `barres` : une barre horizontale classique se cale sur le maximum et part
 * toujours du même bord. Une dépense de dix millions y ressemble trait pour trait à un
 * revenu de dix millions — le lecteur voit deux barres dans le même sens dont l'une est une
 * sortie de caisse. Ici le zéro est au milieu, et le sens porte le signe avant que le
 * chiffre soit lu.
 *
 * @param {{items: Array<{nom:string, valeur:number, bas?:number, haut?:number, note?:string, ici?:boolean}>,
 *          fmt?:(v:number)=>string, aria:string, hauteur?:number}} o
 */
export function opposees({ items, fmt = String, aria }) {
  if (!items?.length) return "";
  const vals = items.flatMap((i) => [i.valeur, i.bas, i.haut].filter(fini));
  const ampleur = Math.max(...vals.map(Math.abs), 1);
  const GAUCHE = 176, DROITE = 128, LIGNE = 34, HAUT = 20;
  const large = L - GAUCHE - DROITE;
  const zero = GAUCHE + large / 2;
  const px = (v) => arr(zero + (v / ampleur) * (large / 2) * 0.94);
  const hauteur = HAUT + items.length * LIGNE + 26;

  let svg = "";
  items.forEach((it, i) => {
    const y = HAUT + i * LIGNE;
    const milieu = y + LIGNE / 2 - 4;
    const x = px(it.valeur);
    const de = Math.min(zero, x), a = Math.max(zero, x);
    svg += `<text class="opp-nom${it.ici ? " ici" : ""}" x="${GAUCHE - 12}" y="${milieu + 4}" text-anchor="end">${ech(it.nom)}</text>`;
    svg += `<rect class="opp-barre${it.valeur < 0 ? " sortie" : ""}${it.ici ? " ici" : ""}"
      x="${de}" y="${y + 4}" width="${arr(Math.max(1, a - de))}" height="${LIGNE - 16}"
      data-lecture="${ech(`<u>${echLecture(it.nom)}</u><br>${echLecture(fmt(it.valeur))}`)}" />`;
    if (fini(it.bas) && fini(it.haut)) {
      const g = px(it.bas), d = px(it.haut);
      svg += `<line class="opp-inter" x1="${g}" y1="${milieu}" x2="${d}" y2="${milieu}" />`
        + `<line class="opp-borne" x1="${g}" y1="${milieu - 5}" x2="${g}" y2="${milieu + 5}" />`
        + `<line class="opp-borne" x1="${d}" y1="${milieu - 5}" x2="${d}" y2="${milieu + 5}" />`;
    }
    svg += `<text class="opp-val" x="${L - DROITE + 12}" y="${milieu + 4}">${ech(fmt(it.valeur))}</text>`;
  });
  /* Le zéro par-dessus les barres : c'est la référence, elle ne se laisse pas recouvrir. */
  svg += `<line class="opp-zero" x1="${zero}" y1="${HAUT - 4}" x2="${zero}" y2="${HAUT + items.length * LIGNE + 2}" />`
    + `<text class="grad" x="${zero}" y="${hauteur - 8}" text-anchor="middle">0</text>`;

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * UN AXE, UN POINT DE BASCULE, ET CE QUE CHACUN DÉFEND.
 *
 * Pour une grandeur que personne n'a mesurée. Il n'y a donc **rien à compter** : pas de
 * carrés, pas d'histogramme, pas de nuage — dessiner des points ici ferait passer une
 * croyance pour un relevé. Une bande est ce qu'on peut honnêtement montrer, et la bascule
 * est le seul trait qui vaut quelque chose : elle transforme « combien vaut ce nombre ? »,
 * à quoi personne ne peut répondre, en « est-il au-dessus de ceci ? », à quoi un
 * responsable peut répondre.
 *
 * @param {{bas:number, haut:number, seuil:{v:number, etiquette?:string, avant?:string, apres?:string},
 *          bandes?: Array<{de:number, a:number, nom:string, sens?:"haut"|"bas"}>,
 *          fmtX?:(v:number)=>string, aria:string}} o
 */
export function axe({ bas, haut, seuil, bandes = [], fmtX = String, aria }) {
  if (!(haut > bas)) return "";
  const HAUT = 34, LIGNE = 26;
  const px = (v) => arr(M.gauche + ((v - bas) / (haut - bas)) * (L - M.gauche - M.droite));
  const rangs = Math.max(1, bandes.length);
  const axeY = HAUT + rangs * LIGNE + 12;
  const hauteur = axeY + 46;

  let svg = "";
  bandes.forEach((b, i) => {
    const y = HAUT + i * LIGNE;
    const g = px(Math.max(bas, b.de)), d = px(Math.min(haut, b.a));
    svg += `<rect class="axe-bande${b.sens === "bas" ? " bas" : ""}" x="${g}" y="${y}" width="${arr(Math.max(2, d - g))}" height="${LIGNE - 9}"
      data-lecture="${ech(`<u>${echLecture(b.nom)}</u><br>${echLecture(fmtX(b.de))} – ${echLecture(fmtX(b.a))}`)}" />`;
    /*
     * Où poser l'intitulé, en trois essais successifs et deux échecs.
     *
     * « Du côté où il reste de la place » collait les deux textes de part et d'autre de la
     * bascule, chacun désignant la bande d'en face. « Toujours vers l'extérieur » les
     * poussait hors du cadre, où ils se faisaient couper — « 0,50 % – 1,33 % » s'affichait
     * « 33 % ». Ce qui marche : dans la bande quand elle est assez large, sinon dehors du
     * côté extérieur, et jamais au-delà du cadre.
     */
    const largeurTexte = String(b.nom).length * 6.4;
    const dedans = d - g > largeurTexte + 16;
    const versLaGauche = (b.de + b.a) / 2 < seuil.v;
    const y0 = y + LIGNE - 14;
    if (dedans) {
      svg += `<text class="axe-nom dans${b.sens === "bas" ? " bas" : ""}" x="${arr((g + d) / 2)}" y="${y0}"
        text-anchor="middle">${ech(b.nom)}</text>`;
    } else {
      const x = versLaGauche ? Math.max(M.gauche + largeurTexte, g - 10) : Math.min(L - M.droite - largeurTexte, d + 10);
      svg += `<text class="axe-nom${b.sens === "bas" ? " bas" : ""}" x="${arr(x)}" y="${y0}"
        text-anchor="${versLaGauche ? "end" : "start"}">${ech(b.nom)}</text>`;
    }
  });

  svg += `<line class="sol" x1="${M.gauche}" y1="${axeY}" x2="${L - M.droite}" y2="${axeY}" />`;
  const x = px(seuil.v);
  svg += `<line class="repere-seuil" x1="${x}" y1="${HAUT - 20}" x2="${x}" y2="${axeY + 8}" />`;
  if (seuil.etiquette) {
    const colle = x - M.gauche < 100;
    svg += `<text class="etiq-seuil" x="${arr(x + (colle ? 8 : -8))}" y="${HAUT - 24}"
      text-anchor="${colle ? "start" : "end"}">${ech(seuil.etiquette)}</text>`;
  }
  if (seuil.avant) svg += `<text class="dit-avant" x="${arr(x - 8)}" y="${HAUT - 8}" text-anchor="end">${ech(seuil.avant)}</text>`;
  if (seuil.apres) svg += `<text class="dit-apres" x="${arr(x + 8)}" y="${HAUT - 8}">${ech(seuil.apres)}</text>`;

  for (const v of [bas, seuil.v, haut]) {
    const ancrage = v === bas ? "start" : v === haut ? "end" : "middle";
    svg += `<text class="grad" x="${px(v)}" y="${axeY + 18}" text-anchor="${ancrage}">${ech(fmtX(v))}</text>`;
  }
  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * LA CARTE DE DÉCISION — et c'est une commande, pas une illustration.
 *
 * Une figure qui se contente d'illustrer un nombre déjà écrit à côté est du bruit, même
 * bien dessinée. Celle-ci a le droit d'exister pour deux raisons : elle **explique** — on
 * voit qu'il existe une frontière, et quelle forme elle a — et elle **bouge sous la main** :
 * le lecteur attrape sa propre position et la déplace, tout le reste se recalcule.
 *
 * Le renversement compte. Un curseur en bas de page qui fait frémir des barres en haut
 * demande au lecteur de piloter à l'aveugle une grandeur qu'il ne connaît pas. Ici il pose
 * son établissement sur un territoire et lit la réponse à cet endroit-là. La question passe
 * de « combien vaut ce nombre ? », à quoi personne ne peut répondre, à « de quel côté de
 * cette ligne sommes-nous ? », à quoi un responsable répond en une phrase.
 *
 * L'appelant fournit `verdict(x, y) → boolean` : la carte ne sait rien du modèle, elle
 * l'interroge. Le point est déplacé par `onDeplace`, qui reçoit les coordonnées du monde.
 *
 * @param {{x:{de:number, a:number, nom:string, fmt?:(v:number)=>string},
 *          y:{de:number, a:number, nom:string, fmt?:(v:number)=>string},
 *          verdict:(x:number,y:number)=>boolean, ici:{x:number,y:number},
 *          bande?:{de:number,a:number,nom:string},
 *          cles:{pour:string, contre:string}, aria:string, resolution?:number}} o
 */
export function carte({ x, y, verdict, ici, bande, cles, aria, resolution = 46 }) {
  const G = 78, D = 150, T = 22, B = 46, H = 330;
  const px = (v) => arr(G + ((v - x.de) / ((x.a - x.de) || 1)) * (L - G - D));
  const py = (v) => arr(T + (1 - (v - y.de) / ((y.a - y.de) || 1)) * (H - T - B));
  const fx = x.fmt ?? String, fy = y.fmt ?? String;

  /*
   * Deux territoires et une frontière — pas une grille de tuiles.
   *
   * Premier essai : une case peinte par point d'échantillonnage. Ça se lisait exactement
   * comme une mise en forme conditionnelle de tableur, ce qui est le reproche le plus juste
   * qu'on puisse faire à une figure. Ici la frontière est **suivie** : pour chaque colonne on
   * cherche où le verdict change, et on trace la marche. Le résultat garde les
   * discontinuités — une embauche, un palier — qu'une courbe lissée effacerait, sans
   * ressembler à un quadrillage.
   */
  const pasX = (x.a - x.de) / resolution, nY = Math.round(resolution * 1.6);
  const pasY = (y.a - y.de) / nY;
  const frontiere = [];
  for (let i = 0; i <= resolution; i++) {
    const vx = x.de + Math.min(i, resolution - 0.5) * pasX + pasX / 2;
    let j = 0;
    while (j < nY && verdict(vx, y.de + (j + 0.5) * pasY)) j++;
    frontiere.push({ px: px(x.de + i * pasX), py: py(y.de + j * pasY) });
  }
  const marche = frontiere.map((p, i) =>
    (i === 0 ? `M ${p.px} ${p.py}` : `L ${frontiere[i - 1].px} ${p.py} L ${p.px} ${p.py}`)).join(" ");
  const basY = py(y.de), hautY = py(y.a);

  let svg = `<path class="carte-zone pour" d="${marche} L ${px(x.a)} ${basY} L ${px(x.de)} ${basY} Z" />`
    + `<path class="carte-zone contre" d="${marche} L ${px(x.a)} ${hautY} L ${px(x.de)} ${hautY} Z" />`
    + `<path class="carte-front" fill="none" d="${marche}" />`;
  if (bande) {
    svg += `<rect class="carte-bande" x="${px(bande.de)}" y="${T}" width="${arr(px(bande.a) - px(bande.de))}" height="${H - T - B}" />`
      + `<text class="carte-bande-nom" x="${arr((px(bande.de) + px(bande.a)) / 2)}" y="${T + 14}" text-anchor="middle">${ech(bande.nom)}</text>`;
  }

  /* La zone qui capte le geste couvre exactement le territoire, pas la figure entière. */
  svg += `<rect class="carte-prise" x="${G}" y="${T}" width="${L - G - D}" height="${H - T - B}"
    data-x0="${x.de}" data-x1="${x.a}" data-y0="${y.de}" data-y1="${y.a}" />`;

  svg += `<line class="carte-guide" x1="${px(ici.x)}" y1="${T}" x2="${px(ici.x)}" y2="${H - B}" />`
    + `<line class="carte-guide" x1="${G}" y1="${py(ici.y)}" x2="${L - D}" y2="${py(ici.y)}" />`
    + `<circle class="carte-ici" cx="${px(ici.x)}" cy="${py(ici.y)}" r="7" />`;

  svg += `<text class="carte-cle pour" x="${L - D + 14}" y="${T + 34}">${ech(cles.pour)}</text>`
    + `<text class="carte-cle contre" x="${L - D + 14}" y="${T + 54}">${ech(cles.contre)}</text>`
    + `<text class="carte-prise-mot" x="${L - D + 14}" y="${T + 84}">${ech(cles.geste ?? "")}</text>`;

  for (const v of [x.de, ici.x, x.a]) {
    const a = v === x.de ? "start" : v === x.a ? "end" : "middle";
    svg += `<text class="grad${v === ici.x ? " t-neutre" : ""}" x="${px(v)}" y="${H - B + 18}" text-anchor="${a}">${ech(fx(v))}</text>`;
  }
  for (const v of [y.de, ici.y, y.a]) {
    svg += `<text class="grad${v === ici.y ? " t-neutre" : ""}" x="${G - 8}" y="${py(v) + 4}" text-anchor="end">${ech(fy(v))}</text>`;
  }
  /* Le titre de l'ordonnée se pose en haut à gauche, aligné sur le début du cadre : ancré à
   * droite de la gouttière, un intitulé un peu long sortait de la figure. */
  svg += `<text class="axe-titre" x="${G - 46}" y="${T - 8}" text-anchor="start">${ech(y.nom)}</text>`
    + `<text class="axe-titre" x="${arr((G + L - D) / 2)}" y="${H - 6}" text-anchor="middle">${ech(x.nom)}</text>`;

  return cadre(svg, H, aria) + "</figure>";
}

/**
 * Rendre une carte saisissable.
 *
 * Appelé après chaque rendu, comme `brancher`. Le geste marche à la souris et au doigt ;
 * les flèches du clavier déplacent le point d'un pas, parce qu'une figure qui n'est
 * atteignable qu'à la souris n'est pas une commande pour tout le monde.
 */
export function saisir(racine, onDeplace, courant) {
  const prise = racine.querySelector(".carte-prise");
  if (!prise) return;
  const d = prise.dataset;
  /*
   * Le clavier, et le retour du foyer.
   *
   * Le bloc est réécrit entièrement à chaque déplacement : la prise focalisée disparaît
   * avec lui, et une flèche pressée deux fois de suite ne trouvait plus personne. Le
   * drapeau vit donc sur la racine, qui survit au rendu.
   */
  if (!prise.dataset.branche) {
    prise.setAttribute("tabindex", "0");
    prise.setAttribute("role", "slider");
    prise.addEventListener("focus", () => { racine.dataset.priseFocus = "1"; });
    /* Un noeud retiré du document émet `blur` comme s'il avait été quitté. Effacer le
     * drapeau là-dessus, c'était perdre le foyer à chaque flèche : une figure pilotable au
     * clavier pour un seul appui. On ne l'efface que si la prise est encore en place. */
    prise.addEventListener("blur", () => { if (prise.isConnected) delete racine.dataset.priseFocus; });
  }
  if (courant) {
    /* Un curseur sans nom se lit « slider, 5.4 » : le lecteur d'écran dit la valeur et pas
     * ce qu'elle règle. */
    if (courant.nom) prise.setAttribute("aria-label", courant.nom);
    prise.setAttribute("aria-valuemin", d.x0);
    prise.setAttribute("aria-valuemax", d.x1);
    prise.setAttribute("aria-valuenow", String(Math.round(courant.x * 100) / 100));
  }
  if (racine.dataset.priseFocus === "1") prise.focus({ preventScroll: true });
  if (prise.dataset.branche) return;
  prise.dataset.branche = "1";
  /*
   * Du geste vers le modèle, en passant par la boîte de la prise elle-même.
   *
   * La version précédente convertissait par le viewBox du SVG. C'est juste tant que le
   * cadre n'est pas mis en boîte : dès que le conteneur n'a plus le rapport du viewBox,
   * `preserveAspectRatio` centre le dessin et laisse des marges que ce calcul ignore — un
   * geste au milieu de la figure sortait en butée. La prise couvre exactement l'étendue
   * utile, donc sa propre boîte écran est la conversion, quelle que soit la mise en page.
   */
  const monde = (evt, b) => {
    const part = (u, taille) => Math.min(1, Math.max(0, u / (taille || 1)));
    return {
      x: +d.x0 + part(evt.clientX - b.left, b.width) * (+d.x1 - +d.x0),
      y: +d.y1 - part(evt.clientY - b.top, b.height) * (+d.y1 - +d.y0),
    };
  };
  /*
   * Le geste vit sur la fenêtre, pas sur la prise.
   *
   * Le bloc se réécrit à chaque déplacement : la prise que le doigt tenait est détachée du
   * document au premier mouvement, et avec elle la capture du pointeur. Le glissement
   * mourait après un pixel — pire, la boîte d'un noeud détaché mesure zéro, donc la valeur
   * partait en butée sans rien signaler. On prend donc la géométrie une fois, au moment où
   * le geste commence, et on écoute la fenêtre jusqu'à ce qu'il finisse.
   */
  prise.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const boite = prise.getBoundingClientRect();
    const bouge = (ev) => onDeplace(monde(ev, boite));
    const fini = () => {
      window.removeEventListener("pointermove", bouge);
      for (const f of ["pointerup", "pointercancel"]) window.removeEventListener(f, fini);
      delete racine.dataset.priseTire;
    };
    racine.dataset.priseTire = "1";
    window.addEventListener("pointermove", bouge);
    for (const f of ["pointerup", "pointercancel"]) window.addEventListener(f, fini);
    bouge(e);
  });

  /* Une figure-commande atteignable à la seule souris n'est une commande que pour une
   * partie des lecteurs. Un centième de l'étendue par flèche, un dixième par page. */
  if (!courant) return;
  const [ex, ey] = [+d.x1 - +d.x0, +d.y1 - +d.y0];
  prise.addEventListener("keydown", (e) => {
    const g = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowDown: [0, -0.01], ArrowUp: [0, 0.01],
                PageDown: [-0.1, 0], PageUp: [0.1, 0], Home: [-9, 0], End: [9, 0] }[e.key];
    if (!g) return;
    e.preventDefault();
    /* Qui appuie sur une flèche a le foyer, par définition : on le note ici plutôt que
     * d'attendre l'événement `focus`, qui ne part pas si la fenêtre n'est pas au premier
     * plan — et sans lui la deuxième flèche ne trouvait plus personne. */
    racine.dataset.priseFocus = "1";
    const borne = (v, a, b) => Math.min(Math.max(v, a), b);
    onDeplace({
      x: borne(courant.x + g[0] * ex, +d.x0, +d.x1),
      y: borne((courant.y ?? 0) + g[1] * ey, +d.y0, +d.y1),
    });
  });
}

/**
 * Une part, écrite sans mentir sur le plein.
 *
 * 780 dossiers sur 781 arrondissent à 100 %, et la figure dirait alors qu'aucun ne manque
 * quand il en manque un — sur un écran dont tout le propos est qu'une moyenne cache des
 * cas. Le plein est réservé au plein, le vide au vide.
 */
export function partEcrite(dedans, total) {
  if (!total) return "—";
  if (dedans === total) return "100 %";
  if (dedans === 0) return "0 %";
  return Math.min(99, Math.max(1, Math.round((100 * dedans) / total))) + " %";
}

/**
 * Choisir parmi ce que la figure dessine déjà.
 *
 * Certaines grandeurs ne sont pas continues : un modèle qui a mesuré treize seuils n'a rien
 * mesuré entre deux. Une ligne qu'on tire librement y promettrait une précision que
 * personne n'a. Ici les choix *sont* les formes déjà dessinées — les marches d'un escalier,
 * les cases d'une grille — et le lecteur pose la main dessus.
 *
 * Avantage sur une prise qui couvre le cadre : la lecture au survol survit, puisque c'est
 * le même élément qui la porte.
 */
export function choisir(racine, onChoix, courant) {
  const choix = [...racine.querySelectorAll("[data-choix]")];
  if (!choix.length) return;
  const val = (el) => el.dataset.choix;

  if (!racine.dataset.choixBranche) {
    racine.dataset.choixBranche = "1";
    /* Le glissement se termine n'importe où, y compris hors de la figure. */
    for (const f of ["pointerup", "pointercancel"])
      window.addEventListener(f, () => { delete racine.dataset.choixTire; });
  }

  choix.forEach((el, i) => {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "radio");
    el.setAttribute("aria-checked", String(String(courant) === val(el)));
    /*
     * Le foyer ne se repose que pour le clavier.
     *
     * Il était noté à chaque prise, souris comprise : le bloc se réécrivant après le clic,
     * le nouveau porteur était refocalisé et l'anneau de foyer apparaissait — un état
     * qu'aucun utilisateur à la souris ne produit, et qui se retrouvait dans les films.
     * Les flèches, elles, en ont besoin : sans lui, la deuxième ne trouve plus personne.
     */
    el.addEventListener("blur", () => { if (el.isConnected) delete racine.dataset.choixFoyer; });
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      racine.dataset.choixTire = "1";
      delete racine.dataset.choixFoyer;
      el.dataset.dejaPris = "1";
      onChoix(val(el));
    });
    /*
     * Le clic simple compte aussi.
     *
     * Un pointeur émet `pointerdown` puis `click`, et le bloc n'a pas eu le temps d'être
     * réécrit entre les deux : sans garde, la même marche partait deux fois. Mais une
     * activation qui ne passe pas par un pointeur — un lecteur d'écran, un pilotage de
     * capture — n'émet que `click`, et l'ignorer rendrait la figure inerte pour eux.
     */
    el.addEventListener("click", () => {
      if (el.dataset.dejaPris) { delete el.dataset.dejaPris; return; }
      onChoix(val(el));
    });
    /* Passer la main sur la figure fait défiler les choix, comme sur un clavier de piano. */
    el.addEventListener("pointerenter", () => { if (racine.dataset.choixTire) onChoix(val(el)); });
    el.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChoix(val(el)); return; }
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -99, End: 99 }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      const suivant = choix[Math.min(choix.length - 1, Math.max(0, i + d))];
      racine.dataset.choixFoyer = val(suivant);
      onChoix(val(suivant));
    });
  });

  /* Le bloc est réécrit à chaque choix : le foyer se repose sur le nouveau porteur. */
  const vise = choix.find((el) => val(el) === racine.dataset.choixFoyer);
  if (vise) vise.focus({ preventScroll: true });
}

/**
 * L'AFFECTATION — une ligne, un choix, et l'optimum en regard.
 *
 * Cinq champs, quatre paliers : mille vingt-quatre routages possibles, dont un seul est
 * optimal. Le dire est une phrase ; le montrer demande que le lecteur pose lui-même son
 * affectation et voie ce qu'elle vaut. Chaque case porte la justesse mesurée du couple, la
 * case retenue est pleine, et celle que le modèle choisirait porte un contour — l'écart
 * entre les deux est la figure.
 *
 * Pourquoi pas un tableau colorié : une cellule teintée selon sa valeur est de la mise en
 * forme conditionnelle, elle se lit comme un dégradé et ne se prend pas. Ici la hauteur de
 * la barre dans la case porte la justesse, et la case entière est la commande.
 *
 * Chaque ligne porte sa clé de modèle : c'est elle qui repart dans `data-choix`, sous la
 * forme `ligne~colonne`. L'intitulé affiché peut contenir des espaces — « date of birth » —
 * et le renvoyer obligerait l'appelant à le retraduire, ce qui est une occasion de se
 * tromper pour rien.
 *
 * @param {{lignes: Array<{nom:string, cle?:string, choix:string, optimum?:string,
 *                         cases: Array<{cle:string, valeur:number, indisponible?:boolean}>}>,
 *          colonnes: Array<{nom:string, note?:string}>, fmt?:(v:number)=>string,
 *          motOptimum?:string, aria:string}} o
 */
export function affectation({ lignes, colonnes, fmt = String, motOptimum, aria }) {
  if (!lignes?.length || !colonnes?.length) return "";
  const G = 128, D = 24, T = 52, RANG = 54, ECART = 10;
  const H = T + lignes.length * RANG + 30;
  const large = (L - G - D) / colonnes.length;
  const cellW = large - ECART;

  /*
   * LES EN-TÊTES SE TOUCHAIENT DÈS QU'IL Y AVAIT ASSEZ DE COLONNES.
   *
   * Chaque titre était posé centré, à taille fixe, sans que rien ne regarde s'il tenait. Avec
   * quatre paliers c'était vrai ; avec sept, « SMALL MODEL » et « LARGE MODEL » se
   * chevauchaient de trois pixels — mesuré dans le navigateur, pas déduit d'une capture. Deux
   * mots collés se lisent comme un seul, et c'était sur l'écran de démonstration du produit.
   *
   * La largeur d'un texte SVG ne se connaît qu'une fois rendu, or la figure est construite en
   * chaîne avant d'exister. On l'ESTIME donc, et on estime LARGE — se replier une colonne trop
   * tôt ne coûte qu'une ligne de plus, se replier trop tard remet le chevauchement.
   *
   * Trois recours, dans cet ordre : tenir sur une ligne ; couper à l'espace en deux lignes ;
   * et seulement si ça ne suffit pas, réduire la taille, avec un plancher — un titre illisible
   * ne vaut pas mieux qu'un titre chevauché.
   */
  const TETE = 11.5;            // doit suivre `.graphe .affect-tete` dans registre.css
  const PLANCHER = 9;
  /* Majuscules, plus 0,05em d'interlettrage : ~0,60em par caractère, arrondi vers le haut. */
  const larg = (mot, taille) => mot.length * 0.60 * taille;
  const dispo = cellW - 2;

  let svg = "";
  colonnes.forEach((c, j) => {
    const x = G + j * large + cellW / 2;
    const nom = String(c.nom ?? "");
    let lignesTitre = [nom], taille = TETE;

    if (larg(nom, TETE) > dispo) {
      /* Couper au dernier espace qui équilibre le mieux les deux moitiés. */
      const espaces = [...nom.matchAll(/ /g)].map((m) => m.index);
      if (espaces.length) {
        const coupe = espaces.reduce((meilleur, i) =>
          Math.abs(i - nom.length / 2) < Math.abs(meilleur - nom.length / 2) ? i : meilleur, espaces[0]);
        lignesTitre = [nom.slice(0, coupe), nom.slice(coupe + 1)];
      }
      const pire = Math.max(...lignesTitre.map((t) => larg(t, TETE)));
      if (pire > dispo) taille = Math.max(PLANCHER, TETE * (dispo / pire));
    }

    /* Deux lignes montent d'un cran : la seconde viendrait sinon sur la ligne du prix. */
    const y0 = T - 26 - (lignesTitre.length > 1 ? 11 : 0);
    lignesTitre.forEach((t, k) => {
      const style = taille === TETE ? "" : ` style="font-size:${arr(taille)}px"`;
      svg += `<text class="affect-tete" x="${arr(x)}" y="${arr(y0 + k * 11)}" text-anchor="middle"${style}>${ech(t)}</text>`;
    });
    /* La note — un prix, le plus souvent — se rétrécit aussi. Elle n'a pas d'espace où couper
       proprement (« $587.12 / 1,000 » n'a pas de moitié), donc le seul recours est la taille.
       Sans ça, corriger le titre laissait la ligne du dessous se toucher : le défaut se
       déplaçait d'un cran au lieu d'être réglé. */
    if (c.note) {
      const NOTE = 12;                 // doit suivre `.graphe .grad` dans registre.css
      const nb = String(c.note);
      /* Chiffres et ponctuation, minuscules : ~0,52em par caractère. */
      const besoin = nb.length * 0.52 * NOTE;
      const tn = besoin > dispo ? Math.max(8, NOTE * (dispo / besoin)) : NOTE;
      const style = tn === NOTE ? "" : ` style="font-size:${arr(tn)}px"`;
      svg += `<text class="grad" x="${arr(x)}" y="${T - 10}" text-anchor="middle"${style}>${ech(nb)}</text>`;
    }
  });

  lignes.forEach((l, i) => {
    const y = T + i * RANG;
    const haut = RANG - 16;
    svg += `<text class="affect-nom" x="${G - 12}" y="${arr(y + haut / 2 + 4)}" text-anchor="end">${ech(l.nom)}</text>`;
    l.cases.forEach((c, j) => {
      const x = G + j * large;
      const pris = c.cle === l.choix;
      const opt = c.cle === l.optimum;
      /* La barre dans la case : la justesse se lit à la hauteur, pas à la teinte. */
      const hb = Math.max(1, (c.indisponible ? 0 : c.valeur) * (haut - 4));
      svg += `<rect class="affect-case${pris ? " pris" : ""}" x="${arr(x)}" y="${arr(y)}" width="${arr(cellW)}" height="${haut}" />`
        + `<rect class="affect-barre${pris ? " pris" : ""}" x="${arr(x)}" y="${arr(y + haut - hb)}" width="${arr(cellW)}" height="${arr(hb)}" />`
        + `<text class="affect-val${pris ? " pris" : ""}" x="${arr(x + cellW / 2)}" y="${arr(y + haut / 2 + 4)}" text-anchor="middle">${ech(c.indisponible ? "—" : fmt(c.valeur))}</text>`;
      if (opt) {
        svg += `<rect class="affect-optimum" x="${arr(x)}" y="${arr(y)}" width="${arr(cellW)}" height="${haut}" />`;
      }
    });
  });

  if (motOptimum) {
    svg += `<rect class="affect-optimum" x="${G}" y="${H - 22}" width="26" height="12" />`
      + `<text class="grad" x="${G + 34}" y="${H - 12}">${ech(motOptimum)}</text>`;
  }

  /* En dernier, donc au-dessus : la case entière est la prise. */
  lignes.forEach((l, i) => {
    const y = T + i * RANG;
    l.cases.forEach((c, j) => {
      if (c.indisponible) return;
      svg += `<rect class="affect-zone" x="${arr(G + j * large)}" y="${arr(y)}" width="${arr(cellW)}"
        height="${RANG - 16}" data-choix="${ech((l.cle ?? l.nom) + "~" + c.cle)}"
        data-lecture="${ech(`<u>${echLecture(l.nom)} · ${echLecture(colonnes[j]?.nom ?? "")}</u><br>${echLecture(fmt(c.valeur))}`)}" />`;
    });
  });

  return cadre(svg, H, aria) + "</figure>";
}

/**
 * LA SÉQUENCE — un plan, ses échéances, et ce que l'estimation haute en fait.
 *
 * Une file de chantiers portée par une seule équipe : l'ordre décide de ce qui tombe. Un
 * diagramme de Gantt ordinaire montre le plan qu'on a écrit ; celui-ci montre aussi celui
 * qu'on n'écrit jamais — la même séquence sur l'estimation pessimiste — parce que c'est la
 * différence entre les deux qui fait tomber les échéances.
 *
 * Chaque ligne porte sa barre, son échéance en trait vertical, et la part qui dépasse en
 * hachures. Pas de pastille verte ou rouge : la position par rapport au trait dit tout, et
 * elle le dit sans couleur.
 *
 * @param {{lignes: Array<{cle:string, nom:string, debut:number, fin:number, finHaute?:number,
 *                         echeance:number, retard:number}>,
 *          fmtX?:(v:number)=>string, motEcheance?:string, motHaut?:string,
 *          choix?:boolean, aria:string}} o
 */
export function sequence({ lignes, fmtX = String, motEcheance, motHaut, choix = false, aria }) {
  if (!lignes?.length) return "";
  const G = 96, D = 92, T = 34, RANG = 30, BARRE = 13;
  const H = T + lignes.length * RANG + 46;
  const x1 = Math.max(...lignes.map((l) => Math.max(l.finHaute ?? l.fin, l.echeance))) * 1.02;
  const px = (v) => arr(G + (Math.max(0, v) / (x1 || 1)) * (L - G - D));
  const id = `tr${++compteur}`;

  let svg = trames(id, "alerte");

  lignes.forEach((l, i) => {
    const y = T + i * RANG;
    const milieu = y + BARRE / 2;
    svg += `<text class="seq-nom" x="${G - 10}" y="${arr(milieu + 4)}" text-anchor="end">${ech(l.nom)}</text>`;

    /* L'estimation haute d'abord, en fond : la barre centrale se pose dessus, et l'écart
     * entre les deux est ce qu'on ne montre jamais. */
    if (fini(l.finHaute) && l.finHaute > l.fin) {
      svg += `<rect class="seq-haute" x="${px(l.debut)}" y="${arr(y)}" width="${arr(px(l.finHaute) - px(l.debut))}" height="${BARRE}" />`;
    }
    svg += `<rect class="seq-barre${l.retard > 0 ? " tard" : ""}" x="${px(l.debut)}" y="${arr(y)}"
      width="${arr(Math.max(1, px(l.fin) - px(l.debut)))}" height="${BARRE}"
      data-lecture="${ech(`<u>${echLecture(l.nom)}</u><br>${echLecture(fmtX(l.fin - l.debut))}`)}" />`;

    /*
     * Ce qui dépasse, hachuré — la part de la *barre*, pas la durée depuis l'échéance.
     *
     * Hachurer de l'échéance à la fin peignait aussi le temps où ce chantier n'avait pas
     * commencé : sur un constat démarré après son échéance, la trame courait sur la moitié
     * de la figure et laissait croire à un travail long. Un travail entièrement en retard
     * est hachuré en entier, et c'est exactement ce qu'il est.
     */
    if (l.retard > 0) {
      const g = Math.max(l.debut, l.echeance);
      svg += `<rect class="seq-depasse" fill="url(#${id})" x="${px(g)}" y="${arr(y)}"
        width="${arr(Math.max(1, px(l.fin) - px(g)))}" height="${BARRE}" />`;
    }

    svg += `<line class="seq-echeance" x1="${px(l.echeance)}" y1="${arr(y - 4)}" x2="${px(l.echeance)}" y2="${arr(y + BARRE + 4)}" />`;
    if (l.retard > 0) {
      svg += `<text class="seq-tard" x="${arr(px(Math.max(l.fin, l.finHaute ?? l.fin)) + 8)}" y="${arr(milieu + 4)}">${ech(fmtX(l.retard))}</text>`;
    }
  });

  svg += `<line class="sol" x1="${G}" y1="${arr(T + lignes.length * RANG + 2)}" x2="${L - D}" y2="${arr(T + lignes.length * RANG + 2)}" />`;
  for (const v of [0, x1]) {
    svg += `<text class="grad" x="${px(v)}" y="${arr(T + lignes.length * RANG + 20)}"
      text-anchor="${v === 0 ? "start" : "end"}">${ech(fmtX(v))}</text>`;
  }

  /* La légende dit les deux traits, puisque ni l'un ni l'autre n'est évident. */
  let cx = G;
  for (const [classe, mot] of [["seq-echeance-cle", motEcheance], ["seq-haute-cle", motHaut]]) {
    if (!mot) continue;
    svg += `<rect class="${classe}" x="${arr(cx)}" y="${H - 18}" width="12" height="10" />`
      + `<text class="grad" x="${arr(cx + 18)}" y="${H - 9}">${ech(mot)}</text>`;
    cx += 40 + String(mot).length * 6.2;
  }

  /* En dernier, donc au-dessus : la ligne entière se prend, et la prendre veut dire
   * « celui-ci, ensuite ». */
  if (choix) {
    lignes.forEach((l, i) => {
      svg += `<rect class="seq-zone" x="${G - 92}" y="${arr(T + i * RANG - 6)}" width="${arr(L - G + 92 - D + 80)}"
        height="${RANG - 4}" data-choix="${ech(l.cle)}" />`;
    });
  }

  return cadre(svg, H, aria) + "</figure>";
}

/**
 * LES RUBANS — deux populations d'une statistique, et le seuil qu'on pose entre elles.
 *
 * Une figure pour la question « ce seuil sépare-t-il quelque chose ? ». En abscisse, ce
 * qu'on peut choisir (une taille de fenêtre) ; en ordonnée, la statistique. Deux rubans :
 * ce que la statistique vaut quand rien ne bouge, et ce qu'elle vaut quand quelque chose
 * bouge. Le seuil est un trait horizontal que le lecteur monte et descend.
 *
 * Là où les rubans se recouvrent, aucun seuil ne sépare — et c'est le seul endroit où la
 * réponse honnête est « ce contrôle ne peut pas marcher ici ». Un tableau de valeurs ne le
 * dit jamais ; deux rubans qui se chevauchent le disent sans une phrase.
 *
 * @param {{x: {valeurs:number[], nom:string, fmt?:(v:number)=>string, log?:boolean},
 *          rubans: Array<{nom:string, bas:number[], haut:number[], ton?:string}>,
 *          seuil: {v:number, etiquette?:string, saisissable?:boolean},
 *          y: {nom:string, fmt?:(v:number)=>string, max?:number}, aria:string}} o
 */
export function rubans({ x, rubans: liste, seuil, y, aria }) {
  if (!x?.valeurs?.length || !liste?.length) return "";
  const G = 74, D = 128, T = 26, B = 46;
  const H = 300;
  const sol = H - B;
  const fmtX = x.fmt ?? String, fmtY = y.fmt ?? String;

  const tx = (v) => (x.log ? Math.log(Math.max(v, 1e-9)) : v);
  const x0 = tx(Math.min(...x.valeurs)), x1 = tx(Math.max(...x.valeurs));
  const px = (v) => arr(G + ((tx(v) - x0) / ((x1 - x0) || 1)) * (L - G - D));

  const toutes = liste.flatMap((r) => [...r.bas, ...r.haut]).filter(fini);
  const yMax = y.max ?? Math.max(seuil.v * 1.25, ...toutes) * 1.05;
  const py = (v) => arr(sol - (Math.min(Math.max(v, 0), yMax) / (yMax || 1)) * (sol - T));

  let svg = "";
  for (const c of crans({ bas: 0, haut: yMax }, 4)) {
    const yy = py(c);
    svg += `<line class="grille" x1="${G}" y1="${yy}" x2="${L - D}" y2="${yy}" />`
      + `<text class="grad" x="${G - 8}" y="${arr(yy + 4)}" text-anchor="end">${ech(fmtY(c))}</text>`;
  }

  liste.forEach((r, i) => {
    const haut = x.valeurs.map((v, j) => `${px(v)},${py(r.haut[j])}`).join(" ");
    const bas = x.valeurs.map((v, j) => `${px(v)},${py(r.bas[j])}`).reverse().join(" ");
    svg += `<polygon class="ruban ${r.ton ? "t-" + r.ton : ""}" points="${haut} ${bas}" />`;
    /* L'intitulé se pose au bout du ruban, jamais dans une légende à part : c'est là que
     * l'oeil est quand il suit la bande. */
    const dernier = x.valeurs.length - 1;
    const milieu = (py(r.haut[dernier]) + py(r.bas[dernier])) / 2;
    svg += `<text class="ruban-nom ${r.ton ? "t-" + r.ton : ""}" x="${L - D + 8}" y="${arr(milieu + 4)}">${ech(r.nom)}</text>`;
  });

  svg += `<line class="sol" x1="${G}" y1="${sol}" x2="${L - D}" y2="${sol}" />`;
  for (const v of [x.valeurs[0], x.valeurs[x.valeurs.length - 1]]) {
    svg += `<text class="grad" x="${px(v)}" y="${sol + 18}" text-anchor="${v === x.valeurs[0] ? "start" : "end"}">${ech(fmtX(v))}</text>`;
  }
  svg += `<text class="axe-titre" x="${arr((G + L - D) / 2)}" y="${H - 8}" text-anchor="middle">${ech(x.nom)}</text>`
    + `<text class="axe-titre" x="${G - 46}" y="${T - 8}" text-anchor="start">${ech(y.nom)}</text>`;

  const ys = py(seuil.v);
  svg += `<line class="repere-seuil" x1="${G}" y1="${ys}" x2="${L - D}" y2="${ys}" />`;
  if (seuil.etiquette) {
    svg += `<text class="etiq-seuil" x="${L - D - 6}" y="${arr(ys - 6)}" text-anchor="end">${ech(seuil.etiquette)}</text>`;
  }

  /* La prise couvre le cadre : le trait se prend n'importe où, et il ne bouge qu'en y. */
  if (seuil.saisissable) {
    svg += `<rect class="carte-prise" x="${G}" y="${T}" width="${arr(L - G - D)}" height="${arr(sol - T)}"
      data-x0="0" data-x1="1" data-y0="0" data-y1="${yMax}" />`;
  }

  return cadre(svg, H, aria) + "</figure>";
}

/**
 * LES STRATES — une promesse qu'on déplace, et les populations qu'elle sépare.
 *
 * Une moyenne ne décrit personne quand la population en cache plusieurs. Le dire est un
 * lieu commun ; le montrer demande de séparer les strates sur un même axe et de laisser le
 * lecteur poser lui-même la limite qui l'intéresse. Ici c'est un délai promis : il le tire,
 * et il lit, strate par strate, ce que sa promesse tient vraiment. La moyenne, elle,
 * n'apparaît nulle part — c'est le propos.
 *
 * Les cas sont regroupés en fines colonnes plutôt que dessinés un par un : mille deux cents
 * traits redessinés à chaque mouvement du doigt saccadent, et une colonne de six cas se lit
 * mieux qu'un empilement de traits qui se recouvrent.
 *
 * @param {{strates: Array<{nom:string, valeurs:number[]}>, seuil:{v:number, etiquette?:string},
 *          bas?:number, haut?:number, fmtX?:(v:number)=>string,
 *          compte?:(dedans:number, total:number)=>string, aria:string}} o
 */
export function strates({ strates: liste, seuil, bas, haut, fmtX = String, compte, aria }) {
  if (!liste?.length) return "";
  const toutes = liste.flatMap((s) => s.valeurs).filter(fini);
  if (!toutes.length) return "";
  const x0 = bas ?? 0;
  const x1 = haut ?? Math.max(...toutes) * 1.04;
  /* Les gouttières tiennent le plus long des intitulés et le plus long des comptes :
   * « came back twice or more » et « 100 % — 780/781 » sortaient tous les deux du cadre,
   * amputés sans un mot. Mesurées à la chasse de la police du registre. */
  const G = 178, D = 142, T = 30, B = 44, RANG = 62;
  const H = T + liste.length * RANG + B;
  const px = (v) => arr(G + ((Math.min(Math.max(v, x0), x1) - x0) / ((x1 - x0) || 1)) * (L - G - D));
  const NB = 116, pas = (x1 - x0) / NB;

  let svg = "";
  liste.forEach((st, i) => {
    const y = T + i * RANG;
    const sol = y + RANG - 16;
    const seaux = new Array(NB).fill(0);
    for (const v of st.valeurs) seaux[Math.min(NB - 1, Math.max(0, Math.floor((v - x0) / pas)))]++;
    const plus = Math.max(...seaux, 1);
    const largeur = (L - G - D) / NB;
    seaux.forEach((n, j) => {
      if (!n) return;
      const h = 6 + (n / plus) * (RANG - 30);
      const v = x0 + (j + 0.5) * pas;
      svg += `<rect class="strate-col ${v <= seuil.v ? "tenu" : "rate"}" x="${arr(px(x0 + j * pas))}"
        y="${arr(sol - h)}" width="${arr(Math.max(1.4, largeur - 0.6))}" height="${arr(h)}" />`;
    });
    const dedans = st.valeurs.filter((v) => v <= seuil.v).length;
    svg += `<line class="strate-sol" x1="${G}" y1="${sol}" x2="${L - D}" y2="${sol}" />`
      + `<text class="strate-nom" x="${G - 12}" y="${sol - 2}" text-anchor="end">${ech(st.nom)}</text>`
      + `<text class="strate-compte" x="${L - D + 12}" y="${sol - 2}">${ech(compte ? compte(dedans, st.valeurs.length) : `${dedans}/${st.valeurs.length}`)}</text>`;
  });

  /* La prise couvre toute la hauteur : on saisit la limite n'importe où, pas seulement sur
   * son trait — viser une ligne de deux pixels n'est pas une commande. */
  svg += `<rect class="carte-prise" x="${G}" y="${T - 10}" width="${L - G - D}" height="${H - T - B + 20}"
    data-x0="${x0}" data-x1="${x1}" data-y0="0" data-y1="1" />`;
  svg += `<line class="strate-limite" x1="${px(seuil.v)}" y1="${T - 10}" x2="${px(seuil.v)}" y2="${H - B + 6}" />`
    + `<polygon class="strate-poignee" points="${px(seuil.v) - 6},${T - 16} ${px(seuil.v) + 6},${T - 16} ${px(seuil.v)},${T - 6}" />`;
  if (seuil.etiquette) {
    const colle = px(seuil.v) - G < 120;
    svg += `<text class="strate-etiq" x="${arr(px(seuil.v) + (colle ? 10 : -10))}" y="${T - 20}"
      text-anchor="${colle ? "start" : "end"}">${ech(seuil.etiquette)}</text>`;
  }
  /* La graduation de la limite prime sur les bornes : quand elle s'en approche, c'est la
   * borne qui s'efface. Les deux imprimées l'une sur l'autre donnaient « 1 day5 days ». */
  for (const v of [x0, seuil.v, x1]) {
    if (v !== seuil.v && Math.abs(px(v) - px(seuil.v)) < 46) continue;
    const a = v === x0 ? "start" : v === x1 ? "end" : "middle";
    svg += `<text class="grad${v === seuil.v ? " t-neutre" : ""}" x="${px(v)}" y="${H - B + 24}" text-anchor="${a}">${ech(fmtX(v))}</text>`;
  }
  return cadre(svg, H, aria) + "</figure>";
}

/**
 * LES RANGS.
 *
 * Un classement qui bouge. Des barres n'en montrent qu'un état : le lecteur à qui l'on
 * demande de cliquer quatre scénarios et de se souvenir conclura du premier. Ici les
 * quatre états sont côte à côte et chaque ligne se suit d'un bout à l'autre — le
 * croisement est la trouvaille, il faut donc qu'il soit dessiné, pas déduit.
 *
 * Ce que la figure ne dit pas : les montants. Un rang n'a pas d'échelle, et deux leviers
 * séparés par un cheveu s'y lisent comme premier et deuxième. La valeur reste donc
 * attachée à chaque point, dans la lecture au survol, plutôt que passée sous silence.
 *
 * La série mise en avant n'est pas choisie à la main : c'est celle qui bouge le plus. Si
 * un jour plus rien ne bouge, aucune n'est mise en avant, et la figure dit cela aussi.
 * L'accent ne porte jamais seul — trait plus épais, points pleins, intitulé gras.
 *
 * @param {{colonnes: Array<string|{titre:string}>,
 *          series: Array<{nom:string, rangs:Array<{rang:number, valeur?:number}|number>, vedette?:boolean}>,
 *          fmt?:(v:number)=>string, aria:string, nomRang?:(r:number)=>string}} o
 */
export function rangs({ colonnes, series, fmt = String, aria, nomRang, choix = false, iciTexte }) {
  if (!colonnes?.length || !series?.length) return "";
  const cols = colonnes.map((c) => (typeof c === "string" ? { titre: c } : c));
  const lig = series.map((s) => ({
    ...s,
    rangs: s.rangs.map((r) => (typeof r === "number" ? { rang: r } : r)),
  }));
  const profond = Math.max(...lig.flatMap((s) => s.rangs.map((r) => r.rang ?? 0)));
  if (!(profond > 0)) return "";

  /* Le nom le plus long décide de la gouttière de droite : mesuré à la louche, mais
   * une louche large vaut mieux qu'un intitulé coupé. */
  const large = Math.max(...lig.map((s) => String(s.nom).length));
  const droite = Math.min(190, Math.max(72, large * 7 + 16));
  const gauche = 46;
  /* Le mot posé au-dessus de la colonne retenue a besoin de sa ligne : sans elle il se
   * dessinait au-dessus du cadre, donc nulle part. */
  const PAS = 42, HAUT = iciTexte ? 48 : 26;
  const hauteur = HAUT + (profond - 1) * PAS + 46;
  const px = (i) => arr(gauche + (cols.length === 1 ? 0 : (i / (cols.length - 1)) * (L - gauche - droite)));
  const py = (r) => arr(HAUT + (r - 1) * PAS);

  /* Celle qui bouge le plus. À égalité, celle qui a touché la première place. */
  let vedette = lig.find((s) => s.vedette);
  if (!vedette) {
    const bouge = (s) => Math.max(...s.rangs.map((r) => r.rang)) - Math.min(...s.rangs.map((r) => r.rang));
    const plus = Math.max(...lig.map(bouge));
    if (plus > 0) vedette = lig.filter((s) => bouge(s) === plus)
      .sort((a, b) => Math.min(...a.rangs.map((r) => r.rang)) - Math.min(...b.rangs.map((r) => r.rang)))[0];
  }

  /* La bande d'une colonne : à mi-chemin de ses voisines, bornée par le cadre. */
  const bandeX = (i) => {
    /* Les bornes s'arrêtent au cadre : débordées, la bande recouvrait les rangs à gauche
     * et les intitulés de séries à droite. */
    const g = i === 0 ? gauche - 6 : (px(i - 1) + px(i)) / 2;
    const d = i === cols.length - 1 ? L - droite + 6 : (px(i) + px(i + 1)) / 2;
    return [arr(g), arr(d - g)];
  };

  let svg = "";
  /*
   * La colonne retenue, marquée avant tout le reste.
   *
   * Quand les colonnes *sont* les choix — quatre scénarios côte à côte —, un bouton posé
   * sous la figure demande au lecteur de faire le lien lui-même. La bande le fait à sa
   * place, et le clic se prend là où le regard est déjà.
   */
  cols.forEach((c, i) => {
    if (!c.ici) return;
    const [x, w] = bandeX(i);
    svg += `<rect class="rang-ici" x="${x}" y="${py(1) - 20}" width="${w}" height="${arr(py(profond) - py(1) + 40)}" />`;
    if (iciTexte) {
      svg += `<text class="marche-ici-mot" x="${arr(x + w / 2)}" y="${py(1) - 28}" text-anchor="middle">${ech(iciTexte)}</text>`;
    }
  });
  cols.forEach((c, i) => {
    svg += `<line class="rang-colonne" x1="${px(i)}" y1="${py(1) - 12}" x2="${px(i)}" y2="${py(profond) + 12}" />`
      + `<text class="grad${c.ici ? " t-neutre" : ""}" x="${px(i)}" y="${hauteur - 16}" text-anchor="middle">${ech(c.titre)}</text>`;
  });
  for (let r = 1; r <= profond; r++) {
    svg += `<text class="grad" x="${gauche - 14}" y="${py(r) + 4}" text-anchor="end">${ech(nomRang ? nomRang(r) : r)}</text>`;
  }

  for (const s of lig) {
    const vu = s === vedette;
    const pts = s.rangs.map((r, i) => `${px(i)},${py(r.rang)}`).join(" ");
    svg += `<polyline class="rang-trace${vu ? " vedette" : ""}" fill="none" points="${pts}" />`;
  }
  /* Les points après tous les traits : un point traversé par la ligne d'à côté se lit mal. */
  for (const s of lig) {
    const vu = s === vedette;
    s.rangs.forEach((r, i) => {
      const lecture = ech(`<u>${echLecture(s.nom)} · ${echLecture(cols[i]?.titre ?? "")}</u><br>${echLecture(nomRang ? nomRang(r.rang) : r.rang)}`
        + (fini(r.valeur) ? ` — ${echLecture(fmt(r.valeur))}` : ""));
      svg += `<circle class="rang-point${vu ? " vedette" : ""}" cx="${px(i)}" cy="${py(r.rang)}" r="${vu ? 5 : 4.5}"
        data-lecture="${lecture}" />`;
    });
    const fin = s.rangs[s.rangs.length - 1];
    svg += `<text class="rang-nom${vu ? " vedette" : ""}" x="${px(cols.length - 1) + 12}" y="${py(fin.rang) + 4}">${ech(s.nom)}</text>`;
  }

  /* En dernier, donc au-dessus : la colonne entière se vise. */
  if (choix) {
    cols.forEach((c, i) => {
      const [x, w] = bandeX(i);
      svg += `<rect class="rang-zone" x="${x}" y="${py(1) - 20}" width="${w}"
        height="${arr(py(profond) - py(1) + 40)}" data-choix="${ech(c.id ?? c.titre)}" />`;
    });
  }

  return cadre(svg, hauteur, aria) + "</figure>";
}

/**
 * Le survol.
 *
 * Appelé après chaque rendu — les blocs de ces écrans se réécrivent entièrement à chaque
 * changement d'état, donc les écouteurs partent avec. Idempotent par prudence : un double
 * branchement afficherait deux fois la même lecture.
 */
export function brancher(racine = document) {
  for (const fig of racine.querySelectorAll("figure.graphe")) {
    if (fig.dataset.branche) continue;
    if (!fig.querySelector("[data-lecture]")) continue;
    /* Le repère de position : le cadre défilant pour un SVG, la figure elle-même pour des
     * barres — qui, étant du HTML, se replient toutes seules et ne défilent pas. */
    const cad = fig.querySelector(".cadre-graphe") ?? fig;
    let boite = cad.querySelector(".lecture-flottante");
    if (!boite) {
      boite = document.createElement("div");
      boite.className = "lecture-flottante";
      boite.hidden = true;
      cad.appendChild(boite);
    }
    fig.dataset.branche = "1";

    const montrer = (el) => {
      const t = el.getAttribute("data-lecture");
      if (!t) return;
      boite.innerHTML = t;
      boite.hidden = false;
      // Le cadre peut défiler : la position se calcule dans son repère de contenu, donc en
      // ajoutant le défilement, sinon l'étiquette se décale dès qu'on a fait glisser.
      const r = cad.getBoundingClientRect(), c = el.getBoundingClientRect();
      const centre = c.left + c.width / 2 - r.left + cad.scrollLeft;
      const large = boite.offsetWidth;
      const maxi = cad.scrollWidth - large - 4;
      boite.style.left = `${Math.max(4, Math.min(maxi, centre - large / 2))}px`;
    };

    cad.addEventListener("pointermove", (e) => {
      const cible = e.target.closest("[data-lecture]");
      if (cible) montrer(cible); else boite.hidden = true;
    });
    cad.addEventListener("pointerleave", () => { boite.hidden = true; });
    // Au clavier : les cibles ne sont pas focusables, mais les figures le sont, et la
    // lecture au survol n'est jamais la seule source — le tableau est juste dessous.
  }
}

/*
 * Une liste dont chaque rang se déplie.
 *
 * Écrite parce que le même accordéon vivait deux fois dans la même page, à six lignes
 * près identiques — et que le deuxième exemplaire avait déjà divergé du premier : l'un
 * refermait le rang ouvert quand on le recliquait, l'autre le laissait ouvert.
 *
 * Trois choses la distinguent d'un écouteur posé sur chaque tête, et chacune vient d'un
 * dégât déjà payé ailleurs dans ce fichier :
 *
 * — Le bloc est réécrit entièrement à chaque rendu. Un écouteur posé sur une tête part
 *   avec elle, et la liste devient muette au premier redessin sans que rien ne le
 *   signale. L'écoute vit donc sur la racine, qui survit ; le câblage ARIA, lui, se
 *   refait à chaque appel, parce que les têtes neuves n'ont ni identifiant ni renvoi.
 *
 * — Le foyer disparaît avec la tête qui le portait. C'est le défaut que `saisir` a payé :
 *   une flèche pressée deux fois de suite ne trouvait plus personne. On note le rang
 *   focalisé sur la racine, qui survit au rendu, et on le rend après.
 *
 * — `aria-expanded` se lit sur la classe et jamais l'inverse. Le rendu écrit la classe ;
 *   un attribut tenu à part se désynchronise au premier redessin, et un lecteur d'écran
 *   annonce « replié » sur un rang déplié sans que l'œil voie quoi que ce soit.
 *
 * contrat-offert: pliable tete corps
 *
 * Ces trois classes sont interrogées ici et posées par qui emploie la primitive, pas par
 * la couche. Un dépôt qui ne s'en sert pas encore les porte donc en style sans les poser
 * en HTML, ce qui est l'état normal d'un contrat offert et non un sélecteur mort. La
 * marque le déclare au gardien des sélecteurs, qui vérifie de son côté qu'elles existent
 * bien dans `registre.css` — une classe déclarée et non stylée reste une faute.
 */
let compteurRepli = 0;

export function replier(racine, { exclusif = true } = {}) {
  if (!racine) return;
  const tetes = () => [...racine.querySelectorAll(".pliable > .tete")];
  const cle = racine.dataset.repliCle ?? (racine.dataset.repliCle = `repli${++compteurRepli}`);

  /* Le câblage, refait à chaque appel : après un rendu, les têtes sont neuves. */
  tetes().forEach((tete, i) => {
    const item = tete.parentElement;
    const corps = item.querySelector(":scope > .corps");
    if (!corps) return;
    /* Une tête qui n'est pas un bouton n'est ni focalisable ni activable : le navigateur
     * ne fournit gratuitement que ce qui est déclaré bouton. On le déclare. */
    if (tete.tagName !== "BUTTON") {
      tete.setAttribute("role", "button");
      if (!tete.hasAttribute("tabindex")) tete.setAttribute("tabindex", "0");
    }
    if (!tete.id) tete.id = `${cle}-t${i}`;
    if (!corps.id) corps.id = `${cle}-c${i}`;
    tete.setAttribute("aria-controls", corps.id);
    tete.setAttribute("aria-expanded", item.classList.contains("ouvert") ? "true" : "false");
    corps.setAttribute("role", "region");
    corps.setAttribute("aria-labelledby", tete.id);
  });

  /* Le foyer rendu après le rendu — mais seulement s'il était dans la liste. Le restituer
   * sans condition, c'est voler le foyer à qui tapait ailleurs pendant le redessin. */
  const rang = Number(racine.dataset.repliFoyer ?? -1);
  if (racine.dataset.repliActif === "1" && rang >= 0) tetes()[rang]?.focus({ preventScroll: true });

  if (racine.dataset.repliBranche) return;
  racine.dataset.repliBranche = "1";

  const basculer = (tete) => {
    const item = tete.parentElement;
    const ouvert = item.classList.contains("ouvert");
    if (exclusif) {
      for (const t of tetes()) {
        t.setAttribute("aria-expanded", "false");
        t.parentElement.classList.remove("ouvert");
      }
    }
    /* Refermer sur un second appui. Sans ça une liste exclusive garde un rang ouvert pour
     * toujours, et on ne peut plus revenir à la vue d'ensemble. */
    if (!ouvert) {
      item.classList.add("ouvert");
      tete.setAttribute("aria-expanded", "true");
    } else if (!exclusif) {
      item.classList.remove("ouvert");
      tete.setAttribute("aria-expanded", "false");
    }
  };

  const teteDe = (cible) => (cible && cible.closest ? cible.closest(".pliable > .tete") : null);

  racine.addEventListener("click", (e) => {
    const tete = teteDe(e.target);
    if (tete) basculer(tete);
  });

  /* `focusin` et `focusout` remontent ; `focus` et `blur` non. Sur une racine dont le
   * contenu est remplacé, seuls les premiers voient les têtes neuves. */
  racine.addEventListener("focusin", (e) => {
    const tete = teteDe(e.target);
    if (!tete) return;
    racine.dataset.repliFoyer = String(tetes().indexOf(tete));
    racine.dataset.repliActif = "1";
  });
  racine.addEventListener("focusout", (e) => {
    /* Un nœud retiré du document émet `focusout` comme s'il avait été quitté. Effacer le
     * drapeau là-dessus, c'était perdre le foyer à chaque rendu. */
    if (e.target.isConnected) delete racine.dataset.repliActif;
  });

  racine.addEventListener("keydown", (e) => {
    const tete = teteDe(e.target);
    if (!tete) return;
    if ((e.key === "Enter" || e.key === " ") && tete.tagName !== "BUTTON") {
      e.preventDefault();
      basculer(tete);
      return;
    }
    const liste = tetes();
    const i = liste.indexOf(tete);
    const vers = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: liste.length - 1 };
    if (!(e.key in vers)) return;
    /* La navigation par flèches ne boucle pas : arrivé au bout, la flèche ne fait rien, et
     * la tabulation sort de la liste comme partout ailleurs. Une liste qui boucle piège
     * qui ne voit pas où il en est. */
    const j = Math.min(liste.length - 1, Math.max(0, vers[e.key]));
    if (j === i) return;
    e.preventDefault();
    liste[j].focus();
  });
}
