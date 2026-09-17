import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { ongletDepuisLien } from '../lib/lienProfond';
import { estApplicationNative } from '../lib/native';

/**
 * Ouvre l'onglet visé quand l'application est lancée par un lien profond.
 *
 * Deux cas, et il faut les deux :
 *
 *  - le démarrage à froid, où l'adresse est déjà là quand l'application s'ouvre
 *    (`getLaunchUrl`) ;
 *  - l'application déjà ouverte, que le système relance sur place (`appUrlOpen`).
 *
 * La navigation passe par `useNavigate`, JAMAIS par une écriture dans l'adresse. Le
 * routeur est le seul à savoir où il en est ; une écriture directe le laisserait sur
 * l'écran précédent, et l'application afficherait l'assistant de création alors que le
 * chauffeur vient de toucher son raccourci.
 *
 * Le remplacement (`replace`) plutôt qu'un empilement : après un raccourci, revenir en
 * arrière ne doit pas ramener sur l'écran qu'on n'a pas demandé.
 *
 * Rien de tout ceci n'a de sens dans un navigateur : le greffon n'y reçoit jamais
 * d'adresse. `estApplicationNative` évite de l'interroger pour rien, et rend le
 * composant inerte là où il n'a pas d'objet.
 */
export function EcouteLienProfond() {
  const naviguer = useNavigate();

  // La fonction de navigation est gardée dans une référence, et l'effet ci-dessous ne
  // dépend de RIEN. Ce n'est pas une coquetterie : `useNavigate` peut rendre une fonction
  // différente après chaque navigation. Un effet qui en dépendrait se rejouerait alors à
  // chaque changement d'écran, rappellerait `getLaunchUrl` et poserait un ÉCOUTEUR DE
  // PLUS à chaque fois — une fuite silencieuse, et un même lien traité plusieurs fois.
  // Le défaut a été trouvé en éprouvant les tests par mutation : sans la garde du
  // navigateur, `getLaunchUrl` était appelé deux fois pour un seul démarrage.
  const naviguerRef = useRef(naviguer);
  useEffect(() => {
    naviguerRef.current = naviguer;
  });

  useEffect(() => {
    if (!estApplicationNative()) return;

    // Le montage peut être annulé pendant que les deux appels asynchrones ci-dessous
    // sont en vol — en mode strict, React monte et démonte aussitôt. Sans ce drapeau,
    // l'écouteur serait posé APRÈS le démontage et ne serait jamais retiré.
    let vivant = true;
    let retirer: (() => void) | undefined;

    void (async () => {
      try {
        const lancement = await App.getLaunchUrl();
        const onglet = ongletDepuisLien(lancement?.url);
        if (vivant && onglet) naviguerRef.current(onglet, { replace: true });

        const ecoute = await App.addListener('appUrlOpen', (evenement) => {
          const cible = ongletDepuisLien(evenement.url);
          if (cible) naviguerRef.current(cible, { replace: true });
        });

        if (vivant) retirer = () => void ecoute.remove();
        else void ecoute.remove();
      } catch {
        // Un lien profond qui échoue ne doit pas empêcher l'application de démarrer :
        // le chauffeur retombe sur l'assistant de création, qui reste utilisable.
        // Lever ici priverait aussi de l'écouteur, donc des liens suivants.
      }
    })();

    return () => {
      vivant = false;
      retirer?.();
    };
  }, []);

  return null;
}
