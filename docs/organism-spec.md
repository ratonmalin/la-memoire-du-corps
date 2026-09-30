# Spécification comportementale — V1

## Noyau

La Mémoire du Corps est un organisme abstrait, dense, gélatineux et ferrofluidique. Il existe indépendamment de l'utilisateur.

Le corps est un volume unique. Les notes ne créent jamais de particules décoratives ou d'objets séparés : elles modifient le champ qui définit sa surface.

## Variables

- energy : énergie instantanée, décroissance rapide.
- tension : accumulation des perturbations, décroissance moyenne.
- cohesion : capacité à conserver une forme unifiée.
- memory : persistance de l'histoire, presque permanente pendant la session.
- orientation : orientation physique du corps.
- breathPhase : phase de respiration.
- overload : régime de surcharge.

## Respiration

Le prototype utilise 72 BPM.

Le cycle respiratoire est indépendant des notes : expansion et contraction globales extrêmement faibles, avec micro-mouvements permanents.

La respiration peut accélérer sous surcharge et sert de référence temporelle commune avec l'arpégiateur.

## Notes

Une note injecte de l'énergie et de la tension. Elle crée une excitation locale dont la position dépend de l'état courant du corps, puis une propagation qui circule dans le volume.

La vélocité contrôle principalement l'intensité.

Il n'existe pas de limite artificielle de polyphonie dans la logique d'interaction.

## Répétition

Une note identique répétée consécutivement augmente un compteur.

1 = excitation.
2 = résonance.
3 = accumulation.
4 = surcharge.

La surcharge est un changement de régime : contractions, pointes, instabilité, perte momentanée de cohésion ou rejet d'énergie sont des comportements possibles. Elle ne bloque jamais l'interaction.

## Accords

Plusieurs notes maintenues simultanément agissent sur le même organisme et produisent une rotation / torsion sur plusieurs axes.

La réponse dépend de l'état courant : un corps calme et un corps tendu ne répondent pas de la même façon à un même accord.

## Propagation

La propagation ne doit pas être une simple onde radiale autour d'un point fixe.

Elle doit circuler dans le volume et être influencée par la forme courante, la tension et la mémoire du corps.

## Mémoire morphologique

La mémoire est permanente pendant toute la session.

Elle doit rester visible dans la géométrie : épaississements, cicatrices, excroissances ou changements locaux de densité peuvent subsister après disparition de l'énergie instantanée.

Une pause d'environ 60 secondes marque une transition entre utilisateurs. Le corps ne meurt pas et ne dort pas : il revient à un équilibre calme tout en restant vivant.

La première interaction après cette pause provoque un réveil doux et peut créer une excroissance représentant l'interruption elle-même.

## Interface spectateur

L'interface est un instrument de lecture discret, pas un tableau de bord dominant.

Elle expose au minimum : état, énergie, tension, mémoire, surcharge, respiration, répétition et état de l'arpégiateur.

Aucune donnée ne doit être rendue illisible par un contraste blanc ou un élément placé au-dessus du corps.

## Interaction

Entrées autorisées :
- clavier AZERTY ;
- MIDI.

Souris et tactile : aucune stimulation du corps.

## Principe

Le renderer ne connaît pas les notes. Le système musical modifie l'état de l'organisme ; le champ morphologique fait évoluer la matière ; le renderer matérialise le résultat.
