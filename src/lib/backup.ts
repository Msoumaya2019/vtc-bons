/**
 * Sauvegarde et restauration.
 *
 * C'est la protection la plus importante de l'application : les données étant
 * exclusivement locales, un téléphone perdu, cassé ou réinitialisé sans sauvegarde
 * signifie des années de pièces comptables perdues.
 *
 * Sur iOS, un site non utilisé pendant longtemps peut voir son stockage purgé.
 * L'application affiche donc un rappel si la dernière sauvegarde date de plus de 15 jours.
 */

import { strToU8, zipSync, unzipSync, strFromU8 } from 'fflate';
import { db, effacerToutesLesDonnees, getSettings, saveSettings } from './db';
import { dateLocaleISO } from './format';
import type { Sauvegarde } from '../types';

export const VERSION_SAUVEGARDE = 1;
export const JOURS_AVANT_RAPPEL = 15;

export async function construireSauvegarde(): Promise<Sauvegarde> {
  const [settings, clients, bons, factures, compteurs, documentsChauffeur, audit] = await Promise.all([
    getSettings(),
    db.clients.toArray(),
    db.bons.toArray(),
    db.factures.toArray(),
    db.compteurs.toArray(),
    db.documentsChauffeur.toArray(),
    db.audit.toArray(),
  ]);

  return {
    version: VERSION_SAUVEGARDE,
    exporteLe: new Date().toISOString(),
    settings,
    clients,
    bons,
    factures,
    compteurs,
    documentsChauffeur,
    audit,
  };
}

