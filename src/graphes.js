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
      + ` data-lecture="${ech(`<u>${fmtX(x(p))}</u><br>${infos}`)}" />`;
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
      ? ` data-lecture="${ech(`<u>${i.nom}</u>${fmt(i.valeur)}<br><b>[${fmt(i.bas)} – ${fmt(i.haut)}]</b>`)}"` : "";
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
export function escalier({ marches, fmt = String, fmtX = String, hauteur = 210, aria }) {
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
  for (const m of marches) {
    const g = px(m.de), d = px(m.a), y = py(m.valeur);
    svg += `<rect class="marche${m.ici ? " ici" : ""}${m.gratuite ? " gratuite" : ""}${m.morte ? " morte" : ""}" x="${g}" y="${y}"
      width="${arr(Math.max(1, d - g))}" height="${arr(Math.max(1, sol - y))}"
      data-lecture="${ech(`<u>${fmtX(m.de)} → ${fmtX(m.a)}</u><br>${fmt(m.valeur)}`)}" />`;
    svg += `<line class="dessus${m.gratuite ? " gratuite" : ""}${m.morte ? " morte" : ""}" x1="${g}" y1="${y}" x2="${d}" y2="${y}" />`;
  }
  svg += `<line class="sol" x1="${M.gauche}" y1="${sol}" x2="${L - M.droite}" y2="${sol}" />`;
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
    const lecture = ech(`<u>${fmtX(b.de)} – ${fmtX(b.a)}</u><br>${fmt(b.valeur)}`
      + (fini(b.part) ? ` · ${fmt(b.part)}` : ""));
    svg += `<rect class="bande-hist" x="${arr(g + 1.5)}" y="${y}" width="${arr(large)}"
      height="${arr(Math.max(1, sol - y))}" data-lecture="${lecture}" />`;
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
    const ancrage = v === x0 ? "start" : v === x1 ? "end" : "middle";
    svg += `<text class="grad" x="${px(v)}" y="${sol + 18}" text-anchor="${ancrage}">${ech(fmtX(v))}</text>`;
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
export function grille({ colonnes, lignes, legende, aria }) {
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
  lignes.forEach((l, i) => {
    const y = HAUT + i * LIGNE;
    svg += `<text class="grille-nom" x="${GAUCHE - 10}" y="${y + CELL - 4}" text-anchor="end">${ech(l.nom)}</text>`;
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
        data-lecture="${ech(`<u>${cols[j]?.nom ?? j + 1}</u><br>${l.nom}`)}" />`;
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
    const ancrage = v === x0 ? "start" : v === x1 ? "end" : "middle";
    svg += `<text class="grad" x="${px(v)}" y="${sol + 16}" text-anchor="${ancrage}">${ech(fmtX(v))}</text>`;
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
      data-lecture="${ech(`<u>${it.nom}</u><br>${fmt(it.valeur)}`)}" />`;
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
      data-lecture="${ech(`<u>${b.nom}</u><br>${fmtX(b.de)} – ${fmtX(b.a)}`)}" />`;
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
export function rangs({ colonnes, series, fmt = String, aria, nomRang }) {
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
  const PAS = 42, HAUT = 26;
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

  let svg = "";
  cols.forEach((c, i) => {
    svg += `<line class="rang-colonne" x1="${px(i)}" y1="${py(1) - 12}" x2="${px(i)}" y2="${py(profond) + 12}" />`
      + `<text class="grad" x="${px(i)}" y="${hauteur - 16}" text-anchor="middle">${ech(c.titre)}</text>`;
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
      const lecture = ech(`<u>${s.nom} · ${cols[i]?.titre ?? ""}</u><br>${nomRang ? nomRang(r.rang) : r.rang}`
        + (fini(r.valeur) ? ` — ${fmt(r.valeur)}` : ""));
      svg += `<circle class="rang-point${vu ? " vedette" : ""}" cx="${px(i)}" cy="${py(r.rang)}" r="${vu ? 5 : 4.5}"
        data-lecture="${lecture}" />`;
    });
    const fin = s.rangs[s.rangs.length - 1];
    svg += `<text class="rang-nom${vu ? " vedette" : ""}" x="${px(cols.length - 1) + 12}" y="${py(fin.rang) + 4}">${ech(s.nom)}</text>`;
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
