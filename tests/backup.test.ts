/**
 * Sauvegarde et restauration.
 *
 * C'est la protection la plus importante de l'application : les données sont
 * exclusivement locales. Un téléphone perdu sans sauvegarde, ce sont des années de
 * pièces comptables perdues. Ces tests vérifient donc qu'un aller-retour est fidèle
 * et qu'une sauvegarde corrompue est REFUSÉE avant toute écriture.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, effacerToutesLesDonnees, getSettings, saveSettings } from '../src/lib/db';
import {
  construireSauvegarde,
  exporterJson,
  exporterZip,
  fautIlRappelerSauvegarde,
  JOURS_AVANT_RAPPEL,
  lireArchiveZip,
  lireFichierSauvegarde,
  nomFichierSauvegarde,
  restaurerSauvegarde,
  VERSION_SAUVEGARDE,
  validerSauvegarde,
} from '../src/lib/backup';
import { bonTest, clientTest, factureTest, reglagesTest } from './aides';
import type { Sauvegarde } from '../src/types';

/** Remplit la base avec un jeu de données représentatif. */
async function remplirBase() {
  await saveSettings(reglagesTest({ raisonSociale: 'Transports Dupont' }));
  await db.clients.put(clientTest());
  await db.clients.put(clientTest({ id: 'client-2', nom: 'Durand Sophie', parDefaut: false }));
  await db.bons.put(bonTest());
  await db.factures.put(factureTest());
  await db.compteurs.put({ key: 'BC-2026', valeur: 1 });
  await db.documentsChauffeur.put({
    id: 'doc-1',
    libelle: 'Carte professionnelle VTC',
    numero: 'VTC-2019-0042',
    dateDelivrance: '2021-07-01',
    dateExpiration: '2027-06-30',
    note: '',
    ordre: 1,
  });
}

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

describe('construireSauvegarde', () => {
  it('embarque toutes les tables', async () => {
    await remplirBase();
    const sauvegarde = await construireSauvegarde();

    expect(sauvegarde.version).toBe(VERSION_SAUVEGARDE);
    expect(sauvegarde.clients).toHaveLength(2);
    expect(sauvegarde.bons).toHaveLength(1);
    expect(sauvegarde.factures).toHaveLength(1);
    expect(sauvegarde.compteurs).toHaveLength(1);
    expect(sauvegarde.documentsChauffeur).toHaveLength(1);
    expect(sauvegarde.settings.raisonSociale).toBe('Transports Dupont');
  });

  it('horodate l’export', async () => {
    const sauvegarde = await construireSauvegarde();
    expect(Number.isNaN(Date.parse(sauvegarde.exporteLe))).toBe(false);
  });
});

describe('validerSauvegarde', () => {
  it('accepte une sauvegarde produite par l’application', async () => {
    await remplirBase();
    const validation = validerSauvegarde(await construireSauvegarde());
    expect(validation.valide).toBe(true);
    expect(validation.resume).toEqual({ clients: 2, bons: 1, factures: 1, documents: 1 });
  });

  it('refuse un contenu qui n’est pas un objet', () => {
    expect(validerSauvegarde(null).valide).toBe(false);
    expect(validerSauvegarde('texte').valide).toBe(false);
    expect(validerSauvegarde(42).valide).toBe(false);
  });

  it('refuse un objet sans numéro de version', () => {
    const validation = validerSauvegarde({ clients: [], bons: [] });
    expect(validation.valide).toBe(false);
    expect(validation.erreurs.join(' ')).toContain('version');
  });

  it('refuse une sauvegarde produite par une version plus récente', () => {
    const validation = validerSauvegarde({
      version: VERSION_SAUVEGARDE + 1,
      clients: [],
      bons: [],
      factures: [],
      compteurs: [],
      documentsChauffeur: [],
      audit: [],
      settings: {},
    });
    expect(validation.valide).toBe(false);
    expect(validation.erreurs.join(' ')).toContain('plus récente');
  });

  it('refuse une sauvegarde dont une liste est corrompue', () => {
    const validation = validerSauvegarde({
      version: VERSION_SAUVEGARDE,
      clients: [],
      bons: 'pas un tableau',
      factures: [],
      compteurs: [],
      documentsChauffeur: [],
      audit: [],
      settings: {},
    });
    expect(validation.valide).toBe(false);
    expect(validation.erreurs.join(' ')).toContain('bons de commande');
  });

  it('refuse une sauvegarde sans réglages', () => {
    const validation = validerSauvegarde({
      version: VERSION_SAUVEGARDE,
      clients: [],
      bons: [],
      factures: [],
      compteurs: [],
      documentsChauffeur: [],
      audit: [],
    });
    expect(validation.valide).toBe(false);
    expect(validation.erreurs.join(' ')).toContain('réglages');
  });
});

