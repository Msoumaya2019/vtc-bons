/**
 * Plafonds de la version d'essai.
 *
 * Ces tests verrouillent les trois décisions de comptage prises dans `src/lib/quota.ts`,
 * et chacune répond à un piège précis du modèle de données :
 *
 *  - `StatutBon` vaut 'brouillon' | 'emis' | 'annule' | 'facture'. Un bon FACTURÉ quitte
 *    'emis' : compter par statut le ferait sortir du total, et le chauffeur pourrait
 *    émettre sans fin. Le test « un bon déjà facturé reste compté » tient cette porte.
 *  - la table `factures` contient aussi les AVOIRS. Les compter punirait la correction
 *    d'une erreur.
 *  - un refus doit intervenir AVANT toute écriture : sans quoi un numéro serait consommé
 *    pour un document que le chauffeur n'a pas le droit d'émettre.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, effacerToutesLesDonnees, saveSettings } from '../src/lib/db';
import {
  ErreurQuota,
  PLAFONDS,
  compterConsomme,
  etatQuota,
  verifierPlafond,
} from '../src/lib/quota';
import { enGrace, etatAcces, joursDeGraceRestants, verifierAcces } from '../src/lib/acces';
import { estBloque } from '../src/context/AccesContext';
import { verifierLicence } from '../src/lib/licence';
import { emettreBon } from '../src/features/bons/service';
import {
  bonTest,
  chargeLicence,
  clePubliqueDe,
  clientTest,
  dateIlYA,
  engendrerPaire,
  factureTest,
  licenceValideTest,
  reglagesTest,
  signerLicence,
} from './aides';
import type { StatutBon, TypeFacture } from '../src/types';

/**
 * La vente est ALLUMÉE pour tout ce fichier.
 *
 * L'application, elle, l'éteint : `VENTE_ACTIVE` vaut `false` dans `src/lib/vente.ts`.
 * C'est une décision de livraison, pas une propriété du mécanisme — et ces tests
 * éprouvent le MÉCANISME. Les laisser s'éteindre avec lui reviendrait à ne plus rien
 * prouver, et à ne découvrir que le plafond est cassé qu'au moment de le rallumer, en
 * vendant.
 *
 * L'interrupteur est remplacé au niveau du module, et non passé en option à chaque appel,
 * pour deux raisons : il n'y a alors rien à oublier d'un appel à l'autre, et un renommage
 * de la constante fait échouer ce fichier bruyamment au lieu de le laisser passer en
 * silence avec un mock devenu inerte.
 *
 * Le fichier `tests/vente-eteinte.test.tsx` éprouve l'autre face, celle qui est livrée,
 * sans aucun remplacement.
 */
vi.mock('../src/lib/vente', () => ({ VENTE_ACTIVE: true }));

/**
 * Délai du seul test qui ÉMET réellement un bon.
 *
 * Ce test ne mesure pas une vitesse, il constate un aboutissement — or `emettreBon`
 * génère le PDF au passage, ce qui charge le moteur de rendu (plus de 500 ko) et
 * dépasse à lui seul le délai par défaut de cinq secondes. Relever le délai est donc la
 * bonne correction : alléger le test reviendrait à ne plus éprouver l'émission réelle,
 * c'est-à-dire à ne plus rien prouver.
 */
const DELAI_EMISSION = 20_000;

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

async function semerBons(nombre: number, statut: StatutBon = 'emis'): Promise<void> {
  await db.bons.bulkPut(
    Array.from({ length: nombre }, (_, index) =>
      bonTest({
        id: `bon-${index + 1}`,
        numero: `BC-2026-${String(index + 1).padStart(4, '0')}`,
        statut,
      }),
    ),
  );
}

async function semerFactures(nombre: number, type: TypeFacture = 'facture'): Promise<void> {
  await db.factures.bulkPut(
    Array.from({ length: nombre }, (_, index) =>
      factureTest({
        id: `facture-${index + 1}`,
        numero: `FA-2026-${String(index + 1).padStart(4, '0')}`,
        type,
      }),
    ),
  );
}

async function semerClients(nombre: number, supprime = false): Promise<void> {
  await db.clients.bulkPut(
    Array.from({ length: nombre }, (_, index) =>
      clientTest({ id: `client-${index + 1}`, nom: `Client ${index + 1}`, supprime }),
    ),
  );
}

