/**
 * CHAMP D'ADRESSE ASSISTÉ.
 *
 * Se comporte comme un champ de saisie ordinaire, avec deux aides :
 *   • des propositions au fil de la frappe, comme sur une carte ;
 *   • un bouton « Ma position », pour l'adresse de prise en charge.
 *
 * Trois précautions gouvernent ce composant :
 *
 *   1. Il reste un champ de saisie normal. Aucune proposition n'est obligatoire :
 *      le chauffeur peut toujours écrire une adresse à la main, y compris sans
 *      réseau. L'aide ne doit jamais devenir une contrainte.
 *   2. Les propositions n'interrogent le service qu'une fois la frappe retombée,
 *      et jamais avant quatre caractères.
 *   3. Échap ferme la liste SANS fermer la fenêtre qui l'abrite — sans quoi la
 *      saisie dans la modale client deviendrait impossible.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Bouton } from './Bouton';
import { Champ, Saisie } from './Champ';
import {
  adresseDepuisPosition,
  chercherAdresses,
  messageEchecPosition,
  positionActuelle,
} from '../../lib/geo';
import type { Adresse } from '../../lib/geo';

interface PropsChampAdresse {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /**
   * Appelé avec l'adresse complète lorsqu'elle vient d'une proposition ou de la
   * position, et avec null dès que le texte est retouché à la main : les
   * coordonnées connues ne valent alors plus rien.
   *
   * FACULTATIF : certains appelants n'ont besoin que du texte — un profil de bon
   * instantané, dont l'adresse est recopiée telle quelle sur le document. Les
   * obliger à fournir un rappel vide pour satisfaire une signature les pousserait
   * à écrire du code mort, et laisserait croire qu'ils exploitent des coordonnées
   * qu'ils ignorent.
   */
  onCoordonnees?: (adresse: Adresse | null) => void;
  /** Autorise les appels réseau. Faux : le champ redevient une simple saisie. */
  aideActive: boolean;
  /** Propose « Ma position ». À réserver au lieu de prise en charge. */
  positionProposee?: boolean;
  aide?: string;
  placeholder?: string;
  obligatoire?: boolean;
  mentionReglementaire?: boolean;
}

/** Laisse la frappe retomber avant d'interroger le service. */
const ATTENTE_FRAPPE_MS = 400;

/** En dessous, les propositions sont du bruit. */
const LONGUEUR_MINIMUM = 4;

