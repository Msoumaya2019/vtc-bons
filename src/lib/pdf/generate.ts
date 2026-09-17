/**
 * Service de génération et de manipulation des PDF.
 *
 * Le PDF est produit IMMÉDIATEMENT après l'émission et stocké en base (champ `pdfBlob`).
 * Il est donc consultable hors connexion, sans régénération, ce qui est indispensable
 * pour un contrôle routier en zone blanche.
 *
 * Aucune police distante n'est chargée : le rendu repose sur Helvetica, intégrée au
 * moteur de @react-pdf/renderer. Aucune requête réseau n'est émise pendant la génération.
 *
 * CHOIX DE CHARGE : le moteur de rendu PDF pèse à lui seul plusieurs centaines de
 * kilooctets. Il est donc chargé À LA DEMANDE, au premier document généré ou affiché, et
 * non au démarrage. Le chauffeur ouvre l'application pour montrer un bon en quelques
 * dixièmes de seconde ; il n'a pas à télécharger une bibliothèque de mise en page pour
 * cela. Le service worker précache le morceau différé, qui reste disponible hors
 * connexion.
 */

import { construireDonneesBon, construireDonneesFacture, nomFichierPdf } from './documentData';
import { db } from '../db';
import { partagerBlob } from '../fichiers';
import type { Bon, Client, Facture, Settings } from '../../types';

export interface PdfGenere {
  blob: Blob;
  nomFichier: string;
}

export interface Charte {
  logo: string;
  couleurAccent: string;
}

function charteDepuis(settings: Settings): Charte {
  return { logo: settings.logo, couleurAccent: settings.couleurAccent };
}

/**
 * Charge le moteur de rendu, une seule fois par session. La promesse est mémorisée :
 * deux documents générés coup sur coup ne paient qu'un seul chargement.
 */
let moteurPdf: Promise<typeof import('./moteurPdf')> | null = null;

function chargerMoteurPdf(): Promise<typeof import('./moteurPdf')> {
  moteurPdf ??= import('./moteurPdf');
  return moteurPdf;
}

/** Construit le PDF d'un bon. `charte` permet de réappliquer la charte actuelle. */
export async function creerPdfBon(
  bon: Bon,
  settings: Settings,
  client: Client | null,
  charte?: Charte,
): Promise<PdfGenere> {
  const donnees = construireDonneesBon(bon, settings, client, charte);
  const { rendrePdfBon } = await chargerMoteurPdf();
  const blob = await rendrePdfBon(donnees);
  return {
    blob,
    nomFichier: nomFichierPdf(
      bon.datePriseEnCharge || bon.dateReservation || new Date().toISOString().slice(0, 10),
      donnees.numero,
      donnees.client.nom,
    ),
  };
}

export async function creerPdfFacture(
  facture: Facture,
  settings: Settings,
  charte?: Charte,
): Promise<PdfGenere> {
  const donnees = construireDonneesFacture(facture, settings, charte);
  const paiement = facture.datePaiement ? { date: facture.datePaiement } : null;
  const { rendrePdfFacture } = await chargerMoteurPdf();
  const blob = await rendrePdfFacture(donnees, paiement);
  return {
    blob,
    nomFichier: nomFichierPdf(facture.dateEmission, donnees.numero, donnees.client.nom),
  };
}

/** Génère et stocke le PDF d'un bon. Appelé au moment de l'émission. */
export async function genererEtStockerPdfBon(
  bonId: string,
  settings: Settings,
  client: Client | null,
): Promise<PdfGenere | null> {
  const bon = await db.bons.get(bonId);
  if (!bon) return null;
  const resultat = await creerPdfBon(bon, settings, client);
  await db.bons.update(bonId, {
    pdfBlob: resultat.blob,
    pdfGenereLe: new Date().toISOString(),
  });
  return resultat;
}

export async function genererEtStockerPdfFacture(
  factureId: string,
  settings: Settings,
): Promise<PdfGenere | null> {
  const facture = await db.factures.get(factureId);
  if (!facture) return null;
  const resultat = await creerPdfFacture(facture, settings);
  await db.factures.update(factureId, {
    pdfBlob: resultat.blob,
    pdfGenereLe: new Date().toISOString(),
  });
  return resultat;
}

/**
 * Régénère un PDF à partir des données FIGÉES du document, en réappliquant seulement la
 * charte actuelle (logo, couleur). Les informations d'identité et les montants ne changent
 * jamais : un document émis reste opposable tel qu'il a été émis.
 */
export async function regenererPdfBon(
  bonId: string,
  settings: Settings,
  client: Client | null,
): Promise<PdfGenere | null> {
  const bon = await db.bons.get(bonId);
  if (!bon) return null;
  const resultat = await creerPdfBon(bon, settings, client, charteDepuis(settings));
  await db.bons.update(bonId, {
    pdfBlob: resultat.blob,
    pdfGenereLe: new Date().toISOString(),
  });
  return resultat;
}

export async function regenererPdfFacture(
  factureId: string,
  settings: Settings,
): Promise<PdfGenere | null> {
  const facture = await db.factures.get(factureId);
  if (!facture) return null;
  const resultat = await creerPdfFacture(facture, settings, charteDepuis(settings));
  await db.factures.update(factureId, {
    pdfBlob: resultat.blob,
    pdfGenereLe: new Date().toISOString(),
  });
  return resultat;
}

export { telechargerBlob as telechargerPdf } from '../fichiers';

/**
 * Partage du PDF par le meilleur moyen disponible : l'API du web quand elle existe — un
 * navigateur, et la WebView d'iOS qui suit Safari —, sinon les greffons natifs, seuls
 * capables de partager dans une WebView Android.
 *
 * Le chauffeur y trouve « Enregistrer dans Fichiers », Mail, Messages et le reste. Voir
 * `../fichiers` pour la raison de cet ordre.
 */
export async function partagerPdf(
  blob: Blob,
  nomFichier: string,
  titre: string,
): Promise<'partage' | 'telecharge'> {
  return partagerBlob(blob, nomFichier, titre, 'application/pdf');
}

/** Vérifie qu'un blob est bien un PDF (en-tête %PDF-). Utilisé par les tests. */
export async function estPdfValide(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 5) return false;
  const entete = await blob.slice(0, 5).text();
  return entete === '%PDF-';
}