describe('comptage des bons', () => {
  it('ne compte pas un brouillon', async () => {
    await db.bons.put(bonTest({ id: 'brouillon', numero: null, statut: 'brouillon' }));
    expect(await compterConsomme('bons')).toBe(0);
  });

  it('compte un bon émis', async () => {
    await semerBons(1);
    expect(await compterConsomme('bons')).toBe(1);
  });

  it('compte encore un bon déjà facturé', async () => {
    // Le piège : `creerFactureDepuisBon` fait passer le bon de 'emis' à 'facture'.
    await semerBons(1, 'facture');
    expect(await compterConsomme('bons')).toBe(1);
  });

  it('compte encore un bon annulé, car son numéro est consommé', async () => {
    await semerBons(1, 'annule');
    expect(await compterConsomme('bons')).toBe(1);
  });

  it('compte encore un bon mis à la corbeille', async () => {
    // `numbering.ts` : un document supprimé ne libère JAMAIS son numéro.
    await semerBons(1);
    await db.bons.update('bon-1', { supprime: true, supprimeLe: '2026-03-20T10:00:00.000Z' });
    expect(await compterConsomme('bons')).toBe(1);
  });

  it('ne se laisse pas abuser par un mélange de brouillons et d’émis', async () => {
    await semerBons(3);
    await db.bons.put(bonTest({ id: 'brouillon-1', numero: null, statut: 'brouillon' }));
    await db.bons.put(bonTest({ id: 'brouillon-2', numero: null, statut: 'brouillon' }));
    expect(await compterConsomme('bons')).toBe(3);
  });
});

describe('comptage des factures', () => {
  it('compte une facture', async () => {
    await semerFactures(1);
    expect(await compterConsomme('factures')).toBe(1);
  });

  it('ne compte pas un avoir', async () => {
    // Un avoir corrige une facture : le compter punirait la correction d'une erreur.
    await semerFactures(2, 'avoir');
    expect(await compterConsomme('factures')).toBe(0);
  });

  it('sépare les factures des avoirs dans un même lot', async () => {
    await semerFactures(3);
    await db.factures.bulkPut([
      factureTest({ id: 'avoir-1', numero: 'AV-2026-0001', type: 'avoir' }),
      factureTest({ id: 'avoir-2', numero: 'AV-2026-0002', type: 'avoir' }),
    ]);
    expect(await compterConsomme('factures')).toBe(3);
  });
});

describe('comptage des clients', () => {
  it('compte un client vivant', async () => {
    await semerClients(2);
    expect(await compterConsomme('clients')).toBe(2);
  });

  it('ne compte pas un client supprimé', async () => {
    // Une fiche saisie par erreur ne doit pas coûter un rang définitivement.
    await semerClients(2, true);
    expect(await compterConsomme('clients')).toBe(0);
  });
});

describe('etatQuota', () => {
  it('annonce le restant et n’atteint le plafond qu’au dernier document permis', async () => {
    await semerBons(PLAFONDS.bons - 1);
    const avant = await etatQuota('bons');
    expect(avant.utilise).toBe(PLAFONDS.bons - 1);
    expect(avant.restant).toBe(1);
    expect(avant.atteint).toBe(false);

    await semerBons(PLAFONDS.bons);
    const apres = await etatQuota('bons');
    expect(apres.restant).toBe(0);
    expect(apres.atteint).toBe(true);
  });

  it('ne descend jamais sous zéro même au-delà du plafond', async () => {
    await semerBons(PLAFONDS.bons + 5);
    const etat = await etatQuota('bons');
    expect(etat.utilise).toBe(PLAFONDS.bons + 5);
    expect(etat.restant).toBe(0);
    expect(etat.atteint).toBe(true);
  });
});

describe('verifierPlafond', () => {
  it('laisse passer en dessous du plafond', async () => {
    await semerBons(PLAFONDS.bons - 1);
    await expect(verifierPlafond('bons')).resolves.toBeUndefined();
  });

  it('lève au plafond, en nommant le type concerné', async () => {
    await semerBons(PLAFONDS.bons);
    await expect(verifierPlafond('bons')).rejects.toThrow(ErreurQuota);

    try {
      await verifierPlafond('bons');
      expect.unreachable('le plafond aurait dû être refusé');
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurQuota);
      expect((erreur as ErreurQuota).type).toBe('bons');
      expect((erreur as ErreurQuota).message).toContain('bons de commande');
    }
  });

  it('le plafond des bons ne bloque pas les factures', async () => {
    // C'est ce qui permet à un bon déjà émis d'être facturé.
    await semerBons(PLAFONDS.bons);
    await expect(verifierPlafond('factures')).resolves.toBeUndefined();
    await expect(verifierPlafond('clients')).resolves.toBeUndefined();
  });
});

