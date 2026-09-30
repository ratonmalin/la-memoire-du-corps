# Spécification comportementale — V1

## Noyau

La Mémoire du Corps est un organisme abstrait, gélatineux et ferrofluidique. Il existe indépendamment de l'utilisateur.

Il possède une horloge respiratoire propre. Les interactions musicales le perturbent mais ne contrôlent jamais directement son apparence.

## Variables

- energy : énergie instantanée, décroissance rapide.
- tension : accumulation des perturbations, décroissance moyenne.
- cohesion : capacité à conserver une forme unifiée.
- memory : persistance lente de l'histoire.
- orientation : orientation physique du corps.
- breathPhase : phase de respiration.
- overload : état dérivé lorsque tension et répétition dépassent un seuil.

## Respiration

Le prototype utilise 72 BPM.

Le cycle respiratoire est indépendant des notes : inspiration = expansion globale ; expiration = contraction ; repos = mouvement minimal mais jamais nul.

L'horloge pourra ensuite devenir une horloge musicale partagée avec un arpégiateur.

## Notes

Une note injecte de l'énergie, augmente la tension, crée une perturbation locale, déclenche une propagation dans la matière et augmente légèrement la mémoire.

La vélocité contrôle principalement l'intensité de la perturbation.

## Répétition

Une note identique répétée consécutivement augmente un compteur.

1 = excitation.
2 = résonance.
3 = forte accumulation.
4 = surcharge.

La surcharge est un changement de régime, pas simplement une augmentation d'échelle.

## Accords

Un ensemble de notes actives agit sur l'orientation et la torsion du corps.

Plusieurs notes simultanées ne créent pas plusieurs objets : elles modifient le même organisme.

## Propagation

Chaque note produit une excitation qui se déplace dans le corps. La trajectoire est influencée par la forme et l'état courant du corps.

## Mémoire morphologique

La mémoire doit devenir visible dans la morphologie.

Le prototype conserve des déformations lentes et peut créer une excroissance mémorielle après une longue absence.

Une pause de 60 secondes est le seuil actuel de retour après absence.

L'excroissance représente l'interruption elle-même, pas une note particulière.

## États

REST, ACTIVE, RESONANCE, OVERLOAD, RECOVERY, DORMANT, AWAKENING.

Ces états sont dérivés des variables et ne doivent pas devenir un HUD dans la version artistique finale.

## Principe

Le renderer ne connaît pas les notes. Le système musical modifie l'état de l'organisme ; la simulation fait évoluer cet état ; le renderer matérialise uniquement le résultat.
