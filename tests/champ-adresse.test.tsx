/**
 * Tests du champ d'adresse assisté.
 *
 * Le service d'adresses est remplacé : aucun appel ne part d'ici. Ce qui est vérifié
 * est le comportement que le chauffeur ressent, et deux points en particulier, parce
 * qu'ils ont déjà coûté cher :
 *
 *   • le champ doit rester un champ. Sans réseau, sans aide, ou après un refus de
 *     géolocalisation, la saisie à la main doit continuer de fonctionner normalement ;
 *   • Échap doit refermer la LISTE, pas la fenêtre qui l'abrite. Ce champ vit dans la
 *     modale client ; s'il laissait remonter la touche, la fiche deviendrait
 *     insaisissable.
 */

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Modale } from '../src/components/ui/Modale';
import { ChampAdresse } from '../src/components/ui/ChampAdresse';
import type { Adresse } from '../src/lib/geo';

const { chercherAdresses, adresseDepuisPosition, positionActuelle, messageEchecPosition } =
  vi.hoisted(() => ({
    chercherAdresses: vi.fn(),
    adresseDepuisPosition: vi.fn(),
    positionActuelle: vi.fn(),
    messageEchecPosition: vi.fn(),
  }));

vi.mock('../src/lib/geo', () => ({
  chercherAdresses,
  adresseDepuisPosition,
  positionActuelle,
  messageEchecPosition,
}));

const PONTOISE: Adresse = {
  libelle: '12 Rue de la Gare, 95300 Pontoise',
  longitude: 2.0969,
  latitude: 49.0512,
};

const BEAUVAIS: Adresse = {
  libelle: '1 Rue Saint-Pierre, 60000 Beauvais',
  longitude: 2.0809,
  latitude: 49.4295,
};

/**
 * Harnais minimal : le champ est piloté, comme dans le formulaire de bon. Les
 * coordonnées retenues sont observées par un espion, sans quoi il faudrait les
 * afficher — et donc ajouter au composant une sortie qui n'existe pas en vrai.
 */
function Harnais({
  aideActive = true,
  positionProposee = false,
  onCoordonnees = vi.fn(),
}: {
  aideActive?: boolean;
  positionProposee?: boolean;
  onCoordonnees?: (adresse: Adresse | null) => void;
}) {
  const [valeur, setValeur] = useState('');
  return (
    <ChampAdresse
      label="Lieu de prise en charge"
      valeur={valeur}
      onChange={setValeur}
      onCoordonnees={onCoordonnees}
      aideActive={aideActive}
      positionProposee={positionProposee}
    />
  );
}

/** Laisse retomber la frappe : c'est le délai d'attente du composant. */
async function laisserRetomberLaFrappe() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

/** Laisse aboutir les promesses en cours, minuteries simulées comprises. */
async function laisserAboutirLesPromesses() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
  });
}

/**
 * Le champ est visé par son rôle et non par son libellé : une fois la liste ouverte,
 * « Lieu de prise en charge » se retrouve aussi dans l'étiquette de la liste, et la
 * recherche par libellé deviendrait ambiguë.
 */
function zoneAdresse() {
  return screen.getByRole('combobox');
}

/** Écrit un texte dans le champ, comme le ferait le clavier. */
function ecrire(texte: string) {
  fireEvent.change(zoneAdresse(), { target: { value: texte } });
}