describe('restaurerSauvegarde', () => {
  it('restaure à l’identique après effacement complet', async () => {
    await remplirBase();
    const sauvegarde = await construireSauvegarde();

    await effacerToutesLesDonnees();
    expect(await db.clients.count()).toBe(0);

    await restaurerSauvegarde(sauvegarde);

    expect(await db.clients.count()).toBe(2);
    expect(await db.bons.count()).toBe(1);
    expect(await db.factures.count()).toBe(1);
    expect(await db.compteurs.count()).toBe(1);
    expect(await db.documentsChauffeur.count()).toBe(1);
    expect((await getSettings()).raisonSociale).toBe('Transports Dupont');
  });

  it('remet le compteur au bon niveau, sans rejouer de numéro', async () => {
    await remplirBase();
    const sauvegarde = await construireSauvegarde();

    await effacerToutesLesDonnees();
    await restaurerSauvegarde(sauvegarde);

    expect((await db.compteurs.get('BC-2026'))?.valeur).toBe(1);
  });

  it('écrase les données existantes au lieu de les fusionner', async () => {
    await db.clients.put(clientTest({ id: 'client-ancien', nom: 'Ancien Client' }));

    const sauvegarde: Sauvegarde = {
      version: VERSION_SAUVEGARDE,
      exporteLe: new Date().toISOString(),
      settings: reglagesTest(),
      clients: [clientTest({ id: 'client-nouveau', nom: 'Nouveau Client' })],
      bons: [],
      factures: [],
      compteurs: [],
      documentsChauffeur: [],
      audit: [],
    };

    await restaurerSauvegarde(sauvegarde);

    expect(await db.clients.count()).toBe(1);
    expect(await db.clients.get('client-ancien')).toBeUndefined();
    expect((await db.clients.get('client-nouveau'))?.nom).toBe('Nouveau Client');
  });

  it('supporte une sauvegarde vide sans échouer', async () => {
    const vide: Sauvegarde = {
      version: VERSION_SAUVEGARDE,
      exporteLe: new Date().toISOString(),
      settings: reglagesTest(),
      clients: [],
      bons: [],
      factures: [],
      compteurs: [],
      documentsChauffeur: [],
      audit: [],
    };
    await expect(restaurerSauvegarde(vide)).resolves.toBeUndefined();
    expect(await db.clients.count()).toBe(0);
  });
});

describe('aller-retour par fichier JSON', () => {
  it('conserve les données à l’identique', async () => {
    await remplirBase();
    const blob = await exporterJson();
    const fichier = new File([blob], 'sauvegarde.json', { type: 'application/json' });

    const { validation, sauvegarde } = await lireFichierSauvegarde(fichier);
    expect(validation.valide).toBe(true);
    expect(sauvegarde).not.toBeNull();

    await effacerToutesLesDonnees();
    await restaurerSauvegarde(sauvegarde as Sauvegarde);

    const bon = await db.bons.get('bon-1');
    expect(bon?.numero).toBe('BC-2026-0001');
    expect(bon?.lieuPriseEnCharge).toBe('12 rue de la Gare, 95300 Pontoise');
    expect((await db.factures.get('facture-1'))?.montantTTC).toBe(11000);
  });

  it('refuse un fichier qui n’est pas du JSON', async () => {
    const fichier = new File(['ceci n’est pas du json'], 'notes.txt', { type: 'text/plain' });
    const { validation, sauvegarde } = await lireFichierSauvegarde(fichier);
    expect(validation.valide).toBe(false);
    expect(sauvegarde).toBeNull();
    expect(validation.erreurs.join(' ')).toContain('JSON');
  });

  it('refuse un JSON valide mais étranger à l’application', async () => {
    const fichier = new File(['{"autre":true}'], 'autre.json', { type: 'application/json' });
    const { validation } = await lireFichierSauvegarde(fichier);
    expect(validation.valide).toBe(false);
  });
});

describe('aller-retour par archive ZIP', () => {
  it('contient le fichier de données et se relit', async () => {
    await remplirBase();
    const blob = await exporterZip();
    expect(blob.size).toBeGreaterThan(0);

    const fichier = new File([blob], 'sauvegarde.zip', { type: 'application/zip' });
    const { validation, sauvegarde } = await lireArchiveZip(fichier);

    expect(validation.valide).toBe(true);
    expect(sauvegarde?.clients).toHaveLength(2);
    expect(sauvegarde?.bons[0].numero).toBe('BC-2026-0001');
  });

  it('refuse une archive illisible', async () => {
    const fichier = new File(['pas une archive'], 'faux.zip', { type: 'application/zip' });
    const { validation } = await lireArchiveZip(fichier);
    expect(validation.valide).toBe(false);
  });
});

describe('nomFichierSauvegarde', () => {
  it('porte la date du jour et la bonne extension', () => {
    const nom = nomFichierSauvegarde('zip');
    expect(nom).toMatch(/^vtc-bons-sauvegarde-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});

describe('fautIlRappelerSauvegarde', () => {
  it('rappelle quand aucune sauvegarde n’a jamais été faite', () => {
    expect(fautIlRappelerSauvegarde(null)).toBe(true);
  });

  it('ne rappelle pas après une sauvegarde récente', () => {
    expect(fautIlRappelerSauvegarde(new Date().toISOString())).toBe(false);
  });

  it('rappelle au-delà du délai configuré', () => {
    const ancienne = new Date(Date.now() - (JOURS_AVANT_RAPPEL + 1) * 86_400_000).toISOString();
    expect(fautIlRappelerSauvegarde(ancienne)).toBe(true);
  });

  it('ne rappelle pas juste avant l’échéance', () => {
    const recente = new Date(Date.now() - (JOURS_AVANT_RAPPEL - 1) * 86_400_000).toISOString();
    expect(fautIlRappelerSauvegarde(recente)).toBe(false);
  });
});
