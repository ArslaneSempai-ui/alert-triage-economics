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
const trames = (id) => `<defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"
  patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" /></pattern></defs>`;

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