describe('verifierAcces', () => {
  it('refuse quand le plafond est atteint et qu’aucune licence n’est enregistrée', async () => {
    await semerBons(PLAFONDS.bons);
    await expect(verifierAcces('bons')).rejects.toThrow(ErreurQuota);
  });

  it('laisse passer quand la licence est valide, plafond atteint ou non', async () => {
    await semerBons(PLAFONDS.bons + 3);
    const { jeton, clePublique } = await licenceValideTest();
    await saveSettings({ ...reglagesTest(), licence: jeton });

    await expect(verifierAcces('bons', { clePublique })).resolves.toBeUndefined();
    await expect(verifierAcces('clients', { clePublique })).resolves.toBeUndefined();
  });

  it('ne lève rien avec une licence expirée', async () => {
    await semerBons(PLAFONDS.bons);
    const paire = await engendrerPaire();
    const jeton = await signerLicence(
      chargeLicence({ expiration: '2020-01-01' }),
      paire.privateKey,
    );
    await saveSettings({ ...reglagesTest(), licence: jeton });

    await expect(
      verifierAcces('bons', { clePublique: await clePubliqueDe(paire) }),
    ).rejects.toThrow(ErreurQuota);
  });

  it('ne lève rien avec une licence fabriquée par une autre clé', async () => {
    await semerBons(PLAFONDS.bons);
    const vrai = await engendrerPaire();
    const faux = await engendrerPaire();
    const jeton = await signerLicence(chargeLicence(), faux.privateKey);
    await saveSettings({ ...reglagesTest(), licence: jeton });

    await expect(verifierAcces('bons', { clePublique: await clePubliqueDe(vrai) })).rejects.toThrow(
      ErreurQuota,
    );
  });
});

describe('grâce après échéance', () => {
  /**
   * Un abonnement se renouvelle par un paiement qui met un à trois jours ouvrés à
   * apparaître, et le jeton qui suit arrive par courriel, pendant que le chauffeur
   * conduit. Couper le jour même où la date passe punirait un client à jour pour un retard
   * qui ne vient pas de lui — et c'est le client qui paie qu'on perdrait.
   *
   * La date d'échéance est volontairement ancienne par rapport à la date de référence,
   * pour que ces tests ne dépendent pas du jour où on les exécute.
   */
  const ECHEANCE = '2026-01-10';

  async function licenceEchue() {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeLicence({ expiration: ECHEANCE }), paire.privateKey);
    await saveSettings({ ...reglagesTest(), licence: jeton });
    return clePubliqueDe(paire);
  }

  it('compte les jours restants de 3 à 1, puis s’arrête net', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeLicence({ expiration: ECHEANCE }), paire.privateKey);
    const clePublique = await clePubliqueDe(paire);

    /**
     * La référence est passée DES DEUX CÔTÉS, et c'est le point de ce test.
     *
     * `verifierLicence` la reçoit pour juger la licence ; `enGrace` et
     * `joursDeGraceRestants` en ont une AUSSI, qui vaut l'horloge du jour par défaut. Ne la
     * passer qu'à la première fait juger l'échéance à la date du test et la grâce à la date
     * du jour : les deux moitiés de la même règle se contredisent alors sans que rien ne le
     * signale, et le test mesure un désaccord au lieu de la règle.
     */
    const reference = (jour: number) => new Date(2026, 0, jour);
    const etat = async (jour: number) =>
      verifierLicence(jeton, { clePublique, reference: reference(jour) });

    // Le 10 est le DERNIER jour couvert : rien n'est échu, donc aucune grâce n'est ouverte.
    // La borne compte autant que le reste — une grâce qui s'ouvrirait un jour trop tôt
    // offrirait un jour gratuit à chaque échéance.
    expect(enGrace(await etat(10), reference(10))).toBe(false);
    expect(joursDeGraceRestants(await etat(10), reference(10))).toBeNull();

    expect(joursDeGraceRestants(await etat(11), reference(11))).toBe(3);
    expect(joursDeGraceRestants(await etat(12), reference(12))).toBe(2);
    expect(joursDeGraceRestants(await etat(13), reference(13))).toBe(1);
    expect(joursDeGraceRestants(await etat(14), reference(14))).toBeNull();

    expect(enGrace(await etat(11), reference(11))).toBe(true);
    expect(enGrace(await etat(13), reference(13))).toBe(true);
    expect(enGrace(await etat(14), reference(14))).toBe(false);
  });

  it('laisse créer pendant la grâce, et refuse au quatrième jour', async () => {
    await semerBons(PLAFONDS.bons);
    const clePublique = await licenceEchue();

    for (const jour of [11, 12, 13]) {
      await expect(
        verifierAcces('bons', { clePublique, reference: new Date(2026, 0, jour) }),
      ).resolves.toBeUndefined();
    }

    await expect(
      verifierAcces('bons', { clePublique, reference: new Date(2026, 0, 14) }),
    ).rejects.toThrow(ErreurQuota);
  });

  it('n’ouvre aucune grâce pour une licence absente : elle n’a jamais rien ouvert', async () => {
    await semerBons(PLAFONDS.bons);
    await expect(verifierAcces('bons')).rejects.toThrow(ErreurQuota);
  });

  /**
   * L'accord entre les deux moitiés de la même règle.
   *
   * `estBloque` décide de ce que l'ÉCRAN montre, `verifierAcces` de ce que le SERVICE
   * accepte. Ce sont deux fonctions distinctes, et c'est là que le désaccord se logerait :
   * un panneau de refus affiché devant une création qui fonctionne, ou l'inverse — une
   * création proposée qui échoue à l'enregistrement.
   *
   * Les échéances sont RELATIVES au jour de l'exécution, et c'est forcé : `estBloque` lit
   * l'horloge elle-même et n'accepte aucune référence. Une date figée ferait passer ce test
   * le jour où on l'écrit et échouerait la semaine suivante — le contraire de ce qu'on veut
   * prouver.
   */
  it('l’écran et le service s’accordent sur la grâce', async () => {
    await semerBons(PLAFONDS.bons);

    const paire = await engendrerPaire();
    const clePublique = await clePubliqueDe(paire);
    const licenceEchueDepuis = async (jours: number) => {
      const jeton = await signerLicence(
        chargeLicence({ expiration: dateIlYA(jours) }),
        paire.privateKey,
      );
      await saveSettings({ ...reglagesTest(), licence: jeton });
    };

    // Échue depuis deux jours : la grâce court, les deux doivent laisser passer.
    await licenceEchueDepuis(2);
    expect(estBloque(await etatAcces({ clePublique }), 'bons')).toBe(false);
    await expect(verifierAcces('bons', { clePublique })).resolves.toBeUndefined();

    // Échue depuis quatre jours : la grâce est finie, les deux doivent refuser.
    await licenceEchueDepuis(4);
    expect(estBloque(await etatAcces({ clePublique }), 'bons')).toBe(true);
    await expect(verifierAcces('bons', { clePublique })).rejects.toThrow(ErreurQuota);
  });
});

