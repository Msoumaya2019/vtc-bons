/**
 * Numérotation des documents.
 *
 * Règles légales et fonctionnelles :
 *  - la séquence est continue, chronologique, SANS TROU et sans doublon ;
 *  - un document supprimé ne libère JAMAIS son numéro ;
 *  - les séquences des bons de commande, des factures et des avoirs sont séparées ;
 *  - l'incrément est ATOMIQUE : il s'exécute dans une transaction Dexie, ce qui protège
 *    des doubles clics et de l'ouverture de deux onglets sur la même application.
 *
 * Choix de conception : un BROUILLON n'a pas de numéro. Le numéro est attribué au moment
 * de l'émission. Sans cela, un brouillon abandonné créerait un trou dans la séquence,
 * ce qui est précisément ce que la réglementation interdit.
 */

import { db } from './db';
import type { Settings } from '../types';

export type TypeDocument = 'bon' | 'facture' | 'avoir';

export interface OptionsNumerotation {
  prefixe: string;
  annee: number;
  reinitialiserChaqueAnnee: boolean;
}

export function cleCompteur(options: OptionsNumerotation): string {
  return options.reinitialiserChaqueAnnee
    ? `${options.prefixe}-${options.annee}`
    : options.prefixe;
}

export function formatNumero(
  prefixe: string,
  annee: number,
  valeur: number,
  reinitialiserChaqueAnnee: boolean,
): string {
  const rang = String(valeur).padStart(4, '0');
  return reinitialiserChaqueAnnee ? `${prefixe}-${annee}-${rang}` : `${prefixe}-${rang}`;
}

export function optionsDepuisSettings(
  settings: Settings,
  type: TypeDocument,
  annee: number,
): OptionsNumerotation {
  const prefixe =
    type === 'bon'
      ? settings.prefixeBon
      : type === 'avoir'
        ? settings.prefixeAvoir
        : settings.prefixeFacture;
  return {
    // Un préfixe vide — ou composé uniquement d'espaces — produirait un numéro
    // inexploitable du type «    -2026-0001 ». On se rabat sur DOC dans ce cas.
    prefixe: (prefixe ?? '').trim().toUpperCase() || 'DOC',
    annee,
    reinitialiserChaqueAnnee: settings.reinitialiserChaqueAnnee,
  };
}

/**
 * Attribue le prochain numéro et incrémente le compteur, de façon atomique.
 * Cette fonction est la SEULE façon d'obtenir un numéro définitif.
 */
export async function prochainNumero(options: OptionsNumerotation): Promise<string> {
  const key = cleCompteur(options);
  return db.transaction('rw', db.compteurs, async () => {
    const existant = await db.compteurs.get(key);
    const valeur = (existant?.valeur ?? 0) + 1;
    await db.compteurs.put({ key, valeur });
    return formatNumero(options.prefixe, options.annee, valeur, options.reinitialiserChaqueAnnee);
  });
}

/** Aperçu du prochain numéro, SANS l'attribuer. Utilisé par les Réglages. */
export async function apercuNumero(options: OptionsNumerotation): Promise<string> {
  const existant = await db.compteurs.get(cleCompteur(options));
  return formatNumero(
    options.prefixe,
    options.annee,
    (existant?.valeur ?? 0) + 1,
    options.reinitialiserChaqueAnnee,
  );
}
