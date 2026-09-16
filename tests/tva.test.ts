import { describe, expect, it } from 'vitest';
import {
  calculerRemiseTotale,
  calculerTotaux,
  htDepuisTTC,
  ligneDepuisPrixTTC,
  MENTION_FRANCHISE,
  montantLigne,
  repartirRemise,
  totalLignes,
  type OptionsCalcul,
} from '../src/lib/tva';
import { ligneTest } from './aides';
import type { LignePrestation } from '../src/types';

const assujetti: OptionsCalcul = {
  regimeTVA: 'assujetti',
  traitementPeages: 'dans_base',
  remiseGlobale: null,
};

const franchise: OptionsCalcul = {
  regimeTVA: 'franchise_en_base',
  traitementPeages: 'dans_base',
  remiseGlobale: null,
};

describe('TVA — transport de personnes à 10 %', () => {
  it('applique le taux réduit de 10 % à une course', () => {
    const resultat = calculerTotaux([ligneTest()], assujetti);
    expect(resultat.totalHT).toBe(10000);
    expect(resultat.totalTVA).toBe(1000);
    expect(resultat.totalTTC).toBe(11000);
    expect(resultat.detailTVA).toEqual([{ taux: 10, baseHT: 10000, montantTVA: 1000 }]);
  });

  it('applique le même taux aux services annexes, jamais 20 %', () => {
    // Attente, bagages et frais d'approche suivent le sort de la prestation principale.
    const lignes: LignePrestation[] = [
      ligneTest({ id: 'l1', libelle: 'Transport de personnes', prixUnitaireCentimes: 8000 }),
      ligneTest({ id: 'l2', libelle: 'Attente supplémentaire', prixUnitaireCentimes: 1500, tauxTVA: 10 }),
      ligneTest({ id: 'l3', libelle: 'Supplément bagages', prixUnitaireCentimes: 500, tauxTVA: 10 }),
      ligneTest({ id: 'l4', libelle: 'Frais d’approche', prixUnitaireCentimes: 1000, tauxTVA: 10 }),
    ];
    const resultat = calculerTotaux(lignes, assujetti);
    expect(resultat.detailTVA).toHaveLength(1);
    expect(resultat.detailTVA[0].taux).toBe(10);
    expect(resultat.totalHT).toBe(11000);
    expect(resultat.totalTVA).toBe(1100);
  });

  it('calcule la TVA par taux sur la base, jamais ligne à ligne', () => {
    // Deux lignes à 10 % : 333 + 333 centimes.
    // Par taux : round(666 x 0,10) = 67. Ligne à ligne : 33 + 33 = 66. L'écart doit apparaître.
    const lignes = [
      ligneTest({ id: 'l1', prixUnitaireCentimes: 333 }),
      ligneTest({ id: 'l2', prixUnitaireCentimes: 333 }),
    ];
    const resultat = calculerTotaux(lignes, assujetti);
    expect(resultat.totalHT).toBe(666);
    expect(resultat.totalTVA).toBe(67);
  });

  it('gère plusieurs taux dans le même document', () => {
    const lignes = [
      ligneTest({ id: 'l1', prixUnitaireCentimes: 10000, tauxTVA: 10 }),
      ligneTest({ id: 'l2', libelle: 'Prestation non liée au transport', prixUnitaireCentimes: 5000, tauxTVA: 20 }),
    ];
    const resultat = calculerTotaux(lignes, assujetti);
    expect(resultat.totalHT).toBe(15000);
    expect(resultat.totalTVA).toBe(2000);
    expect(resultat.detailTVA).toEqual([
      { taux: 10, baseHT: 10000, montantTVA: 1000 },
      { taux: 20, baseHT: 5000, montantTVA: 1000 },
    ]);
  });

  it('accepte une quantité décimale', () => {
    const resultat = calculerTotaux([ligneTest({ quantite: 2.5, prixUnitaireCentimes: 4000 })], assujetti);
    expect(resultat.totalHT).toBe(10000);
  });

  it('gère un document sans ligne', () => {
    const resultat = calculerTotaux([], assujetti);
    expect(resultat.totalHT).toBe(0);
    expect(resultat.totalTVA).toBe(0);
    expect(resultat.totalTTC).toBe(0);
    expect(resultat.detailTVA).toEqual([]);
  });
});

describe('TVA — franchise en base', () => {
  it('ne facture aucune TVA et expose la mention de l’article 293 B', () => {
    const resultat = calculerTotaux([ligneTest()], franchise);
    expect(resultat.totalTVA).toBe(0);
    expect(resultat.totalTTC).toBe(10000);
    expect(resultat.mentionTVA).toBe(MENTION_FRANCHISE);
  });

  it('n’expose AUCUN détail de TVA, ce qui serait une non-conformité', () => {
    const resultat = calculerTotaux([ligneTest(), ligneTest({ id: 'l2', tauxTVA: 20 })], franchise);
    expect(resultat.detailTVA).toEqual([]);
  });
});

