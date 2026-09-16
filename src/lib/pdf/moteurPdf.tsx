/**
 * Le moteur de rendu PDF, isolé dans son propre module.
 *
 * Ce fichier est le SEUL point d'entrée vers @react-pdf/renderer. Il est chargé
 * dynamiquement par `generate.ts` : c'est ce qui permet de sortir la bibliothèque de
 * mise en page du lot initial téléchargé au démarrage de l'application.
 *
 * Conséquence à respecter : rien de ce qui est importé ici ne doit être importé
 * statiquement ailleurs, sinon le découpage perd tout effet.
 */

import { pdf } from '@react-pdf/renderer';
import { BonDocument } from './BonDocument';
import { FactureDocument } from './FactureDocument';
import type { DonneesPdf } from './documentData';

/** Rend un bon de commande et renvoie le PDF produit. */
export async function rendrePdfBon(donnees: DonneesPdf): Promise<Blob> {
  return pdf(<BonDocument donnees={donnees} />).toBlob();
}

/** Rend une facture ou un avoir. `paiement` déclenche le tampon « PAYÉE ». */
export async function rendrePdfFacture(
  donnees: DonneesPdf,
  paiement: { date: string } | null,
): Promise<Blob> {
  return pdf(<FactureDocument donnees={donnees} paiement={paiement} />).toBlob();
}