beforeEach(() => {
  vi.useFakeTimers();
  chercherAdresses.mockReset().mockResolvedValue([]);
  adresseDepuisPosition.mockReset().mockResolvedValue(null);
  positionActuelle.mockReset().mockResolvedValue({ ok: true, position: { longitude: 2.0969, latitude: 49.0512 } });
  messageEchecPosition.mockReset().mockReturnValue('Position indisponible.');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChampAdresse', () => {
  it('n’interroge pas le service pour un texte trop court', async () => {
    render(<Harnais />);

    ecrire('Pa');
    await laisserRetomberLaFrappe();

    expect(chercherAdresses).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('propose les adresses trouvées au fil de la frappe', async () => {
    chercherAdresses.mockResolvedValue([PONTOISE, BEAUVAIS]);
    render(<Harnais />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('12 Rue de la Gare, 95300 Pontoise');
  });

  it('retient les coordonnées de la proposition choisie', async () => {
    const onCoordonnees = vi.fn();
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(<Harnais onCoordonnees={onCoordonnees} />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();
    fireEvent.mouseDown(screen.getByRole('option'));

    expect(zoneAdresse()).toHaveValue(PONTOISE.libelle);
    expect(onCoordonnees).toHaveBeenLastCalledWith(PONTOISE);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ne relance pas une recherche après un choix', async () => {
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(<Harnais />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();
    fireEvent.mouseDown(screen.getByRole('option'));
    await laisserRetomberLaFrappe();

    expect(chercherAdresses).toHaveBeenCalledTimes(1);
  });

  it('garde le focus après le choix, sans quoi le clavier se refermerait', async () => {
    // Sur iPhone, perdre le focus referme le clavier : choisir une proposition doit
    // pouvoir s'enchaîner avec la saisie du champ suivant sans y revenir au doigt.
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(<Harnais />);

    const saisie = zoneAdresse();
    saisie.focus();
    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();
    fireEvent.mouseDown(screen.getByRole('option'));

    expect(saisie).toHaveFocus();
  });

  it('oublie les coordonnées dès que le texte est retouché à la main', async () => {
    // Sans cela, la distance calculée ne correspondrait plus à l'adresse affichée.
    const onCoordonnees = vi.fn();
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(<Harnais onCoordonnees={onCoordonnees} />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onCoordonnees).toHaveBeenLastCalledWith(PONTOISE);

    ecrire('12 rue de la Gare, bâtiment B');
    expect(onCoordonnees).toHaveBeenLastCalledWith(null);
  });

  it('se parcourt au clavier et se valide avec Entrée', async () => {
    chercherAdresses.mockResolvedValue([PONTOISE, BEAUVAIS]);
    render(<Harnais />);

    ecrire('Rue de la Gare');
    await laisserRetomberLaFrappe();

    const saisie = zoneAdresse();
    fireEvent.keyDown(saisie, { key: 'ArrowDown' });
    fireEvent.keyDown(saisie, { key: 'ArrowDown' });
    fireEvent.keyDown(saisie, { key: 'Enter' });

    expect(saisie).toHaveValue(BEAUVAIS.libelle);
  });

  it('referme la liste avec Échap sans fermer la fenêtre qui l’abrite', async () => {
    const onFermer = vi.fn();
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(
      <Modale ouverte titre="Fiche client" onFermer={onFermer}>
        <Harnais />
      </Modale>,
    );

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(zoneAdresse(), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onFermer).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('referme la liste quand on clique ailleurs', async () => {
    chercherAdresses.mockResolvedValue([PONTOISE]);
    render(<Harnais />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('reste une simple saisie quand l’aide est désactivée', async () => {
    render(<Harnais aideActive={false} positionProposee />);

    ecrire('12 rue de la Gare');
    await laisserRetomberLaFrappe();

    expect(chercherAdresses).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Ma position' })).toBeNull();
    expect(zoneAdresse()).toHaveValue('12 rue de la Gare');
  });
});

describe('ChampAdresse — position actuelle', () => {
  it('remplit l’adresse de départ depuis la position', async () => {
    const onCoordonnees = vi.fn();
    adresseDepuisPosition.mockResolvedValue(PONTOISE);
    render(<Harnais positionProposee onCoordonnees={onCoordonnees} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ma position' }));
    await laisserAboutirLesPromesses();

    expect(zoneAdresse()).toHaveValue(PONTOISE.libelle);
    expect(onCoordonnees).toHaveBeenLastCalledWith(PONTOISE);
  });

  it('explique l’échec plutôt que de rester silencieux', async () => {
    positionActuelle.mockResolvedValue({ ok: false, raison: 'refusee' });
    messageEchecPosition.mockReturnValue('Autorisation refusée. Activez la localisation dans les réglages.');
    render(<Harnais positionProposee />);

    fireEvent.click(screen.getByRole('button', { name: 'Ma position' }));
    await laisserAboutirLesPromesses();

    expect(screen.getByRole('status')).toHaveTextContent('réglages');
  });

  it('le dit quand la position est obtenue mais sans adresse', async () => {
    adresseDepuisPosition.mockResolvedValue(null);
    render(<Harnais positionProposee />);

    fireEvent.click(screen.getByRole('button', { name: 'Ma position' }));
    await laisserAboutirLesPromesses();

    expect(screen.getByRole('status')).toHaveTextContent('à la main');
  });

  it('ne propose pas la position sur le lieu d’arrivée', () => {
    render(<Harnais positionProposee={false} />);

    expect(screen.queryByRole('button', { name: 'Ma position' })).toBeNull();
  });
});
