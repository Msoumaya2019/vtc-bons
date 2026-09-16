/**
 * Contenu des documents PDF.
 *
 * Ces tests portent sur le module PUR `documentData` : tout ce qui est imprimé y est
 * construit. Tester ici plutôt que sur le rendu binaire permet de vérifier précisément
 * que les 7 mentions de l'arrêté sortent AVEC UNE VALEUR — un justificatif qui affiche
 * sept libellés suivis de blancs est un justificatif non conforme.
 */

import { describe, expect, it } from 'vitest';
import {
  construireDonneesBon,
  construireDonneesFacture,
  construireMentionsJustificatif,
  nomFichierPdf,
} from '../src/lib/pdf/documentData';
import { MENTION_FRANCHISE } from '../src/lib/tva';
import { MENTIONS_ARRETE_2025 } from '../src/lib/mentions';
import { bonTest, clientTest, factureTest, ligneTest, reglagesTest } from './aides';
import { snapshotClient, snapshotEmetteur } from '../src/lib/snapshots';

describe('construireMentionsJustificatif', () => {
  const bon = bonTest();
  const reglages = reglagesTest();
  const client = clientTest();
  const mentions = construireMentionsJustificatif(bon, snapshotEmetteur(reglages), snapshotClient(client));

  it('produit les 7 mentions, numérotées de 1 à 7', () => {
    expect(mentions).toHaveLength(7);
    expect(mentions.map((mention) => mention.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('reprend exactement les libellés du référentiel', () => {
    expect(mentions.map((mention) => mention.libelle)).toEqual([...MENTIONS_ARRETE_2025]);
  });

  it('ne laisse AUCUNE mention sans valeur', () => {
    // C'est le cœur du test : sept libellés vides seraient pires qu'inutiles en contrôle.
    for (const mention of mentions) {
      expect(mention.valeur.trim(), `mention ${mention.numero} vide`).not.toBe('');
    }
  });

  it('mention 1 — nom et coordonnées de l’exploitant', () => {
    expect(mentions[0].valeur).toBe(
      'Transports Dupont — 1 rue de la Gare, 95300 Pontoise, France — Tél. 06 12 34 56 78',
    );
  });

  it('mention 2 — numéro REVTC', () => {
    expect(mentions[1].valeur).toBe('EVTC0123456789');
  });

  it('mention 3 — SIREN', () => {
    expect(mentions[2].valeur).toBe('123456789');
  });

  it('mention 4 — nom et téléphone du client', () => {
    expect(mentions[3].valeur).toBe('Martin Leroy — Tél. 07 98 76 54 32');
  });

  it('mention 5 — date et heure de la réservation', () => {
    expect(mentions[4].valeur).toBe('14/03/2026 à 08:00');
  });

  it('mention 6 — date et heure de prise en charge', () => {
    expect(mentions[5].valeur).toBe('15/03/2026 à 09:30');
  });

  it('mention 7 — lieu de prise en charge indiqué par le client', () => {
    expect(mentions[6].valeur).toBe('12 rue de la Gare, 95300 Pontoise');
  });

  it('se rabat sur le SIRET quand le SIREN est absent', () => {
    const sansSiren = reglagesTest({ siren: '', siret: '12345678900012' });
    const resultat = construireMentionsJustificatif(
      bon,
      snapshotEmetteur(sansSiren),
      snapshotClient(client),
    );
    expect(resultat[2].valeur).toBe('12345678900012');
  });

  it('laisse la mention 4 vide plutôt que d’inventer un client absent', () => {
    const resultat = construireMentionsJustificatif(bon, snapshotEmetteur(reglages), null);
    expect(resultat[3].valeur).toBe('');
  });
});

describe('construireDonneesBon — identité et totaux', () => {
  const donnees = construireDonneesBon(bonTest(), reglagesTest(), clientTest());

  it('porte le titre de justificatif de réservation préalable', () => {
    expect(donnees.titre).toBe('BON DE COMMANDE');
    expect(donnees.sousTitre).toBe('Justificatif de réservation préalable');
  });

  it('affiche le numéro du bon', () => {
    expect(donnees.numero).toBe('BC-2026-0001');
  });

  it('affiche BROUILLON tant que le bon n’est pas émis', () => {
    const brouillon = construireDonneesBon(bonTest({ numero: null }), reglagesTest(), clientTest());
    expect(brouillon.numero).toBe('BROUILLON');
  });

  it('reporte les identifiants de l’exploitant dans l’en-tête', () => {
    expect(donnees.emetteur.nom).toBe('Transports Dupont');
    expect(donnees.emetteur.identifiants).toContain('SIREN 123456789');
    expect(donnees.emetteur.identifiants).toContain('REVTC EVTC0123456789');
    expect(donnees.emetteur.identifiants).toContain('TVA FR12345678901');
  });

  it('affiche l’identité complète du client, civilité comprise', () => {
    expect(donnees.client.nom).toBe('M. Martin Leroy');
  });

  it('affiche les totaux calculés par le moteur TVA', () => {
    expect(donnees.totaux.totalHT).toBe('100,00 €');
    expect(donnees.totaux.totalTVA).toBe('10,00 €');
    expect(donnees.totaux.totalTTC).toBe('110,00 €');
  });

  it('expose le détail de TVA par taux', () => {
    expect(donnees.totaux.detailTVA).toEqual([{ taux: '10 %', base: '100,00 €', montant: '10,00 €' }]);
  });

  it('n’affiche pas de ligne de remise quand il n’y en a pas', () => {
    expect(donnees.totaux.remise).toBeNull();
  });

  it('affiche la remise quand elle existe', () => {
    const avecRemise = construireDonneesBon(
      bonTest({ remiseGlobale: { type: 'pourcentage', valeur: 10 } }),
      reglagesTest(),
      clientTest(),
    );
    expect(avecRemise.totaux.remise).toBe('10,00 €');
    expect(avecRemise.totaux.totalHT).toBe('90,00 €');
    expect(avecRemise.totaux.totalTVA).toBe('9,00 €');
  });

  it('regroupe les informations de trajet et de véhicule', () => {
    const titres = donnees.blocs.map((bloc) => bloc.titre);
    expect(titres).toEqual(['Réservation', 'Trajet', 'Véhicule et conducteur']);
    const trajet = donnees.blocs[1].paires.find((paire) => paire.label === 'Lieu de prise en charge');
    expect(trajet?.valeur).toBe('12 rue de la Gare, 95300 Pontoise');
  });

  it('se rabat sur le client enregistré si le bon n’a pas encore de copie figée', () => {
    const sansSnapshot = construireDonneesBon(
      bonTest({ clientSnapshot: null }),
      reglagesTest(),
      clientTest({ nom: 'Durand Sophie' }),
    );
    expect(sansSnapshot.client.nom).toContain('Durand Sophie');
  });

  it('affiche un tiret plutôt que « undefined » quand le client manque', () => {
    const sansClient = construireDonneesBon(bonTest({ clientSnapshot: null }), reglagesTest(), null);
    expect(sansClient.client.nom).toBe('—');
  });

  it('rappelle le fondement légal en pied de page', () => {
    expect(donnees.piedDePage).toContain('L. 3120-2');
  });
});

describe('construireDonneesBon — franchise en base', () => {
  const reglages = reglagesTest({ regimeTVA: 'franchise_en_base' });
  const donnees = construireDonneesBon(bonTest(), reglages, clientTest());

  it('porte la mention « TVA non applicable, article 293 B du CGI »', () => {
    expect(donnees.mentionsLegales).toContain(MENTION_FRANCHISE);
  });

  it('n’expose AUCUN taux de TVA sur les lignes', () => {
    // Afficher un taux à 0 % serait une non-conformité : en franchise, la TVA n'existe pas.
    expect(donnees.lignes[0].taux).toBe('—');
  });

  it('n’affiche aucun montant de TVA', () => {
    expect(donnees.totaux.totalTVA).toBe('0,00 €');
    expect(donnees.totaux.detailTVA).toEqual([]);
  });

  it('laisse le total TTC égal au total HT', () => {
    expect(donnees.totaux.totalTTC).toBe(donnees.totaux.totalHT);
  });
});

describe('construireDonneesBon — débours', () => {
  it('affiche une ligne de débours distincte quand l’option est active', () => {
    const bon = bonTest({
      lignes: [
        ligneTest(),
        ligneTest({ id: 'ligne-2', libelle: 'Péage A15', prixUnitaireCentimes: 500, estDebours: true }),
      ],
    });
    const donnees = construireDonneesBon(bon, reglagesTest({ traitementPeages: 'debours' }), clientTest());

    expect(donnees.lignes[1].debours).toBe(true);
    expect(donnees.totaux.totalDebours).toBe('5,00 €');
    // Le débours ne doit pas entrer dans la base taxable.
    expect(donnees.totaux.totalHT).toBe('100,00 €');
    expect(donnees.totaux.totalTVA).toBe('10,00 €');
    expect(donnees.totaux.totalTTC).toBe('115,00 €');
  });

  it('intègre le péage à la base taxable quand l’option est inactive', () => {
    const bon = bonTest({
      lignes: [
        ligneTest(),
        ligneTest({ id: 'ligne-2', libelle: 'Péage A15', prixUnitaireCentimes: 500, estDebours: true }),
      ],
    });
    const donnees = construireDonneesBon(bon, reglagesTest({ traitementPeages: 'dans_base' }), clientTest());

    expect(donnees.totaux.totalDebours).toBeNull();
    expect(donnees.totaux.totalHT).toBe('105,00 €');
    expect(donnees.totaux.totalTVA).toBe('10,50 €');
  });
});

describe('construireDonneesFacture', () => {
  const facture = factureTest();
  const donnees = construireDonneesFacture(facture, reglagesTest());

  it('porte le titre FACTURE', () => {
    expect(donnees.titre).toBe('FACTURE');
    expect(donnees.sousTitre).toBe('Facture de transport de personnes');
  });

  it('n’affiche aucune mention de justificatif : ce n’est pas un bon', () => {
    expect(donnees.mentionsJustificatif).toEqual([]);
  });

  it('rappelle les trois dates obligatoires', () => {
    const dates = donnees.blocs[0].paires.map((paire) => paire.valeur);
    expect(dates).toContain('16/03/2026');
    expect(dates).toContain('15/03/2026');
    expect(dates).toContain('15/04/2026');
  });

  it('reprend les mentions d’assurance professionnelle', () => {
    const assurance = donnees.blocs.find((bloc) => bloc.titre === 'Assurance professionnelle');
    expect(assurance?.paires.find((paire) => paire.label === 'Assureur')?.valeur).toBe('Assur VTC');
  });

  it('affiche les pénalités de retard et l’indemnité de 40 €', () => {
    expect(donnees.blocs[1].paires.find((p) => p.label === 'Pénalités de retard')?.valeur).toContain('40 €');
  });

  it('porte la mention de TVA applicable', () => {
    expect(donnees.mentionsLegales.join(' ')).toContain('TVA');
  });

  it('rappelle la durée de conservation décennale', () => {
    expect(donnees.piedDePage).toContain('10 ans');
  });

  it('présente un avoir comme tel, en référence à la facture d’origine', () => {
    const avoir = construireDonneesFacture(
      factureTest({
        type: 'avoir',
        numero: 'AV-2026-0001',
        factureOrigineId: 'facture-1',
        lignes: [ligneTest({ prixUnitaireCentimes: -10000 })],
        montantHT: -10000,
        montantTVA: -1000,
        montantTTC: -11000,
        detailTVA: [{ taux: 10, baseHT: -10000, montantTVA: -1000 }],
      }),
      reglagesTest(),
    );
    expect(avoir.titre).toBe('AVOIR');
    expect(avoir.sousTitre).toContain('Annule et remplace');
    // Le signe négatif est celui de la locale : on vérifie la magnitude et le signe,
    // sans figer le caractère exact utilisé par Intl pour le moins.
    expect(avoir.totaux.totalTTC).toContain('110,00');
    expect(avoir.totaux.totalTTC).toMatch(/^[-−]/);
  });

  it('porte la mention 293 B sur un avoir en franchise', () => {
    const avoir = construireDonneesFacture(
      factureTest({
        type: 'avoir',
        detailTVA: [],
        montantTVA: 0,
        mentionTVA: MENTION_FRANCHISE,
      }),
      reglagesTest({ regimeTVA: 'franchise_en_base' }),
    );
    expect(avoir.mentionsLegales.join(' ')).toContain('293 B');
  });
});

describe('nomFichierPdf', () => {
  it('place la date en tête pour un tri chronologique correct', () => {
    expect(nomFichierPdf('2026-03-15', 'BC-2026-0001', 'Martin Leroy')).toBe(
      '2026-03-15_BC-2026-0001_Martin-Leroy.pdf',
    );
  });

  it('nettoie les caractères problématiques du nom de client', () => {
    expect(nomFichierPdf('2026-03-15', 'FA-2026-0001', 'M. Martin Leroy / Paris')).toBe(
      '2026-03-15_FA-2026-0001_M-Martin-Leroy-Paris.pdf',
    );
  });

  it('supporte un nom de client vide sans produire de double séparateur', () => {
    expect(nomFichierPdf('2026-03-15', 'BC-2026-0001', '')).toBe('2026-03-15_BC-2026-0001.pdf');
  });
});
