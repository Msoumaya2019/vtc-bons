/**
 * Adresse d'accès direct à l'onglet Instantané, et bouton de copie.
 *
 * Ce que ce fichier protège : le seul contrôle que le chauffeur touche vraiment ici. Une
 * copie qui échoue EN SILENCE serait le pire des cas — il collerait dans l'application
 * Raccourcis une adresse vide, ou rien du tout, et le raccourci ne s'ouvrirait pas sans
 * qu'il sache pourquoi. Le repli est donc éprouvé, et pas seulement écrit.
 *
 * `navigator.clipboard` n'existe que dans un contexte sécurisé, ce que n'est PAS
 * « capacitor://localhost », dont iOS sert l'application : c'est précisément le cas que le
 * dernier test couvre. Le contrôle à l'écran ne l'aurait jamais montré, puisque le
 * navigateur de bureau, lui, l'a.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AdresseInstantane } from '../src/features/reglages/AdresseInstantane';
import { ADRESSE_INSTANTANE } from '../src/lib/lienProfond';

/** Le presse-papiers n'existe pas dans jsdom : on le pose, ou on le retire, à la main. */
function poserPressePapiers(writeText: (texte: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

beforeEach(() => {
  delete window.Capacitor;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.Capacitor;
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('adresse affichée', () => {
  it('donne celle du site dans un navigateur', () => {
    render(<AdresseInstantane />);

    // L'adresse doit être ABSOLUE avant tout : un raccourci système ne résout pas
    // « #/instantane », qui ne désigne quelque chose qu'à l'intérieur d'une page ouverte.
    // Une adresse relative passerait ici pour peu qu'on ne regarde que la fin — et le
    // raccourci n'ouvrirait rien, sans que rien ne le signale.
    // Le reste est laissé souple à dessein : l'origine et le sous-répertoire dépendent du
    // déploiement, et seul l'onglet doit rester stable.
    expect(screen.getByTestId('adresse-raccourci')).toHaveTextContent(
      /^https?:\/\/[^/]+\/.*#\/instantane$/,
    );
  });

  it('donne le lien profond dans l’application native', () => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };

    render(<AdresseInstantane />);

    // L'adresse du site ne résoudrait nulle part ici : elle désignerait
    // « capacitor://localhost », qui ne s'ouvre que de l'intérieur de l'application.
    expect(screen.getByTestId('adresse-raccourci')).toHaveTextContent(ADRESSE_INSTANTANE);
    expect(screen.getByTestId('adresse-raccourci')).not.toHaveTextContent(/^https?:/);
    // Et le mode d'emploi doit nommer l'application Raccourcis : l'adresse seule ne dit
    // pas quoi en faire.
    expect(screen.getByText(/Raccourcis/)).toBeInTheDocument();
  });
});

describe('bouton de copie', () => {
  it('copie exactement l’adresse affichée, et le confirme', async () => {
    const writeText = vi.fn(async () => undefined);
    poserPressePapiers(writeText);

    render(<AdresseInstantane />);
    fireEvent.click(screen.getByTestId('copier-adresse'));

    expect(await screen.findByText('Copiée')).toBeInTheDocument();
    // L'adresse copiée est celle qui est AFFICHÉE, et non une autre : copier une valeur
    // que le chauffeur ne voit pas l'obligerait à se demander laquelle des deux il vient
    // de coller dans l'application Raccourcis.
    expect(writeText).toHaveBeenCalledWith(screen.getByTestId('adresse-raccourci').textContent);
  });

  it('revient à « Copier » après quelques secondes', async () => {
    // Sans ce retour, le bouton resterait sur « Copiée » pour toujours, et le chauffeur ne
    // saurait plus s'il peut appuyer de nouveau.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    poserPressePapiers(vi.fn(async () => undefined));

    render(<AdresseInstantane />);
    fireEvent.click(screen.getByTestId('copier-adresse'));
    await act(async () => {});

    expect(screen.getByText('Copiée')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Copier')).toBeInTheDocument();
  });

  it('compte les trois secondes depuis le dernier appui, pas depuis le premier', async () => {
    // Deux appuis espacés. Sans le nettoyage du minuteur précédent, le premier rendrait la
    // main selon SON propre délai, et le bouton repasserait à « Copier » alors que la copie
    // que le chauffeur vient de faire a moins de trois secondes. Le doute serait mince, mais
    // il porterait sur la seule chose que ce bouton doit garantir : ce qui est dans le
    // presse-papiers est bien ce qu'il vient de copier.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    poserPressePapiers(vi.fn(async () => undefined));

    render(<AdresseInstantane />);
    fireEvent.click(screen.getByTestId('copier-adresse'));
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByTestId('copier-adresse'));
    await act(async () => {});

    // 3 500 ms après le PREMIER appui : son minuteur serait échu, celui du second non.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('Copiée')).toBeInTheDocument();

    // 5 000 ms après le premier appui, soit trois secondes après le second.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('Copier')).toBeInTheDocument();
  });

  it('dit quoi faire quand la copie échoue, au lieu de rester muet', async () => {
    // Le cas réel sur iPhone : `navigator.clipboard` est absent d'un contexte non sécurisé,
    // et `document.execCommand` peut être refusé. Le bouton ne doit alors PAS ne rien faire
    // — le chauffeur croirait avoir copié, collerait du vide, et ne comprendrait pas
    // pourquoi son raccourci n'ouvre rien.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
    });

    render(<AdresseInstantane />);
    fireEvent.click(screen.getByTestId('copier-adresse'));

    expect(await screen.findByText(/Maintenez le doigt/)).toBeInTheDocument();
    expect(screen.queryByText('Copiée')).toBeNull();
  });

  it('essaie le repli quand le presse-papiers est absent', async () => {
    // Le repli n'est pas décoratif : c'est le seul chemin possible dans une WebView. On
    // vérifie qu'il est bien TENTÉ, et non que le bouton abandonne dès le premier échec.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });

    render(<AdresseInstantane />);
    fireEvent.click(screen.getByTestId('copier-adresse'));

    expect(await screen.findByText('Copiée')).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
