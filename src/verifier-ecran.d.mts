/*
 * LES TYPES DE `verifier-ecran.mjs`.
 *
 * Le module est écrit en JavaScript parce qu'il est partagé tel quel entre les dépôts du
 * portfolio : aucun outil de compilation ne tourne entre le disque et son exécution. Mais
 * `modulesEnRetard` est aussi appelée depuis un cas en TypeScript — la suite vérifie la
 * fraîcheur de la page avec la MÊME définition que la commande qui la sert, pour qu'il n'y
 * en ait pas deux. Sans déclaration, `tsc --noEmit` s'arrête sur un `any` implicite.
 *
 * Ce fichier n'ajoute aucune vérification à l'exécution. La garde de point d'entrée du
 * module, elle, en ajoute une : sans elle, cet import lancerait la vérification d'écran.
 */

/** Les fichiers de `docs/` plus vieux que la source dont ils sont issus. Vide si tout est à jour. */
export function modulesEnRetard(racineDepot: string): string[];
