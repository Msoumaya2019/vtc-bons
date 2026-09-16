/**
 * Moteur de calcul HT / TVA / TTC — le cœur fiscal de l'application.
 *
 * Règles appliquées :
 *  - Transport de personnes par VTC : TVA au taux réduit de 10 % (art. 279 du CGI).
 *    C'est le taux par défaut, appliqué à la ligne principale.
 *  - Les services annexes (attente, bagages, frais d'approche, prise en charge,
 *    mise à disposition) suivent le sort de la prestation principale : ils sont donc
 *    aussi à 10 %. Ils ne doivent JAMAIS être traités comme des prestations distinctes à 20 %.
 *  - Péages et parkings refacturés : intégrés à la base taxable à 10 % par défaut.
 *    Si l'option « débours » est active, ils sont refacturés à l'identique, EXCLUS de la
 *    base HT, et la ligne porte la mention explicite de débours.
 *  - Régime de franchise en base : aucun montant de TVA, aucun taux exposé, et la mention
 *    obligatoire « TVA non applicable, article 293 B du CGI ».
 *
 * Ordre de calcul, strictement :
 *  1. montant de chaque ligne, arrondi au centime ;
 *  2. regroupement des bases HT PAR TAUX (jamais ligne à ligne) ;
 *  3. application de la remise globale, répartie entre les taux au prorata ;
 *  4. TVA calculée sur la base HT de chaque taux après remise, arrondie au centime ;
 *  5. total TTC = total HT + TVA + débours refacturés.
 *
 * INVARIANT GARANTI : la somme des montants de lignes est exactement égale à
 * `totalHT + totalDebours`. Voir `totalLignes()` et les tests associés.
 */

import type {
  DetailTVA,
  LignePrestation,
  RegimeTVA,
  RemiseGlobale,
  TraitementPeages,
} from '../types';
import { arrondiCentimes, pourcentageDe } from './money';

/** Taux réduit applicable au transport de personnes (art. 279 du CGI). */
export const TAUX_TRANSPORT_PERSONNES = 10;

export const MENTION_FRANCHISE = 'TVA non applicable, article 293 B du CGI';
export const MENTION_DEBOURS = "Débours — refacturé à l'identique";

/** Taux proposés dans le sélecteur. Le taux reste libre par ligne. */
export const TAUX_PROPOSES = [0, 5.5, 10, 20] as const;

export interface OptionsCalcul {
  regimeTVA: RegimeTVA;
  traitementPeages: TraitementPeages;
  remiseGlobale: RemiseGlobale | null;
}

export interface ResultatTotaux {
  /** Total HT taxable, après remise, hors débours. */
  totalHT: number;
  /** Débours refacturés à l'identique, hors base TVA. */
  totalDebours: number;
  totalTVA: number;
  /** Total dû par le client : totalHT + totalTVA + totalDebours. */
  totalTTC: number;
  detailTVA: DetailTVA[];
  mentionTVA: string;
  /** Montant total de la remise appliquée, en centimes. */
  totalRemise: number;
}

/** Montant d'une ligne, en centimes, arrondi au centime. */
export function montantLigne(ligne: LignePrestation): number {
  return arrondiCentimes(ligne.quantite * ligne.prixUnitaireCentimes);
}

/** Somme brute des lignes, en centimes. Sert à vérifier l'invariant de total. */
export function totalLignes(lignes: LignePrestation[]): number {
  return lignes.reduce((somme, ligne) => somme + montantLigne(ligne), 0);
}

export function mentionTVA(regime: RegimeTVA): string {
  return regime === 'franchise_en_base' ? MENTION_FRANCHISE : '';
}

/**
 * Montant total de la remise, borné à [0, totalBrut].
 * Une remise de 100 % ramène la base à zéro sans jamais la rendre négative.
 */
export function calculerRemiseTotale(remise: RemiseGlobale | null, totalBrut: number): number {
  if (!remise || totalBrut <= 0) return 0;
  if (remise.type === 'pourcentage') {
    const pourcentage = Math.max(0, Math.min(remise.valeur, 100));
    return pourcentageDe(totalBrut, pourcentage);
  }
  return Math.max(0, Math.min(Math.round(remise.valeur), totalBrut));
}

/**
 * Répartit la remise entre les taux, au prorata des bases.
 *
 * Méthode : plancher proportionnel pour chaque taux, puis distribution des centimes
 * restants aux taux ayant encore de la capacité. Le reste est toujours inférieur au
 * nombre de taux (un plancher perd moins d'un centime par taux), donc la boucle est
 * bornée et la somme distribuée est EXACTEMENT égale à la remise cible.
 */
