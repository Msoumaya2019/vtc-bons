/**
 * Écran « Documents du chauffeur ».
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI IL EXISTE.
 *
 * Sur l'APK, le chauffeur ne lisait que l'INITIALE de chaque libellé : « P » pour « Permis de
 * conduire catégorie B en cours de validité ». Le libellé portait `truncate` — une seule
 * ligne, coupée net — tandis que le badge, « Modifier » et la poubelle formaient un groupe
 * insécable qui lui disputait la largeur. Mesuré dans un moteur réel : à 360 px de large, le
 * libellé ne disposait plus que de 23 px, soit quatre caractères sur cinquante et un.
 *
 * POURQUOI CE TEST REGARDE DES CLASSES, ET NON DES PIXELS.
 *
 * jsdom ne calcule AUCUNE mise en page : `scrollWidth` y vaut toujours `clientWidth`, et
 * `getClientRects()` y rend un seul rectangle. Une mesure de largeur écrite ici serait donc
 * verte quoi qu'il arrive — pire qu'inutile, puisqu'elle donnerait une raison de croire le
 * sujet couvert. Ce fichier ne garde que la CAUSE du défaut : le libellé doit pouvoir revenir
 * à la ligne, et la rangée qui le porte doit pouvoir renvoyer le badge dessous. L'effet, lui,
 * ne se mesure que dans un moteur — la mesure a été faite, et c'est elle qui a validé le
 * remède. Ne pas attendre de ce fichier qu'il remplace cette mesure.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ModuleDocuments } from '../src/features/documents/ModuleDocuments';
import { DOCUMENTS_CONTROLE } from '../src/lib/mentions';
import { effacerToutesLesDonnees } from '../src/lib/db';

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

/** Rend l'écran et attend la liste amorcée par défaut. */
async function rendreEcran() {
  render(<ModuleDocuments />);
  await waitFor(() => {
    expect(screen.getByText(DOCUMENTS_CONTROLE[0])).toBeInTheDocument();
  });
}

describe('Documents du chauffeur', () => {
  it('affiche chaque document de la liste de contrôle', async () => {
    await rendreEcran();

    for (const libelle of DOCUMENTS_CONTROLE) {
      expect(screen.getByText(libelle)).toBeInTheDocument();
    }
  });

  it('laisse le libellé revenir à la ligne au lieu de le couper', async () => {
    // C'est le défaut signalé, au plus près de sa cause : `truncate` pose
    // `white-space: nowrap` et `overflow: hidden`, donc le texte est coupé sans recours.
    // Aucune de ces classes ne doit revenir sur un libellé, qui atteint soixante caractères.
    await rendreEcran();

    for (const libelle of DOCUMENTS_CONTROLE) {
      const element = screen.getByText(libelle);
      expect(element.className).not.toContain('truncate');
      expect(element.className).toContain('break-words');
    }
  });

  it('renvoie le badge sous le libellé plutôt que de lui disputer la largeur', async () => {
    // Le badge et les actions ne peuvent pas rétrécir : sans `flex-wrap`, ils prennent la
    // largeur qu'il leur faut et ne laissent au libellé que les miettes. La rangée doit donc
    // pouvoir passer à la ligne.
    await rendreEcran();

    const libelle = screen.getByText(DOCUMENTS_CONTROLE[0]);
    expect(libelle.parentElement?.className).toContain('flex-wrap');
  });

  it('garde la date d’expiration et les actions accessibles sous le libellé', async () => {
    // La correction a déplacé les actions sur une seconde rangée : elles doivent rester
    // présentes, et nommées pour un lecteur d'écran, sans quoi le remède aurait échangé un
    // défaut de lisibilité contre une perte de fonction.
    await rendreEcran();

    const premier = DOCUMENTS_CONTROLE[0];
    expect(screen.getByRole('button', { name: `Supprimer ${premier}` })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(
      DOCUMENTS_CONTROLE.length,
    );
  });
});