export function ChampAdresse({
  label,
  valeur,
  onChange,
  onCoordonnees,
  aideActive,
  positionProposee = false,
  aide,
  placeholder,
  obligatoire = false,
  mentionReglementaire = false,
}: PropsChampAdresse) {
  const [propositions, setPropositions] = useState<Adresse[]>([]);
  const [ouverte, setOuverte] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);
  const [message, setMessage] = useState<string | null>(null);
  const [positionEnCours, setPositionEnCours] = useState(false);

  const listeId = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  /** Empêche de relancer une recherche juste après avoir choisi une proposition. */
  const apresChoix = useRef(false);

  useEffect(() => {
    if (!aideActive) return;

    if (apresChoix.current) {
      apresChoix.current = false;
      return;
    }

    const texte = valeur.trim();
    if (texte.length < LONGUEUR_MINIMUM) {
      setPropositions([]);
      setOuverte(false);
      return;
    }

    const controleur = new AbortController();
    const minuteur = setTimeout(() => {
      void chercherAdresses(texte, { signal: controleur.signal }).then((trouvees) => {
        if (controleur.signal.aborted) return;
        setPropositions(trouvees);
        setOuverte(trouvees.length > 0);
        setIndexActif(-1);
      });
    }, ATTENTE_FRAPPE_MS);

    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [valeur, aideActive]);

  // Un clic ailleurs referme la liste. On écoute `mousedown` pour agir avant que le
  // champ ne perde le focus, ce qui laisserait la liste ouverte sans raison.
  useEffect(() => {
    if (!ouverte) return;
    const surClic = (evenement: MouseEvent) => {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuverte(false);
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [ouverte]);

  const choisir = (adresse: Adresse) => {
    apresChoix.current = true;
    onChange(adresse.libelle);
    onCoordonnees?.(adresse);
    setPropositions([]);
    setOuverte(false);
    setIndexActif(-1);
    setMessage(null);
  };

  const surSaisie = (texte: string) => {
    onChange(texte);
    // Toute retouche manuelle invalide les coordonnées retenues : la distance
    // calculée à partir d'elles ne correspondrait plus à ce qui est affiché.
    onCoordonnees?.(null);
    setMessage(null);
  };

  const surTouche = (evenement: KeyboardEvent<HTMLInputElement>) => {
    if (!ouverte || propositions.length === 0) return;

    switch (evenement.key) {
      case 'ArrowDown':
        evenement.preventDefault();
        setIndexActif((index) => (index + 1) % propositions.length);
        break;
      case 'ArrowUp':
        evenement.preventDefault();
        setIndexActif((index) => (index <= 0 ? propositions.length - 1 : index - 1));
        break;
      case 'Enter':
        if (indexActif >= 0) {
          evenement.preventDefault();
          choisir(propositions[indexActif]);
        }
        break;
      case 'Escape':
        // La liste se ferme, la fenêtre qui l'abrite reste ouverte.
        evenement.stopPropagation();
        setOuverte(false);
        setIndexActif(-1);
        break;
      default:
        break;
    }
  };

  const utiliserPosition = async () => {
    setPositionEnCours(true);
    setMessage(null);
    try {
      const resultat = await positionActuelle();
      if (!resultat.ok) {
        setMessage(messageEchecPosition(resultat.raison));
        return;
      }

      const adresse = await adresseDepuisPosition(resultat.position);
      if (!adresse) {
        setMessage(
          'Position obtenue, mais son adresse n’a pas pu être déterminée. Saisissez-la à la main.',
        );
        return;
      }
      choisir(adresse);
    } finally {
      setPositionEnCours(false);
    }
  };

  return (
    <div ref={conteneur} className="relative">
      <Champ
        label={label}
        aide={aide}
        obligatoire={obligatoire}
        mentionReglementaire={mentionReglementaire}
      >
        {(id) => (
          <>
            <div className="flex gap-2">
              <Saisie
                id={id}
                value={valeur}
                onChange={(evenement) => surSaisie(evenement.target.value)}
                onKeyDown={surTouche}
                onFocus={() => {
                  if (propositions.length > 0) setOuverte(true);
                }}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={ouverte}
                aria-controls={listeId}
                aria-autocomplete="list"
                aria-activedescendant={
                  indexActif >= 0 ? `${listeId}-${String(indexActif)}` : undefined
                }
              />
              {positionProposee && aideActive ? (
                <Bouton
                  petit
                  variante="secondaire"
                  chargement={positionEnCours}
                  onClick={() => void utiliserPosition()}
                >
                  Ma position
                </Bouton>
              ) : null}
            </div>

            {ouverte ? (
              <ul
                id={listeId}
                role="listbox"
                aria-label={`Propositions pour ${label}`}
                className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                {propositions.map((adresse, index) => (
                  <li
                    key={`${String(adresse.longitude)}-${String(adresse.latitude)}-${String(index)}`}
                    id={`${listeId}-${String(index)}`}
                    role="option"
                    aria-selected={index === indexActif}
                    // `mousedown` plutôt que `click` : le champ perdrait le focus avant
                    // que le clic n'aboutisse, et la liste se fermerait sous le doigt.
                    onMouseDown={(evenement) => {
                      evenement.preventDefault();
                      choisir(adresse);
                    }}
                    onMouseEnter={() => setIndexActif(index)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      index === indexActif
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'bg-transparent'
                    } text-slate-900 dark:text-slate-100`}
                  >
                    {adresse.libelle}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Champ>

      {message ? (
        <p className="erreur-champ" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
