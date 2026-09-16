/**
 * Rendu réel des PDF.
 *
 * Ce fichier est le seul à exécuter la vraie chaîne de rendu. Son but n'est pas de
 * vérifier la mise en page (le contenu est déjà couvert par documentData.test.ts) mais
 * de garantir que la chaîne complète ABOUTIT : un document non généré au moment de
 * l'émission serait invisible lors d'un contrôle en zone blanche.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, effacerToutesLesDonnees } from '../src/lib/db';
import {
  creerPdfBon,
  creerPdfFacture,
  estPdfValide,
  genererEtStockerPdfBon,
  genererEtStockerPdfFacture,
  regenererPdfFacture,
} from '../src/lib/pdf/generate';
import { bonTest, clientTest, factureTest, reglagesTest } from './aides';

const REGLAGES = reglagesTest();

/**
 * Le rendu est RÉELLEMENT exécuté dans ce fichier. Le premier document paie le
 * chargement à la demande du moteur PDF (plus d'un mégaoctet) puis la mise en page :
 * le délai par défaut de 5 secondes est trop court pour ce seul fichier. Le délai
 * global reste serré, pour que les tests unitaires échouent vite s'ils se bloquent.
 */
vi.setConfig({ testTimeout: 20_000 });

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

describe('creerPdfBon', () => {
  it('produit un PDF valide', async () => {
    const { blob } = await creerPdfBon(bonTest(), REGLAGES, clientTest());

    expect(blob.size).toBeGreaterThan(1000);
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('nomme le fichier de façon exploitable', async () => {
    const { nomFichier } = await creerPdfBon(bonTest(), REGLAGES, clientTest());

    expect(nomFichier).toBe('2026-03-15_BC-2026-0001_M-Martin-Leroy.pdf');
    expect(nomFichier.endsWith('.pdf')).toBe(true);
  });

  it('reste générable en franchise en base', async () => {
    const { blob } = await creerPdfBon(
      bonTest(),
      reglagesTest({ regimeTVA: 'franchise_en_base' }),
      clientTest(),
    );
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('reste générable sans client enregistré', async () => {
    const { blob } = await creerPdfBon(bonTest({ clientSnapshot: null }), REGLAGES, null);
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('reste générable avec un logo et une couleur de charte', async () => {
    const { blob } = await creerPdfBon(bonTest(), REGLAGES, clientTest(), {
      logo: '',
      couleurAccent: '#0f766e',
    });
    expect(await estPdfValide(blob)).toBe(true);
  });
});

describe('creerPdfFacture', () => {
  it('produit un PDF valide', async () => {
    const { blob } = await creerPdfFacture(factureTest(), REGLAGES);
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('nomme le fichier d’après la date d’émission', async () => {
    const { nomFichier } = await creerPdfFacture(factureTest(), REGLAGES);
    expect(nomFichier).toBe('2026-03-16_FA-2026-0001_M-Martin-Leroy.pdf');
  });

  it('appose le tampon PAYÉE sans échouer', async () => {
    const payee = factureTest({ statut: 'payee', datePaiement: '2026-03-20' });
    const { blob } = await creerPdfFacture(payee, REGLAGES);
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('produit un avoir lisible', async () => {
    const avoir = factureTest({
      type: 'avoir',
      numero: 'AV-2026-0001',
      montantHT: -10000,
      montantTVA: -1000,
      montantTTC: -11000,
      detailTVA: [{ taux: 10, baseHT: -10000, montantTVA: -1000 }],
      lignes: [{ ...factureTest().lignes[0], prixUnitaireCentimes: -10000 }],
    });
    const { blob } = await creerPdfFacture(avoir, REGLAGES);
    expect(await estPdfValide(blob)).toBe(true);
  });
});

describe('stockage du PDF en base', () => {
  it('attache le PDF au bon, ce qui le rend consultable hors connexion', async () => {
    await db.bons.put(bonTest());
    await genererEtStockerPdfBon('bon-1', REGLAGES, clientTest());

    const bon = await db.bons.get('bon-1');
    expect(bon?.pdfBlob).not.toBeNull();
    expect(bon?.pdfGenereLe).not.toBeNull();
    expect(await estPdfValide(bon?.pdfBlob as Blob)).toBe(true);
  });

  it('attache le PDF à la facture', async () => {
    await db.factures.put(factureTest());
    await genererEtStockerPdfFacture('facture-1', REGLAGES);

    const facture = await db.factures.get('facture-1');
    expect(await estPdfValide(facture?.pdfBlob as Blob)).toBe(true);
  });

  it('ne fait rien si le document n’existe pas, sans lever d’erreur', async () => {
    await expect(genererEtStockerPdfBon('inconnu', REGLAGES, null)).resolves.toBeNull();
    await expect(genererEtStockerPdfFacture('inconnue', REGLAGES)).resolves.toBeNull();
  });
});

describe('régénération', () => {
  it('conserve les montants figés et ne fait que réappliquer la charte', async () => {
    const facture = factureTest();
    await db.factures.put(facture);

    await regenererPdfFacture('facture-1', reglagesTest({ couleurAccent: '#0f766e' }));

    const apres = await db.factures.get('facture-1');
    expect(apres?.montantTTC).toBe(11000);
    expect(apres?.numero).toBe('FA-2026-0001');
    expect(await estPdfValide(apres?.pdfBlob as Blob)).toBe(true);
  });
});

describe('estPdfValide', () => {
  it('reconnaît un PDF', async () => {
    const { blob } = await creerPdfFacture(factureTest(), REGLAGES);
    expect(await estPdfValide(blob)).toBe(true);
  });

  it('rejette un contenu qui n’est pas un PDF', async () => {
    expect(await estPdfValide(new Blob(['bonjour']))).toBe(false);
    expect(await estPdfValide(new Blob([]))).toBe(false);
  });
});
