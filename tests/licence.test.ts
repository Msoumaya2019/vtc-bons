/**
 * Licence : reconnaissance d'un droit signé, sans serveur.
 *
 * Ces tests n'utilisent PAS la clé privée du dépôt — elle est écartée par `.gitignore`,
 * donc absente sur toute autre machine, et un test qui en dépendrait échouerait au
 * premier clone. Chaque test engendre sa propre paire et la passe explicitement : ce
 * qui est éprouvé est le mécanisme de vérification, pas une clé en particulier.
 *
 * Deux tests font exception et portent sur la clé PUBLIÉE : ils vérifient qu'elle est
 * un point P-256 valide, et qu'elle refuse une licence signée par une autre. Sans eux,
 * une faute de recopie dans la constante ne se verrait qu'au premier client.
 */

import { describe, expect, it } from 'vitest';
import {
  CLE_PUBLIQUE,
  messageRefus,
  verifierLicence,
  type ChargeLicence,
  type MotifRefus,
} from '../src/lib/licence';
import { base64Url, chargeLicence, clePubliqueDe, engendrerPaire, signerLicence } from './aides';

function chargeValide(surcharge: Partial<ChargeLicence> = {}): ChargeLicence {
  return {
    sujet: 'Transports Dupont',
    expiration: '2030-01-01',
    type: 'abonnement',
    ...surcharge,
  };
}

const REFERENCE = new Date(2026, 8, 17);

describe('verifierLicence', () => {
  it('reconnaît une licence signée par la bonne clé', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeValide(), paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(true);
    if (etat.valide) {
      expect(etat.charge.sujet).toBe('Transports Dupont');
      expect(etat.charge.type).toBe('abonnement');
    }
  });

  it('calcule les jours restants depuis la date de référence', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeValide({ expiration: '2026-09-20' }), paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(true);
    if (etat.valide) expect(etat.joursRestants).toBe(3);
  });

  it('accepte encore le dernier jour couvert', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeValide({ expiration: '2026-09-17' }), paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(true);
    if (etat.valide) expect(etat.joursRestants).toBe(0);
  });

  it('refuse une licence expirée, et dit à quelle date', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeValide({ expiration: '2026-09-16' }), paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(false);
    if (!etat.valide) {
      expect(etat.motif).toBe('expiree');
      expect(etat.expiration).toBe('2026-09-16');
    }
  });

  it('refuse une charge modifiée après signature', async () => {
    const paire = await engendrerPaire();
    const cle = await clePubliqueDe(paire);
    const jeton = await signerLicence(chargeValide(), paire.privateKey);

    // On remplace la charge par une autre, en gardant la signature d'origine.
    const signature = jeton.split('.')[1];
    const falsifie = `${base64Url(
      new TextEncoder().encode(JSON.stringify(chargeValide({ expiration: '2099-01-01' }))),
    )}.${signature}`;

    const etat = await verifierLicence(falsifie, { clePublique: cle, reference: REFERENCE });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('signature');
  });

  it('refuse une licence signée par une autre clé', async () => {
    const vrai = await engendrerPaire();
    const faux = await engendrerPaire();
    const jeton = await signerLicence(chargeValide(), faux.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(vrai),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('signature');
  });

  it('refuse une charge signée mais dépourvue des champs attendus', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence({ sujet: 'X', expiration: '2030-01-01' }, paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('illisible');
  });

  it('refuse une date d’expiration qui n’est pas au bon format', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(
      chargeLicence({ expiration: '01/01/2030' }),
      paire.privateKey,
    );

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('illisible');
  });

  it('refuse un type de licence inconnu', async () => {
    const paire = await engendrerPaire();
    const jeton = await signerLicence(chargeLicence({ type: 'gratuit' }), paire.privateKey);

    const etat = await verifierLicence(jeton, {
      clePublique: await clePubliqueDe(paire),
      reference: REFERENCE,
    });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('illisible');
  });

  it('distingue l’absence de licence d’une licence illisible', async () => {
    expect(await verifierLicence('')).toEqual({
      valide: false,
      motif: 'absente',
      expiration: null,
    });
    expect(await verifierLicence('   ')).toEqual({
      valide: false,
      motif: 'absente',
      expiration: null,
    });

    for (const jeton of ['sans-point', 'a.b.c', '!!!.???', '====.====', '.']) {
      const etat = await verifierLicence(jeton);
      expect(etat.valide).toBe(false);
      if (!etat.valide) expect(etat.motif).toBe('illisible');
    }
  });
});

describe('clé publique publiée', () => {
  it('est un point P-256 non compressé', () => {
    const octets = Buffer.from(CLE_PUBLIQUE, 'base64url');
    expect(octets.length).toBe(65);
    expect(octets[0]).toBe(0x04);
  });

  it('ne reconnaît pas une licence signée par une autre clé', async () => {
    const autre = await engendrerPaire();
    const jeton = await signerLicence(chargeValide(), autre.privateKey);

    // Sans `clePublique`, la vérification emploie la constante publiée.
    const etat = await verifierLicence(jeton, { reference: REFERENCE });

    expect(etat.valide).toBe(false);
    if (!etat.valide) expect(etat.motif).toBe('signature');
  });
});

describe('messageRefus', () => {
  it('explique chaque motif', () => {
    const motifs: MotifRefus[] = ['absente', 'illisible', 'signature', 'expiree'];
    for (const motif of motifs) {
      expect(messageRefus(motif).length).toBeGreaterThan(10);
    }
  });
});
