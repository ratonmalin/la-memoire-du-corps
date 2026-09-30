# La mémoire du corps

Prototype audiovisuel interactif : un organisme ferrofluidique qui respire, absorbe les perturbations musicales, accumule des traces et conserve une mémoire morphologique.

## État du prototype

- Un seul volume continu : aucune note ne crée de sphère, de bulle ou d'objet secondaire.
- La forme est un champ implicite Marching Cubes, avec une base asymétrique et un grain fin de surface.
- Une note injecte une onde de déformation qui circule sur le volume existant.
- La même note répétée suit quatre régimes : excitation, résonance, accumulation, surcharge.
- La surcharge modifie qualitativement la morphologie : pointes plus magnétiques, cohésion légèrement réduite, mais sans séparation en objets.
- La mémoire est inscrite directement dans la géométrie sous forme de déformations persistantes.
- Les accords agissent sur l'orientation et la torsion du même corps.
- Le corps respire continuellement à 72 BPM et ne disparaît jamais.
- Après environ 60 secondes de silence, la reprise crée une trace d'éveil ; la mémoire précédente reste présente.
- Clavier AZERTY : A, Z, E, R, T, Y, U, Q, S, D, F, G, H, J.
- MIDI : notes MIDI Note On.
- Espace : active/désactive l'arpégiateur.
- Aucune interaction souris ou tactile.

## Architecture

Le projet reste volontairement léger : Three.js est chargé par import map depuis CDN, sans build step.

La géométrie n'utilise plus addBall pour représenter les notes. Cette API produit des volumes de type metaball ; elle est donc écartée pour les événements utilisateur. Le corps est défini par un champ scalaire continu avec setCell, puis polygonisé par Marching Cubes.

La priorité de cette passe est la stabilité comportementale : une note déforme le corps existant au lieu de générer un nouvel objet, les perturbations expirent progressivement, et la mémoire reste sous forme de biais morphologiques.

## Développement local

Servir le dossier avec un serveur HTTP local, par exemple :

    python3 -m http.server 8000

Puis ouvrir http://localhost:8000.

Un serveur HTTP est préférable à l'ouverture directe du fichier HTML pour les modules ES et l'import map.