export function repartirRemise(
  basesParTaux: Map<number, number>,
  remiseTotale: number,
): Map<number, number> {
  const cles = [...basesParTaux.keys()].sort((a, b) => a - b);
  const repartition = new Map<number, number>(cles.map((cle) => [cle, 0]));
  const totalBrut = cles.reduce((somme, cle) => somme + (basesParTaux.get(cle) ?? 0), 0);

  if (totalBrut <= 0 || remiseTotale <= 0) return repartition;

  const cible = Math.min(remiseTotale, totalBrut);
  let distribue = 0;

  for (const cle of cles) {
    const base = basesParTaux.get(cle) ?? 0;
    const part = Math.floor((cible * base) / totalBrut);
    repartition.set(cle, part);
    distribue += part;
  }

  let reste = cible - distribue;
  if (reste > 0) {
    // On sert d'abord les bases les plus élevées : l'écart d'arrondi est ainsi absorbé
    // là où il est le moins visible sur le document.
    const ordre = [...cles].sort(
      (a, b) => (basesParTaux.get(b) ?? 0) - (basesParTaux.get(a) ?? 0) || a - b,
    );
    let securite = 0;
    while (reste > 0 && securite <= ordre.length) {
      for (const cle of ordre) {
        if (reste === 0) break;
        const capacite = (basesParTaux.get(cle) ?? 0) - (repartition.get(cle) ?? 0);
        if (capacite > 0) {
          repartition.set(cle, (repartition.get(cle) ?? 0) + 1);
          reste -= 1;
        }
      }
      securite += 1;
    }
  }

  return repartition;
}

/** Calcule tous les totaux d'un document. */
export function calculerTotaux(lignes: LignePrestation[], options: OptionsCalcul): ResultatTotaux {
  const deboursHorsBase = options.traitementPeages === 'debours';

  const basesParTaux = new Map<number, number>();
  let totalDebours = 0;

  for (const ligne of lignes) {
    const montant = montantLigne(ligne);
    if (ligne.estDebours && deboursHorsBase) {
      totalDebours += montant;
      continue;
    }
    const taux = ligne.tauxTVA;
    basesParTaux.set(taux, (basesParTaux.get(taux) ?? 0) + montant);
  }

  const totalBrut = [...basesParTaux.values()].reduce((somme, base) => somme + base, 0);
  const totalRemise = calculerRemiseTotale(options.remiseGlobale, totalBrut);
  const remisesParTaux = repartirRemise(basesParTaux, totalRemise);

  const detailComplet: DetailTVA[] = [];
  let totalHT = 0;
  let totalTVA = 0;

  for (const [taux, base] of [...basesParTaux.entries()].sort((a, b) => a[0] - b[0])) {
    const baseApresRemise = base - (remisesParTaux.get(taux) ?? 0);
    const montantTVA =
      options.regimeTVA === 'franchise_en_base'
        ? 0
        : arrondiCentimes((baseApresRemise * taux) / 100);
    totalHT += baseApresRemise;
    totalTVA += montantTVA;
    detailComplet.push({ taux, baseHT: baseApresRemise, montantTVA });
  }

  // En franchise en base, aucun taux ni montant de TVA ne doit être exposé :
  // afficher un détail à 0 % serait une non-conformité.
  const detailTVA = options.regimeTVA === 'franchise_en_base' ? [] : detailComplet;

  return {
    totalHT,
    totalDebours,
    totalTVA,
    totalTTC: totalHT + totalTVA + totalDebours,
    detailTVA,
    mentionTVA: mentionTVA(options.regimeTVA),
    totalRemise,
  };
}

/**
 * Saisie « en TTC » : le chauffeur raisonne souvent en prix client TTC.
 * Renvoie le HT correspondant et la TVA, en centimes.
 */
export function htDepuisTTC(montantTTC: number, taux: number): { ht: number; tva: number } {
  const ht = taux === 0 ? montantTTC : arrondiCentimes(montantTTC / (1 + taux / 100));
  return { ht, tva: montantTTC - ht };
}

/** Construit une ligne à partir d'un prix unitaire saisi en TTC. */
export function ligneDepuisPrixTTC(
  libelle: string,
  quantite: number,
  prixUnitaireTTC: number,
  tauxTVA: number,
  estDebours: boolean,
  id: string,
): LignePrestation {
  return {
    id,
    libelle,
    quantite,
    prixUnitaireCentimes: htDepuisTTC(prixUnitaireTTC, tauxTVA).ht,
    tauxTVA,
    estDebours,
  };
}