describe('TVA — péages, parkings et débours', () => {
  const debours: OptionsCalcul = { ...assujetti, traitementPeages: 'debours' };

  it('intègre les péages à la base taxable à 10 % par défaut', () => {
    const lignes = [
      ligneTest({ id: 'l1', prixUnitaireCentimes: 10000 }),
      ligneTest({ id: 'l2', libelle: 'Péage', prixUnitaireCentimes: 1200, estDebours: true }),
    ];
    const resultat = calculerTotaux(lignes, assujetti);
    expect(resultat.totalDebours).toBe(0);
    expect(resultat.totalHT).toBe(11200);
    expect(resultat.totalTVA).toBe(1120);
    expect(resultat.totalTTC).toBe(12320);
  });

  it('exclut les débours de la base TVA quand l’option est active', () => {
    const lignes = [
      ligneTest({ id: 'l1', prixUnitaireCentimes: 10000 }),
      ligneTest({ id: 'l2', libelle: 'Péage', prixUnitaireCentimes: 1200, estDebours: true }),
    ];
    const resultat = calculerTotaux(lignes, debours);
    expect(resultat.totalDebours).toBe(1200);
    expect(resultat.totalHT).toBe(10000);
    expect(resultat.totalTVA).toBe(1000);
    // Le débours reste dû par le client, refacturé à l'identique et hors taxe.
    expect(resultat.totalTTC).toBe(12200);
  });
});

describe('TVA — remises', () => {
  it('applique une remise en pourcentage avant la TVA', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 10000 })], {
      ...assujetti,
      remiseGlobale: { type: 'pourcentage', valeur: 10 },
    });
    expect(resultat.totalRemise).toBe(1000);
    expect(resultat.totalHT).toBe(9000);
    expect(resultat.totalTVA).toBe(900);
    expect(resultat.totalTTC).toBe(9900);
  });

  it('applique une remise en montant', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 10000 })], {
      ...assujetti,
      remiseGlobale: { type: 'montant', valeur: 2500 },
    });
    expect(resultat.totalHT).toBe(7500);
    expect(resultat.totalTVA).toBe(750);
    expect(resultat.totalTTC).toBe(8250);
  });

  it('ramène la base à zéro pour une remise de 100 %, sans jamais passer en négatif', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 10000 })], {
      ...assujetti,
      remiseGlobale: { type: 'pourcentage', valeur: 100 },
    });
    expect(resultat.totalHT).toBe(0);
    expect(resultat.totalTVA).toBe(0);
    expect(resultat.totalTTC).toBe(0);
  });

  it('borne une remise en montant supérieure au total', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 1000 })], {
      ...assujetti,
      remiseGlobale: { type: 'montant', valeur: 999999 },
    });
    expect(resultat.totalHT).toBe(0);
    expect(resultat.totalTTC).toBe(0);
  });

  it('répartit une remise entre plusieurs taux sans perdre un centime', () => {
    const resultat = calculerTotaux(
      [
        ligneTest({ id: 'l1', prixUnitaireCentimes: 3333, tauxTVA: 10 }),
        ligneTest({ id: 'l2', prixUnitaireCentimes: 6667, tauxTVA: 20 }),
      ],
      { ...assujetti, remiseGlobale: { type: 'montant', valeur: 1000 } },
    );
    // La remise doit être distribuée exactement, à la répartition près.
    expect(resultat.totalRemise).toBe(1000);
    const totalBases = resultat.detailTVA.reduce((somme, detail) => somme + detail.baseHT, 0);
    expect(totalBases).toBe(10000 - 1000);
  });

  it('répartit la remise exactement, même sur des bases qui ne se divisent pas', () => {
    const bases = new Map<number, number>([
      [10, 333],
      [20, 333],
      [5.5, 334],
    ]);
    const repartition = repartirRemise(bases, 100);
    const somme = [...repartition.values()].reduce((a, b) => a + b, 0);
    expect(somme).toBe(100);
    for (const [taux, base] of bases) {
      expect(repartition.get(taux) ?? 0).toBeLessThanOrEqual(base);
    }
  });

  it('calcule correctement le montant d’une remise en pourcentage', () => {
    expect(calculerRemiseTotale({ type: 'pourcentage', valeur: 10 }, 10000)).toBe(1000);
    expect(calculerRemiseTotale({ type: 'pourcentage', valeur: 100 }, 10000)).toBe(10000);
    expect(calculerRemiseTotale({ type: 'pourcentage', valeur: 150 }, 10000)).toBe(10000);
    expect(calculerRemiseTotale(null, 10000)).toBe(0);
    expect(calculerRemiseTotale({ type: 'pourcentage', valeur: 10 }, 0)).toBe(0);
  });
});

