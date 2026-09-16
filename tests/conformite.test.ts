/**
 * Contrôle de conformité avant émission.
 *
 * Ces tests sont la traduction directe de l'arrêté du 6 août 2025. Chaque blocage testé
 * correspond à une mention dont l'absence rendrait le justificatif inopérant en contrôle.
 * Le test le plus important est celui de la chronologie : une réservation datée APRÈS la
 * prise en charge ne prouve pas qu'il y a eu réservation, elle prouve le contraire.
 */

import { describe, expect, it } from 'vitest';
import {
  avertissements,
  blocages,
  MENTIONS_ARRETE_2025,
  trouverClient,
  verifierConformiteBon,
  verifierConformiteFacture,
} from '../src/features/bons/conformite';
import { MENTIONS_ARRETE_2025 as MENTIONS_SOURCE } from '../src/lib/mentions';
import { bonTest, clientTest, factureTest, reglagesTest } from './aides';

/** Raccourci : vérifie la conformité d'un bon de test. */
function verifier(surchargeBon = {}, surchargeReglages = {}, client = clientTest()) {
  const bon = bonTest(surchargeBon);
  return verifierConformiteBon(bon, reglagesTest(surchargeReglages), client);
}

function champsBloques(problemes: ReturnType<typeof verifier>): string[] {
  return blocages(problemes).map((probleme) => probleme.champ);
}

describe('référentiel des mentions', () => {
  it('comporte exactement les 7 mentions de l’arrêté', () => {
    expect(MENTIONS_ARRETE_2025).toHaveLength(7);
  });

  it('est la même source que celle utilisée par le PDF', () => {
    // Une mention vérifiée doit être exactement une mention imprimée : deux listes
    // divergentes laisseraient passer un document incomplet tout en le déclarant conforme.
    expect(MENTIONS_ARRETE_2025).toBe(MENTIONS_SOURCE);
  });
});

describe('verifierConformiteBon — bon conforme', () => {
  it('ne bloque pas un bon complet', () => {
    expect(blocages(verifier())).toEqual([]);
  });
});

describe('verifierConformiteBon — mentions de l’exploitant', () => {
  it('bloque si la raison sociale est vide', () => {
    expect(champsBloques(verifier({}, { raisonSociale: '' }))).toContain('raisonSociale');
  });

  it('bloque si la raison sociale n’est faite que d’espaces', () => {
    expect(champsBloques(verifier({}, { raisonSociale: '   ' }))).toContain('raisonSociale');
  });

  it('bloque si le SIREN est absent', () => {
    expect(champsBloques(verifier({}, { siren: '' }))).toContain('siren');
  });

  it('bloque si le SIREN ne fait pas 9 chiffres', () => {
    expect(champsBloques(verifier({}, { siren: '12345' }))).toContain('siren');
    expect(champsBloques(verifier({}, { siren: '1234567890' }))).toContain('siren');
  });

  it('bloque si le téléphone de l’exploitant est absent', () => {
    expect(champsBloques(verifier({}, { telephone: '' }))).toContain('telephone');
  });

  it('bloque si le numéro REVTC est absent', () => {
    // La mention 2 est la plus fréquemment oubliée : elle doit bloquer, pas avertir.
    expect(champsBloques(verifier({}, { numeroREVTC: '' }))).toContain('numeroREVTC');
  });
});

describe('verifierConformiteBon — mention 4, le client', () => {
  it('bloque si aucun client n’est sélectionné', () => {
    const problemes = verifierConformiteBon(bonTest(), reglagesTest(), null);
    expect(champsBloques(problemes)).toContain('client');
  });

  it('bloque si le client n’a pas de téléphone', () => {
    const problemes = verifier({}, {}, clientTest({ telephone: '' }));
    const message =
      blocages(problemes).find((probleme) => probleme.champ === 'client')?.message ?? '';
    expect(message).toContain('téléphone');
    expect(message).toContain('arrêté du 6 août 2025');
  });

  it('accepte un client dont le nom est renseigné et le téléphone présent', () => {
    expect(blocages(verifier({}, {}, clientTest()))).toEqual([]);
  });
});

describe('verifierConformiteBon — mentions 5, 6 et 7', () => {
  it('bloque si le lieu de prise en charge est vide', () => {
    expect(champsBloques(verifier({ lieuPriseEnCharge: '' }))).toContain('lieuPriseEnCharge');
  });

  it('bloque si la date de réservation est absente', () => {
    expect(champsBloques(verifier({ dateReservation: '' }))).toContain('dateReservation');
  });

  it('bloque si l’heure de réservation est absente', () => {
    expect(champsBloques(verifier({ heureReservation: '' }))).toContain('dateReservation');
  });

  it('bloque si la date de prise en charge est absente', () => {
    expect(champsBloques(verifier({ datePriseEnCharge: '' }))).toContain('datePriseEnCharge');
  });

  it('bloque si l’heure de prise en charge est absente', () => {
    expect(champsBloques(verifier({ heurePriseEnCharge: '' }))).toContain('datePriseEnCharge');
  });
});

