#!/bin/sh
# La porte anti-ignorés de `verifier`, rendue NOMINATIVE.
#
# Sa première forme comptait : zéro ignoré, sinon rouge. Elle est née d'un cas réel — le
# contrôle « aucune valeur du client ne sort » s'ignorait quand les poids manquaient, et la
# construction restait verte pendant que la promesse centrale n'était éprouvée sur rien.
# Depuis que `--prime` amorce les poids, ce cas-là S'EXÉCUTE. Ce qui s'ignore encore sur un
# runner Linux est structurel à la machine (swiftc et Vision sont macOS, `identite` est un
# dépôt de développement), et chaque cas le dit sur sa ligne.
#
# Un simple plafond relevé à six serait un vert vide : n'importe quel contrôle pourrait
# s'éteindre tant qu'un autre se rallume. La porte compare donc L'ENSEMBLE EXACT des noms :
#   — un ignoré ABSENT de la liste est un contrôle qui vient de s'éteindre → rouge ;
#   — une ligne de la liste dont le cas s'exécute désormais est une liste qui MENT → rouge,
#     et l'issue est de la resserrer, jamais de l'élargir sans nouvelle raison écrite.
#
# Vit dans un script, pas dans le YAML : un pas de workflow ne s'éprouve qu'en poussant,
# ce script s'éprouve sur une fixture en local — il l'a été dans les cinq directions.
set -eu
SUITE="$1"       # la sortie complète de `npm test`
ATTENDUS="$2"    # .github/cas-ignores-attendus.txt

# LE MARQUEUR D'ABORD : sans la ligne de résumé, ce script ne peut RIEN conclure — il
# refuse au lieu de compter zéro. « Ligne introuvable » et « zéro ignoré » ne doivent
# jamais rendre le même verdict.
ignores=$(grep -oE '^(ℹ|#) skipped [0-9]+' "$SUITE" | grep -oE '[0-9]+' | head -1 || true)
if [ -z "${ignores:-}" ]; then
  echo "::error::la ligne de résumé « skipped » est introuvable dans la sortie de la suite."
  echo "Le rapporteur a changé de forme, ou la suite n'est pas allée jusqu'au résumé."
  exit 1
fi

VUS=$(mktemp); TRIES=$(mktemp)
sed -nE 's/^﹣ (.*) \([0-9.]+ms\).*$/\1/p' "$SUITE" | sort -u > "$VUS"
grep -v '^#' "$ATTENDUS" | grep -v '^$' | sort -u > "$TRIES"

# LE COMPTE ET LES NOMS VIENNENT DE LA MÊME SOURCE, ET DOIVENT SE RECOUPER : un résumé qui
# annonce N pendant que N−1 lignes « ﹣ » sont lisibles est un canal coupé quelque part, et
# la comparaison de noms conclurait sur une liste amputée.
if [ "$ignores" -ne "$(wc -l < "$VUS" | tr -d ' ')" ]; then
  echo "::error::le résumé annonce $ignores ignoré(s) mais $(wc -l < "$VUS" | tr -d ' ') ligne(s) « ﹣ » sont lisibles."
  echo "Les deux sortent du même rapporteur : leur désaccord veut dire qu'une partie de la"
  echo "sortie manque, et comparer des noms sur une liste amputée conclurait à tort."
  exit 1
fi

# Le fichier d'écart est un mktemp, pas un chemin fixe : deux lancements simultanés sur la
# même machine — six sessions ici un jour — se liraient l'écart l'un de l'autre.
ECART=$(mktemp)
if ! diff -u "$TRIES" "$VUS" > "$ECART" 2>&1; then
  echo "::error::les cas ignorés ne sont pas EXACTEMENT ceux que la liste attend."
  echo ""
  echo "  (−) attendu et non vu : ce cas s'exécute désormais ici — la liste ment, resserrez-la."
  echo "  (+) vu et non attendu : ce contrôle vient de s'éteindre — il n'a rien vérifié,"
  echo "      et une construction verte le cacherait. L'élargissement de la liste exige une"
  echo "      raison écrite dans $ATTENDUS, du même genre que celles qui y sont."
  echo ""
  grep -E '^[-+][^-+]' "$ECART" || true
  exit 1
fi

echo "$ignores cas ignoré(s), tous attendus et nommés dans $ATTENDUS — aucun autre."