/** Export JSON seul : léger, suffisant pour restaurer les données. */
export async function exporterJson(): Promise<Blob> {
  const sauvegarde = await construireSauvegarde();
  const json = JSON.stringify(sauvegarde, null, 2);
  await saveSettings({ ...sauvegarde.settings, derniereSauvegarde: new Date().toISOString() });
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export ZIP complet : le JSON PLUS tous les PDF.
 * C'est le format à privilégier : il conserve les documents tels qu'ils ont été émis.
 */
export async function exporterZip(): Promise<Blob> {
  const sauvegarde = await construireSauvegarde();
  const fichiers: Record<string, Uint8Array> = {
    'donnees.json': strToU8(JSON.stringify(sauvegarde, null, 2)),
  };

  const ajouterPdf = async (dossier: string, numero: string, blob: Blob | null) => {
    if (!blob) return;
    const contenu = new Uint8Array(await blob.arrayBuffer());
    fichiers[`${dossier}/${numero || 'sans-numero'}.pdf`] = contenu;
  };

  for (const bon of sauvegarde.bons) {
    await ajouterPdf('bons', bon.numero ?? bon.id, bon.pdfBlob);
  }
  for (const facture of sauvegarde.factures) {
    await ajouterPdf('factures', facture.numero, facture.pdfBlob);
  }

  const archive = zipSync(fichiers, { level: 6 });
  await saveSettings({ ...sauvegarde.settings, derniereSauvegarde: new Date().toISOString() });
  return new Blob([archive], { type: 'application/zip' });
}

export function nomFichierSauvegarde(extension: 'json' | 'zip'): string {
  return `vtc-bons-sauvegarde-${dateLocaleISO()}.${extension}`;
}

export interface ResultatValidation {
  valide: boolean;
  erreurs: string[];
  resume: {
    clients: number;
    bons: number;
    factures: number;
    documents: number;
  } | null;
}

/** Valide un objet avant toute écriture. Aucune donnée n'est modifiée si la validation échoue. */
export function validerSauvegarde(objet: unknown): ResultatValidation {
  const erreurs: string[] = [];
  const vide = { valide: false, erreurs, resume: null };

  if (!objet || typeof objet !== 'object') {
    erreurs.push('Le fichier ne contient pas un objet JSON exploitable.');
    return vide;
  }

  const sauvegarde = objet as Partial<Sauvegarde>;

  if (typeof sauvegarde.version !== 'number') {
    erreurs.push('Le fichier ne porte pas de numéro de version : ce n’est pas une sauvegarde vtc-bons.');
  } else if (sauvegarde.version > VERSION_SAUVEGARDE) {
    erreurs.push(
      `Cette sauvegarde a été produite par une version plus récente de l’application (version ${sauvegarde.version}).`,
    );
  }

  const tableaux: [keyof Sauvegarde, string][] = [
    ['clients', 'clients'],
    ['bons', 'bons de commande'],
    ['factures', 'factures'],
    ['compteurs', 'compteurs'],
    ['documentsChauffeur', 'documents'],
    ['audit', 'journal'],
  ];

  for (const [cle, libelle] of tableaux) {
    if (!Array.isArray(sauvegarde[cle])) {
      erreurs.push(`La liste des ${libelle} est absente ou corrompue.`);
    }
  }

  if (!sauvegarde.settings || typeof sauvegarde.settings !== 'object') {
    erreurs.push('Les réglages sont absents ou corrompus.');
  }

  if (erreurs.length > 0) return vide;

  return {
    valide: true,
    erreurs: [],
    resume: {
      clients: sauvegarde.clients?.length ?? 0,
      bons: sauvegarde.bons?.length ?? 0,
      factures: sauvegarde.factures?.length ?? 0,
      documents: sauvegarde.documentsChauffeur?.length ?? 0,
    },
  };
}

/**
 * Restaure une sauvegarde. ÉCRASE toutes les données existantes.
 * L'appelant doit avoir recueilli une confirmation explicite de l'utilisateur.
 */
export async function restaurerSauvegarde(sauvegarde: Sauvegarde): Promise<void> {
  await effacerToutesLesDonnees();
  await db.transaction(
    'rw',
    [db.settings, db.clients, db.bons, db.factures, db.compteurs, db.documentsChauffeur, db.audit],
    async () => {
      await db.settings.put(sauvegarde.settings);
      if (sauvegarde.clients.length) await db.clients.bulkPut(sauvegarde.clients);
      if (sauvegarde.bons.length) await db.bons.bulkPut(sauvegarde.bons);
      if (sauvegarde.factures.length) await db.factures.bulkPut(sauvegarde.factures);
      if (sauvegarde.compteurs.length) await db.compteurs.bulkPut(sauvegarde.compteurs);
      if (sauvegarde.documentsChauffeur.length) {
        await db.documentsChauffeur.bulkPut(sauvegarde.documentsChauffeur);
      }
      if (sauvegarde.audit.length) await db.audit.bulkPut(sauvegarde.audit);
    },
  );
}

/** Lit un fichier de sauvegarde et renvoie l'objet validé, sans rien écrire. */
export async function lireFichierSauvegarde(fichier: File): Promise<{
  validation: ResultatValidation;
  sauvegarde: Sauvegarde | null;
}> {
  const texte = await fichier.text();
  let objet: unknown;
  try {
    objet = JSON.parse(texte);
  } catch {
    return {
      validation: { valide: false, erreurs: ['Le fichier n’est pas un JSON valide.'], resume: null },
      sauvegarde: null,
    };
  }
  const validation = validerSauvegarde(objet);
  return {
    validation,
    sauvegarde: validation.valide ? (objet as Sauvegarde) : null,
  };
}

/** Lit un export ZIP et en extrait le JSON. */
export async function lireArchiveZip(fichier: File): Promise<{
  validation: ResultatValidation;
  sauvegarde: Sauvegarde | null;
}> {
  try {
    const contenu = new Uint8Array(await fichier.arrayBuffer());
    const entrees = unzipSync(contenu);
    const donnees = entrees['donnees.json'];
    if (!donnees) {
      return {
        validation: {
          valide: false,
          erreurs: ['L’archive ne contient pas de fichier donnees.json.'],
          resume: null,
        },
        sauvegarde: null,
      };
    }
    const objet: unknown = JSON.parse(strFromU8(donnees));
    const validation = validerSauvegarde(objet);
    return { validation, sauvegarde: validation.valide ? (objet as Sauvegarde) : null };
  } catch {
    return {
      validation: { valide: false, erreurs: ['Archive illisible ou corrompue.'], resume: null },
      sauvegarde: null,
    };
  }
}

/** Indique si un rappel de sauvegarde doit être affiché. */
export function fautIlRappelerSauvegarde(derniereSauvegarde: string | null): boolean {
  if (!derniereSauvegarde) return true;
  const ecart = Date.now() - new Date(derniereSauvegarde).getTime();
  return ecart > JOURS_AVANT_RAPPEL * 86_400_000;
}
