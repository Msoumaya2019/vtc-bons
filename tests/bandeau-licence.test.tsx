/**
 * Le bandeau d'état, éprouvé sur ses deux messages.
 *
 * L'état d'accès est FOURNI à la main plutôt que calculé, et c'est un choix qu'il faut
 * assumer : le composer autrement demanderait une licence signée, donc la clé privée, qui
 * est écartée du dépôt. Ce qui est éprouvé ici est le RENDU — quel message, sous quel
 * identifiant, avec quel libellé de lien — tandis que le calcul de l'état (une échéance
 * donne-t-elle encore droit à la grâce, et jusqu'à quand ?) est prouvé dans
 * `tests/quota.test.ts`, avec une paire de clés engendrée sur place.
 *
 * La séparation n'est pas cosmétique : les deux moitiés peuvent mentir séparément. Un
 * calcul juste affiché par un composant qui regarde le mauvais champ annoncerait au
 * chauffeur « Bons 47/10 » au moment précis où son abonnement vient d'échouer — des
 * chiffres faux, et alarmants, là où il faut lui dire quoi faire.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { EtatAcces } from '../src/lib/acces';
import type { EtatLicence } from '../src/lib/licence';
import { PLAFONDS, type TypeQuota } from '../src/lib/quota';
import { dateIlYA } from './aides';

/**
 * L'état est injecté par ce biais, et non par un contexte monté à la main : le composant
 * lit `useAcces`, et le remplacer est le seul moyen de lui donner une échéance passée sans
 * détenir la clé de signature.
 */
const accesSimule = vi.hoisted(() => ({ etat: null as EtatAcces | null }));

vi.mock('../src/context/AccesContext', () => ({
  useAcces: () => ({ etat: accesSimule.etat, chargement: false, rafraichir: async () => {} }),
}));

import { BandeauEssai } from '../src/features/premium/BandeauEssai';

/** Un état d'accès complet, à partir de la seule licence — le reste n'est que remplissage. */
function etatAvec(licence: EtatLicence, utilise = 0): EtatAcces {
  const quota = (type: TypeQuota) => ({
    type,
    utilise,
    plafond: PLAFONDS[type],
    restant: Math.max(0, PLAFONDS[type] - utilise),
    atteint: utilise >= PLAFONDS[type],
  });
  return {
    licence,
    quotas: { bons: quota('bons'), factures: quota('factures'), clients: quota('clients') },
    verrouille: false,
    partiellementBloque: false,
  };
}

/**
 * Une licence échue depuis `jours` jours.
 *
 * L'échéance est relative à aujourd'hui, et non figée : `joursDeGraceRestants` se juge
 * contre l'horloge du jour, sans référence injectable. Une date écrite en dur ferait passer
 * ce test le jour où on l'écrit et échouerait la semaine suivante.
 */
function licenceEchueDepuis(jours: number): EtatLicence {
  return { valide: false, motif: 'expiree', expiration: dateIlYA(jours) };
}

function afficher() {
  return render(
    <MemoryRouter>
      <BandeauEssai />
    </MemoryRouter>,
  );
}

describe('bandeau d’état', () => {
  it('disparaît quand la licence est valide', () => {
    accesSimule.etat = etatAvec({
      valide: true,
      charge: { sujet: 'Client', expiration: dateIlYA(-30), type: 'abonnement' },
      joursRestants: 30,
    });

    afficher();

    // Plus rien à compter, plus rien à annoncer : le bandeau n'a aucune raison d'occuper
    // un centimètre de l'écran d'un client à jour.
    expect(screen.queryByTestId('bandeau-essai')).toBeNull();
    expect(screen.queryByTestId('bandeau-grace')).toBeNull();
  });

  it('annonce le décompte de l’essai quand aucune licence n’est enregistrée', () => {
    accesSimule.etat = etatAvec({ valide: false, motif: 'absente', expiration: null });

    afficher();

    const bandeau = screen.getByTestId('bandeau-essai');
    expect(bandeau.textContent).toContain(`Bons 0/${PLAFONDS.bons}`);
    expect(bandeau.textContent).toContain(`Factures 0/${PLAFONDS.factures}`);
    expect(bandeau.textContent).toContain(`Clients 0/${PLAFONDS.clients}`);
    expect(screen.getByRole('link', { name: 'Débloquer' })).toBeTruthy();
  });

  it('annonce le renouvellement pendant la grâce, et non des compteurs', () => {
    // Échue depuis deux jours : le renouvellement est en route, tous les plafonds sont
    // encore levés. Afficher « Bons 0/10 » serait doublement faux — faux sur le droit, et
    // faux sur le compte, puisque la création n'est pas limitée à ce moment-là.
    accesSimule.etat = etatAvec(licenceEchueDepuis(2), 47);

    afficher();

    const bandeau = screen.getByTestId('bandeau-grace');
    expect(bandeau.textContent).toContain('Abonnement échu — 2 jours pour renouveler');
    expect(bandeau.textContent).not.toContain('47');
    expect(screen.getByRole('link', { name: 'Renouveler' })).toBeTruthy();
    expect(screen.queryByTestId('bandeau-essai')).toBeNull();
  });

  it('accorde le singulier au dernier jour de grâce', () => {
    accesSimule.etat = etatAvec(licenceEchueDepuis(3));

    afficher();

    expect(screen.getByTestId('bandeau-grace').textContent).toContain(
      'Abonnement échu — 1 jour pour renouveler',
    );
  });

  it('revient au décompte de l’essai la grâce passée', () => {
    // Le quatrième jour après l'échéance : la grâce est finie, la création est de nouveau
    // soumise aux plafonds, et le bandeau doit le dire.
    accesSimule.etat = etatAvec(licenceEchueDepuis(4), 2);

    afficher();

    expect(screen.queryByTestId('bandeau-grace')).toBeNull();
    expect(screen.getByTestId('bandeau-essai').textContent).toContain(`Bons 2/${PLAFONDS.bons}`);
  });
});