describe('verifierConformiteBon — chronologie réservation / prise en charge', () => {
  it('bloque quand la réservation est postérieure à la prise en charge', () => {
    const problemes = verifier({ dateReservation: '2026-03-16', heureReservation: '10:00' });
    const message =
      blocages(problemes).find((probleme) => probleme.champ === 'dateReservation')?.message ?? '';
    expect(message).toContain('APRÈS');
  });

  it('bloque même d’une seule minute d’écart', () => {
    const problemes = verifier({
      dateReservation: '2026-03-15',
      heureReservation: '09:31',
      datePriseEnCharge: '2026-03-15',
      heurePriseEnCharge: '09:30',
    });
    expect(champsBloques(problemes)).toContain('dateReservation');
  });

  it('autorise une réservation à l’instant même de la prise en charge', () => {
    const problemes = verifier({
      dateReservation: '2026-03-15',
      heureReservation: '09:30',
      datePriseEnCharge: '2026-03-15',
      heurePriseEnCharge: '09:30',
    });
    expect(champsBloques(problemes)).toEqual([]);
  });

  it('autorise une réservation quelques minutes avant', () => {
    const problemes = verifier({
      dateReservation: '2026-03-15',
      heureReservation: '09:00',
      datePriseEnCharge: '2026-03-15',
      heurePriseEnCharge: '09:30',
    });
    expect(champsBloques(problemes)).toEqual([]);
  });

  it('bloque une réservation à J+1 sans heure incohérente', () => {
    const problemes = verifier({
      dateReservation: '2026-03-16',
      heureReservation: '00:00',
      datePriseEnCharge: '2026-03-15',
      heurePriseEnCharge: '23:59',
    });
    expect(champsBloques(problemes)).toContain('dateReservation');
  });
});

describe('verifierConformiteBon — avertissements non bloquants', () => {
  it('avertit sans bloquer quand l’immatriculation est absente', () => {
    const problemes = verifier({ vehiculeImmatriculation: '' });
    expect(blocages(problemes)).toEqual([]);
    expect(avertissements(problemes).map((p) => p.champ)).toContain('vehiculeImmatriculation');
  });

  it('avertit sans bloquer quand la destination est absente', () => {
    const problemes = verifier({ destination: '' });
    expect(blocages(problemes)).toEqual([]);
    expect(avertissements(problemes).map((p) => p.champ)).toContain('destination');
  });

  it('avertit sans bloquer quand il n’y a aucune ligne de prestation', () => {
    const problemes = verifier({ lignes: [] });
    expect(blocages(problemes)).toEqual([]);
    expect(avertissements(problemes).map((p) => p.champ)).toContain('lignes');
  });

  it('avertit sans bloquer quand le nombre de passagers est absent', () => {
    const problemes = verifier({ nombrePassagers: null });
    expect(blocages(problemes)).toEqual([]);
    expect(avertissements(problemes).map((p) => p.champ)).toContain('nombrePassagers');
  });

  it('cumule plusieurs blocages plutôt que de s’arrêter au premier', () => {
    const problemes = verifier(
      { lieuPriseEnCharge: '' },
      { raisonSociale: '', numeroREVTC: '', siren: '' },
    );
    expect(champsBloques(problemes).sort()).toEqual(
      ['lieuPriseEnCharge', 'numeroREVTC', 'raisonSociale', 'siren'].sort(),
    );
  });
});

describe('verifierConformiteFacture', () => {
  it('ne bloque pas une facture complète', () => {
    expect(blocages(verifierConformiteFacture(factureTest(), reglagesTest()))).toEqual([]);
  });

  it('bloque une facture sans date d’émission', () => {
    const problemes = verifierConformiteFacture(factureTest({ dateEmission: '' }), reglagesTest());
    expect(champsBloques(problemes)).toContain('dateEmission');
  });

  it('bloque une facture sans date de prestation', () => {
    const problemes = verifierConformiteFacture(factureTest({ datePrestation: '' }), reglagesTest());
    expect(champsBloques(problemes)).toContain('datePrestation');
  });

  it('bloque une facture sans échéance', () => {
    const problemes = verifierConformiteFacture(factureTest({ dateEcheance: '' }), reglagesTest());
    expect(champsBloques(problemes)).toContain('dateEcheance');
  });

  it('bloque une facture sans acheteur identifié', () => {
    const facture = factureTest();
    const sansAcheteur = { ...facture, clientSnapshot: { ...facture.clientSnapshot, nom: '' } };
    expect(champsBloques(verifierConformiteFacture(sansAcheteur, reglagesTest()))).toContain('client');
  });

  it('bloque une facture sans ligne de prestation', () => {
    const problemes = verifierConformiteFacture(factureTest({ lignes: [] }), reglagesTest());
    expect(champsBloques(problemes)).toContain('lignes');
  });

  it('bloque un assujetti sans numéro de TVA intracommunautaire', () => {
    const problemes = verifierConformiteFacture(
      factureTest(),
      reglagesTest({ regimeTVA: 'assujetti', numeroTVAIntracom: '' }),
    );
    expect(champsBloques(problemes)).toContain('numeroTVAIntracom');
  });

  it('ne réclame aucun numéro de TVA en franchise en base', () => {
    const problemes = verifierConformiteFacture(
      factureTest(),
      reglagesTest({ regimeTVA: 'franchise_en_base', numeroTVAIntracom: '' }),
    );
    expect(champsBloques(problemes)).toEqual([]);
  });

  it('avertit sans bloquer si l’assureur n’est pas renseigné', () => {
    const problemes = verifierConformiteFacture(factureTest(), reglagesTest({ assureurNom: '' }));
    expect(blocages(problemes)).toEqual([]);
    expect(avertissements(problemes).map((p) => p.champ)).toContain('assureurNom');
  });
});

describe('trouverClient', () => {
  it('retrouve le client par identifiant', () => {
    const client = clientTest();
    expect(trouverClient([client], 'client-1')).toBe(client);
  });

  it('renvoie null si le client n’existe plus', () => {
    expect(trouverClient([], 'client-1')).toBeNull();
  });
});
