/**
 * Service des factures.
 *
 * La génération de PDF est neutralisée ici : elle est lente et sans rapport avec la
 * logique testée. Ce qui compte dans ce fichier, c'est la protection contre la double
 * facturation, l'exactitude des montants reportés depuis le bon, et le calcul des
 * indicateurs — y compris la déduction des avoirs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/pdf/generate', () => ({
  genererEtStockerPdfFacture: vi.fn(async () => null),
  genererEtStockerPdfBon: vi.fn(async () => null),
  creerPdfBon: vi.fn(),
  creerPdfFacture: vi.fn(),
  regenererPdfBon: vi.fn(),
  regenererPdfFacture: vi.fn(),
  estPdfValide: vi.fn(async () => true),
  partagerPdf: vi.fn(),
}));

import { db, effacerToutesLesDonnees } from '../src/lib/db';
import {
  annulerPaiement,
  calculerIndicateurs,
  creerAvoir,
  creerFactureDepuisBon,
  creerFactureLibre,
  estEnRetard,
  lireFactures,
  marquerPayee,
  mettreFactureALaCorbeille,
  restaurerFacture,
  statutEffectif,
} from '../src/features/factures/service';
import { ErreurConformite } from '../src/features/bons/service';
import { avertissements, verifierConformiteFacture } from '../src/features/bons/conformite';
import { snapshotClient } from '../src/lib/snapshots';
import { bonTest, clientTest, factureTest, ligneTest, reglagesTest } from './aides';
import type { Facture } from '../src/types';

const REGLAGES = reglagesTest();

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

describe('statutEffectif', () => {
  it('laisse une facture émise non échue au statut émis', () => {
    const facture = factureTest({ dateEcheance: '2026-04-15' });
    expect(statutEffectif(facture, '2026-04-14')).toBe('emise');
  });

  it('bascule en retard le lendemain de l’échéance', () => {
    const facture = factureTest({ dateEcheance: '2026-04-15' });
    expect(statutEffectif(facture, '2026-04-16')).toBe('en_retard');
  });

  it('ne considère pas une facture échue le jour même comme en retard', () => {
    const facture = factureTest({ dateEcheance: '2026-04-15' });
    expect(statutEffectif(facture, '2026-04-15')).toBe('emise');
  });

  it('ne dégrade jamais une facture payée', () => {
    const facture = factureTest({ statut: 'payee', dateEcheance: '2020-01-01' });
    expect(statutEffectif(facture, '2026-04-16')).toBe('payee');
  });

  it('ne dégrade jamais une facture annulée', () => {
    const facture = factureTest({ statut: 'annulee', dateEcheance: '2020-01-01' });
    expect(statutEffectif(facture, '2026-04-16')).toBe('annulee');
  });

  it('est exposé par estEnRetard', () => {
    const facture = factureTest({ dateEcheance: '2026-04-15' });
    expect(estEnRetard(facture, '2026-04-16')).toBe(true);
    expect(estEnRetard(facture, '2026-04-14')).toBe(false);
  });
});

describe('creerFactureDepuisBon', () => {
  it('reporte exactement les montants du bon', async () => {
    await db.bons.put(bonTest());

    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });

    expect(facture.montantHT).toBe(10000);
    expect(facture.montantTVA).toBe(1000);
    expect(facture.montantTTC).toBe(11000);
    expect(facture.detailTVA).toEqual([{ taux: 10, baseHT: 10000, montantTVA: 1000 }]);
  });

  it('calcule l’échéance à partir du délai de paiement', async () => {
    await db.bons.put(bonTest());
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    expect(facture.dateEcheance).toBe('2026-04-15');
  });

  it('reprend la date de prise en charge comme date de prestation', async () => {
    await db.bons.put(bonTest());
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    expect(facture.datePrestation).toBe('2026-03-15');
  });

  it('attribue un numéro de la séquence des factures', async () => {
    await db.bons.put(bonTest());
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    expect(facture.numero).toBe('FA-2026-0001');
  });

  it('marque le bon comme facturé et le lie à la facture', async () => {
    await db.bons.put(bonTest());
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    const bon = await db.bons.get('bon-1');
    expect(bon?.statut).toBe('facture');
    expect(bon?.factureId).toBe(facture.id);
  });

  it('refuse de facturer un brouillon', async () => {
    await db.bons.put(bonTest({ statut: 'brouillon', numero: null }));
    await expect(
      creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' }),
    ).rejects.toThrow(/Émettez d’abord le bon/);
  });

  it('refuse la double facturation — la protection la plus importante du module', async () => {
    await db.bons.put(bonTest({ factureId: 'facture-existante' }));
    await expect(
      creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' }),
    ).rejects.toThrow(/déjà été facturé/);
  });

  it('refuse un bon introuvable', async () => {
    await expect(creerFactureDepuisBon('inconnu', REGLAGES)).rejects.toThrow(/introuvable/);
  });

  it('n’attribue aucun numéro quand la facturation est refusée', async () => {
    await db.bons.put(bonTest({ factureId: 'facture-existante' }));
    await expect(creerFactureDepuisBon('bon-1', REGLAGES)).rejects.toThrow();
    expect(await db.compteurs.get('FA-2026')).toBeUndefined();
  });

  it('refuse d’émettre une facture non conforme, avant toute écriture', async () => {
    // Le contrôle de conformité existait déjà, mais seul l'écran de détail l'appelait :
    // la facture était créée, numérotée et imprimée quoi qu'il arrive, et l'écran se
    // contentait d'afficher « À corriger » sur un document DÉJÀ émis. Le blocage prévu
    // pour le numéro de TVA intracommunautaire n'avait donc jamais pu se déclencher.
    await db.bons.put(bonTest());
    const sansTva = reglagesTest({ regimeTVA: 'assujetti', numeroTVAIntracom: '' });

    await expect(creerFactureDepuisBon('bon-1', sansTva)).rejects.toBeInstanceOf(ErreurConformite);

    expect(await db.factures.count()).toBe(0);
    expect(await db.compteurs.get('FA-2026')).toBeUndefined();
  });

  it('avertit, sans bloquer, quand l’adresse de l’acheteur manque', async () => {
    // L'adresse de l'acheteur n'est qu'un avertissement : les sources divergent sur son
    // exigence pour un client professionnel, et bloquer empêcherait d'émettre une facture
    // qui peut parfaitement être conforme. Ce qui compte, c'est que l'écran cesse
    // d'annoncer « toutes les mentions obligatoires sont renseignées ».
    const client = clientTest({ adresse: '', codePostal: '', ville: '' });
    await db.bons.put(bonTest({ clientSnapshot: snapshotClient(client) }));

    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });

    expect(facture.statut).toBe('emise');
    const avis = avertissements(verifierConformiteFacture(facture, REGLAGES));
    expect(avis.map((probleme) => probleme.champ)).toContain('adresseClient');
  });

  it('reporte la remise globale du bon', async () => {
    await db.bons.put(bonTest({ remiseGlobale: { type: 'pourcentage', valeur: 10 } }));
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    expect(facture.montantHT).toBe(9000);
    expect(facture.montantTVA).toBe(900);
    expect(facture.montantTTC).toBe(9900);
  });
});

describe('creerFactureLibre', () => {
  it('crée une facture sans bon de commande', async () => {
    const facture = await creerFactureLibre(clientTest(), [ligneTest()], REGLAGES, {
      dateEmission: '2026-03-16',
    });
    expect(facture.bonId).toBeNull();
    expect(facture.numero).toBe('FA-2026-0001');
    expect(facture.montantTTC).toBe(11000);
  });

  it('refuse d’émettre une facture non conforme, sans rien numéroter', async () => {
    const sansTva = reglagesTest({ regimeTVA: 'assujetti', numeroTVAIntracom: '' });

    await expect(
      creerFactureLibre(clientTest(), [ligneTest()], sansTva),
    ).rejects.toBeInstanceOf(ErreurConformite);

    expect(await db.factures.count()).toBe(0);
    expect(await db.compteurs.get('FA-2026')).toBeUndefined();
  });
});

describe('creerAvoir', () => {
  async function avoirSurFactureExistante() {
    const origine = factureTest();
    await db.factures.put(origine);
    return { origine, avoir: await creerAvoir(origine.id, REGLAGES) };
  }

  it('émet un avoir de type avoir, avec sa propre numérotation', async () => {
    const { avoir } = await avoirSurFactureExistante();
    expect(avoir.type).toBe('avoir');
    expect(avoir.numero).toBe('AV-2026-0001');
  });

  it('reste possible même quand une NOUVELLE facture serait refusée', async () => {
    // Asymétrie voulue, et à ne pas défaire : un avoir est le REMÈDE à une facture
    // fautive. Le soumettre au même contrôle qu'une facture neuve emprisonnerait le
    // chauffeur avec une facture qu'il ne pourrait plus annuler — en particulier les
    // factures créées avant que ce contrôle n'existe sur son appareil.
    const origine = factureTest();
    await db.factures.put(origine);
    const sansTva = reglagesTest({ regimeTVA: 'assujetti', numeroTVAIntracom: '' });

    const avoir = await creerAvoir(origine.id, sansTva);

    expect(avoir.type).toBe('avoir');
    expect(avoir.numero).toBe('AV-2026-0001');
  });

  it('produit des montants strictement négatifs', async () => {
    const { avoir } = await avoirSurFactureExistante();
    expect(avoir.montantHT).toBe(-10000);
    expect(avoir.montantTVA).toBe(-1000);
    expect(avoir.montantTTC).toBe(-11000);
    expect(avoir.lignes.every((ligne) => ligne.prixUnitaireCentimes < 0)).toBe(true);
  });

  it('référence la facture d’origine et l’annule', async () => {
    const { origine, avoir } = await avoirSurFactureExistante();
    expect(avoir.factureOrigineId).toBe(origine.id);
    expect((await db.factures.get(origine.id))?.statut).toBe('annulee');
  });

  it('refuse d’annuler un avoir par un avoir', async () => {
    const avoir = factureTest({ type: 'avoir', numero: 'AV-2026-0001' });
    await db.factures.put(avoir);
    await expect(creerAvoir(avoir.id, REGLAGES)).rejects.toThrow(/avoir ne peut pas/);
  });

  it('refuse d’annuler deux fois la même facture', async () => {
    const origine = factureTest({ statut: 'annulee' });
    await db.factures.put(origine);
    await expect(creerAvoir(origine.id, REGLAGES)).rejects.toThrow(/déjà annulée/);
  });

  it('refuse une facture introuvable', async () => {
    await expect(creerAvoir('inconnue', REGLAGES)).rejects.toThrow(/introuvable/);
  });
});

describe('paiement', () => {
  it('marque une facture payée avec sa date et son moyen', async () => {
    await db.factures.put(factureTest());
    await marquerPayee('facture-1', '2026-03-20', 'virement', REGLAGES);

    const facture = await db.factures.get('facture-1');
    expect(facture?.statut).toBe('payee');
    expect(facture?.datePaiement).toBe('2026-03-20');
    expect(facture?.moyenPaiement).toBe('virement');
  });

  it('annule un paiement saisi par erreur', async () => {
    await db.factures.put(factureTest({ statut: 'payee', datePaiement: '2026-03-20' }));
    await annulerPaiement('facture-1', REGLAGES);

    const facture = await db.factures.get('facture-1');
    expect(facture?.statut).toBe('emise');
    expect(facture?.datePaiement).toBeNull();
    expect(facture?.moyenPaiement).toBeNull();
  });
});

describe('corbeille', () => {
  it('masque une facture supprimée de la liste courante', async () => {
    await db.factures.put(factureTest());
    await mettreFactureALaCorbeille('facture-1');
    expect(await lireFactures()).toHaveLength(0);
  });

  it('la conserve et permet de la restaurer', async () => {
    await db.factures.put(factureTest());
    await mettreFactureALaCorbeille('facture-1');

    expect(await lireFactures(true)).toHaveLength(1);

    await restaurerFacture('facture-1');
    expect(await lireFactures()).toHaveLength(1);
  });

  it('ne libère pas le numéro d’une facture supprimée', async () => {
    await db.bons.put(bonTest());
    const facture = await creerFactureDepuisBon('bon-1', REGLAGES, { dateEmission: '2026-03-16' });
    await mettreFactureALaCorbeille(facture.id);

    await db.bons.put(bonTest({ id: 'bon-2', numero: 'BC-2026-0002', factureId: null }));
    const suivante = await creerFactureDepuisBon('bon-2', REGLAGES, { dateEmission: '2026-03-16' });
    expect(suivante.numero).toBe('FA-2026-0002');
  });
});

describe('calculerIndicateurs', () => {
  const base: Facture = factureTest();

  it('additionne le chiffre d’affaires TTC, le HT et la TVA', () => {
    const indicateurs = calculerIndicateurs([base], 2026);
    expect(indicateurs.chiffreAffairesTTC).toBe(11000);
    expect(indicateurs.totalHT).toBe(10000);
    expect(indicateurs.totalTVA).toBe(1000);
  });

  it('compte en attente les factures émises non réglées', () => {
    const indicateurs = calculerIndicateurs([base], 2026);
    expect(indicateurs.enAttente).toBe(11000);
  });

  it('retire de l’attente une facture payée', () => {
    const indicateurs = calculerIndicateurs([factureTest({ statut: 'payee' })], 2026);
    expect(indicateurs.enAttente).toBe(0);
    expect(indicateurs.chiffreAffairesTTC).toBe(11000);
  });

  it('compte les factures échues comme en retard', () => {
    const enRetard = factureTest({ dateEmission: '2026-01-05', dateEcheance: '2026-02-04' });
    expect(calculerIndicateurs([enRetard], 2026).nombreEnRetard).toBe(1);
  });

  it('ne compte pas en retard une échéance lointaine', () => {
    const aEcheance = factureTest({ dateEmission: '2026-01-05', dateEcheance: '2099-12-31' });
    expect(calculerIndicateurs([aEcheance], 2026).nombreEnRetard).toBe(0);
  });

  it('exclut entièrement une facture annulée', () => {
    const annulee = factureTest({ statut: 'annulee' });
    const indicateurs = calculerIndicateurs([annulee], 2026);
    expect(indicateurs.chiffreAffairesTTC).toBe(0);
    expect(indicateurs.totalHT).toBe(0);
    expect(indicateurs.totalTVA).toBe(0);
  });

  it('déduit un avoir du chiffre d’affaires', () => {
    const avoir = factureTest({
      type: 'avoir',
      numero: 'AV-2026-0001',
      lignes: [ligneTest({ prixUnitaireCentimes: -10000 })],
      montantHT: -10000,
      montantTVA: -1000,
      montantTTC: -11000,
      detailTVA: [{ taux: 10, baseHT: -10000, montantTVA: -1000 }],
    });
    const indicateurs = calculerIndicateurs([base, avoir], 2026);
    expect(indicateurs.chiffreAffairesTTC).toBe(0);
    expect(indicateurs.totalHT).toBe(0);
    expect(indicateurs.totalTVA).toBe(0);
  });

  it('ignore les documents d’une autre année', () => {
    const autreAnnee = factureTest({ dateEmission: '2025-12-31' });
    expect(calculerIndicateurs([autreAnnee], 2026).chiffreAffairesTTC).toBe(0);
    expect(calculerIndicateurs([autreAnnee], 2025).chiffreAffairesTTC).toBe(11000);
  });

  it('ignore les documents placés dans la corbeille', () => {
    const supprimee = factureTest({ supprime: true });
    expect(calculerIndicateurs([supprimee], 2026).chiffreAffairesTTC).toBe(0);
  });
});
