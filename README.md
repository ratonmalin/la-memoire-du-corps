# La mémoire du corps

Prototype audiovisuel interactif : un organisme ferrofluidique unique, sombre et réfléchissant, qui respire, absorbe les perturbations musicales, accumule des traces et conserve une mémoire morphologique.

## État actuel

- Un seul volume continu, sans sphères secondaires ni objets générés par les notes.
- Corps 3D fermé à haute définition, rendu comme une masse de graphite très réfléchissante.
- Caméra frontale fixe ; elle recule automatiquement si le volume augmente afin de conserver le corps entièrement visible.
- Respiration lente et discrète à 36 BPM.
- Une note crée un pic local temporaire à un endroit dépendant de l'état courant du corps. Aucun anneau ni vague visible.
- La répétition d'une même note suit quatre régimes : excitation, résonance, accumulation, surcharge.
- La surcharge constitue un changement de régime morphologique et ne bloque jamais l'interaction.
- Les accords font tourner et torsader l'ensemble du corps sur plusieurs axes ; ils ne créent pas de nouvelles formes.
- La mémoire est permanente pendant la session et reste inscrite dans la morphologie.
- Après environ 60 secondes de silence, le corps reste vivant, calme et transformé. Une nouvelle interaction réveille progressivement la matière.
- Clavier AZERTY : A, Z, E, R, T, Y, U, Q, S, D, F, G, H, J.
- MIDI : Note On.
- Espace : active ou désactive l'arpégiateur.
- Souris et tactile : aucune interaction.

## Architecture

Le prototype reste volontairement léger : Three.js est chargé par import map depuis CDN, sans build step.

La géométrie de base est une sphère dense dont le vertex shader déforme une seule surface continue. Les notes, la mémoire, la respiration, la surcharge et les accords modifient cette surface et l'orientation du même objet. Aucun volume secondaire n'est instancié pour représenter une note.

Le matériau est traité comme un graphite métallique sombre avec des réflexions larges et des highlights contrôlés, afin d'éviter les faces sur-saturées et de conserver une lecture claire de la silhouette.

## Développement local

Servir le dossier avec un serveur HTTP local, par exemple :

    python3 -m http.server 8000

Puis ouvrir http://localhost:8000.

Un serveur HTTP est préférable à l'ouverture directe du fichier HTML pour les modules ES et l'import map.