describe('etatAcces', () => {
  it('signale un blocage partiel sans verrouiller l’application', async () => {
    await semerBons(PLAFONDS.bons);
    const etat = await etatAcces();
    expect(etat.quotas.bons.atteint).toBe(true);
    expect(etat.quotas.factures.atteint).toBe(false);
    expect(etat.partiellementBloque).toBe(true);
    expect(etat.verrouille).toBe(false);
  });

  it('verrouille quand plus aucune création n’est possible', async () => {
    await semerBons(PLAFONDS.bons);
    await semerFactures(PLAFONDS.factures);
    await semerClients(PLAFONDS.clients);
    const etat = await etatAcces();
    expect(etat.verrouille).toBe(true);
  });

  it('ne verrouille rien quand la licence est valide', async () => {
    await semerBons(PLAFONDS.bons);
    const { jeton, clePublique } = await licenceValideTest();
    await saveSettings({ ...reglagesTest(), licence: jeton });

    const etat = await etatAcces({ clePublique });
    expect(etat.licence.valide).toBe(true);
  });
});

describe('écriture refusée', () => {
  it('refuse l’émission au plafond sans consommer de numéro ni toucher au bon', async () => {
    await semerBons(PLAFONDS.bons);
    await db.bons.put(bonTest({ id: 'bon-11', numero: null, statut: 'brouillon' }));

    const compteursAvant = await db.compteurs.toArray();

    await expect(emettreBon('bon-11', reglagesTest(), clientTest())).rejects.toThrow(ErreurQuota);

    // Le contrôle doit précéder la numérotation : sinon un numéro serait perdu, et la
    // séquence porterait un trou — ce que la réglementation interdit.
    expect(await db.compteurs.toArray()).toEqual(compteursAvant);

    const apres = await db.bons.get('bon-11');
    expect(apres?.numero).toBeNull();
    expect(apres?.statut).toBe('brouillon');
  });

  it(
    'émet normalement tant que le plafond n’est pas atteint',
    async () => {
      await semerBons(PLAFONDS.bons - 1);
      await db.bons.put(bonTest({ id: 'bon-10', numero: null, statut: 'brouillon' }));

      const emis = await emettreBon('bon-10', reglagesTest(), clientTest());

      expect(emis.statut).toBe('emis');
      expect(emis.numero).toBeTruthy();
      // La numérotation a bien été atteinte : le compteur existe désormais.
      expect(await db.compteurs.count()).toBe(1);
    },
    DELAI_EMISSION,
  );
});