describe('TVA — saisie dans les deux sens', () => {
  it('retrouve le HT à partir d’un prix TTC', () => {
    expect(htDepuisTTC(11000, 10)).toEqual({ ht: 10000, tva: 1000 });
    expect(htDepuisTTC(10000, 0)).toEqual({ ht: 10000, tva: 0 });
    expect(htDepuisTTC(12000, 20)).toEqual({ ht: 10000, tva: 2000 });
  });

  it('construit une ligne à partir d’un prix unitaire TTC', () => {
    const ligne = ligneDepuisPrixTTC('Course', 1, 11000, 10, false, 'l1');
    expect(ligne.prixUnitaireCentimes).toBe(10000);
    expect(calculerTotaux([ligne], assujetti).totalTTC).toBe(11000);
  });

  it('conserve le TTC affiché après un aller-retour HT/TTC', () => {
    const ligne = ligneDepuisPrixTTC('Course', 1, 5000, 10, false, 'l1');
    expect(calculerTotaux([ligne], assujetti).totalTTC).toBe(5000);
  });
});

describe('TVA — arrondis limites', () => {
  it('arrondit un centime à 10 % vers le bas', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 1 })], assujetti);
    expect(resultat.totalTVA).toBe(0);
    expect(resultat.totalTTC).toBe(1);
  });

  it('arrondit correctement un demi-centime', () => {
    // 5 centimes à 10 % = 0,5 centime -> arrondi commercial à 1.
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 5 })], assujetti);
    expect(resultat.totalTVA).toBe(1);
  });

  it('reste exact sur des montants ronds élevés', () => {
    const resultat = calculerTotaux([ligneTest({ prixUnitaireCentimes: 100000000 })], assujetti);
    expect(resultat.totalTTC).toBe(110000000);
  });
});

describe('TVA — invariant : la somme des lignes est toujours égale au total', () => {
  const scenarios: { nom: string; lignes: LignePrestation[]; options: OptionsCalcul }[] = [
    {
      nom: 'course simple',
      lignes: [ligneTest({ prixUnitaireCentimes: 4500 })],
      options: assujetti,
    },
    {
      nom: 'multi-taux',
      lignes: [
        ligneTest({ id: 'l1', prixUnitaireCentimes: 3333, tauxTVA: 10 }),
        ligneTest({ id: 'l2', prixUnitaireCentimes: 6667, tauxTVA: 20 }),
      ],
      options: assujetti,
    },
    {
      nom: 'débours hors base',
      lignes: [
        ligneTest({ id: 'l1', prixUnitaireCentimes: 8000 }),
        ligneTest({ id: 'l2', prixUnitaireCentimes: 1345, estDebours: true }),
      ],
      options: { ...assujetti, traitementPeages: 'debours' },
    },
    {
      nom: 'remise en pourcentage',
      lignes: [ligneTest({ id: 'l1', prixUnitaireCentimes: 7777, tauxTVA: 10 })],
      options: { ...assujetti, remiseGlobale: { type: 'pourcentage', valeur: 33 } },
    },
    {
      nom: 'remise en montant avec débours',
      lignes: [
        ligneTest({ id: 'l1', prixUnitaireCentimes: 12345 }),
        ligneTest({ id: 'l2', prixUnitaireCentimes: 999, estDebours: true }),
      ],
      options: {
        ...assujetti,
        traitementPeages: 'debours',
        remiseGlobale: { type: 'montant', valeur: 2345 },
      },
    },
    {
      nom: 'franchise en base',
      lignes: [ligneTest({ id: 'l1', prixUnitaireCentimes: 6543 })],
      options: franchise,
    },
    {
      nom: 'montants minuscules',
      lignes: [
        ligneTest({ id: 'l1', prixUnitaireCentimes: 1 }),
        ligneTest({ id: 'l2', prixUnitaireCentimes: 2, tauxTVA: 20 }),
      ],
      options: assujetti,
    },
    {
      nom: 'quantités décimales',
      lignes: [ligneTest({ id: 'l1', quantite: 3.33, prixUnitaireCentimes: 1234 })],
      options: assujetti,
    },
  ];

  for (const scenario of scenarios) {
    it(`vérifie l’invariant sur le scénario « ${scenario.nom} »`, () => {
      const resultat = calculerTotaux(scenario.lignes, scenario.options);
      // Invariant : somme des lignes = total HT + remise + débours.
      expect(totalLignes(scenario.lignes)).toBe(
        resultat.totalHT + resultat.totalRemise + resultat.totalDebours,
      );
      // Et le TTC est toujours la somme exacte des trois composantes.
      expect(resultat.totalTTC).toBe(resultat.totalHT + resultat.totalTVA + resultat.totalDebours);
    });
  }

  it('calcule le montant d’une ligne avec arrondi au centime', () => {
    expect(montantLigne(ligneTest({ quantite: 3, prixUnitaireCentimes: 333 }))).toBe(999);
    expect(montantLigne(ligneTest({ quantite: 1.005, prixUnitaireCentimes: 1000 }))).toBe(1005);
  });
});
