/**
 * Tests de composants.
 *
 * Volontairement limités aux briques d'interface autonomes, là où un défaut se paie
 * cher en usage réel : une modale qui ne se ferme pas au clavier, une erreur de
 * formulaire non annoncée aux lecteurs d'écran, un bouton qui reste cliquable pendant
 * un traitement.
 */

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modale, DialogueConfirmation } from '../src/components/ui/Modale';
import { Bascule, CaseACocher, Champ, Saisie } from '../src/components/ui/Champ';
import { Bouton } from '../src/components/ui/Bouton';

describe('Modale', () => {
  it('ne rend rien quand elle est fermée', () => {
    render(
      <Modale ouverte={false} titre="Confirmation" onFermer={() => {}}>
        contenu
      </Modale>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('s’annonce comme une boîte de dialogue modale', () => {
    render(
      <Modale ouverte titre="Confirmation" onFermer={() => {}}>
        contenu
      </Modale>,
    );
    const dialogue = screen.getByRole('dialog');
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(dialogue).toHaveAttribute('aria-label', 'Confirmation');
  });

  it('se ferme avec la touche Échap', () => {
    const onFermer = vi.fn();
    render(
      <Modale ouverte titre="Confirmation" onFermer={onFermer}>
        contenu
      </Modale>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it('se ferme via le bouton dédié', () => {
    const onFermer = vi.fn();
    render(
      <Modale ouverte titre="Confirmation" onFermer={onFermer}>
        contenu
      </Modale>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it('n’appelle plus la fermeture une fois démontée', () => {
    const onFermer = vi.fn();
    const { unmount } = render(
      <Modale ouverte titre="Confirmation" onFermer={onFermer}>
        contenu
      </Modale>,
    );

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFermer).not.toHaveBeenCalled();
  });

  it('ne reprend pas le focus quand le parent se rend à nouveau', () => {
    // Reproduit exactement le cas réel : le parent recrée `onFermer` à chaque frappe,
    // puisque la fonction dépend de son propre état. Si l'effet de la modale dépendait
    // de cette fonction, il se relançait à chaque lettre et replaçait le focus sur la
    // modale — sur iPhone, le clavier se refermait aussitôt.
    function Formulaire() {
      const [valeur, setValeur] = useState('');
      return (
        <Modale ouverte titre="Fiche client" onFermer={() => {}}>
          <Saisie
            aria-label="Nom"
            value={valeur}
            onChange={(evenement) => setValeur(evenement.target.value)}
          />
        </Modale>
      );
    }

    render(<Formulaire />);

    const champ = screen.getByLabelText('Nom');
    champ.focus();
    expect(champ).toHaveFocus();

    fireEvent.change(champ, { target: { value: 'Dupont' } });

    expect(champ).toHaveFocus();
    expect(champ).toHaveValue('Dupont');
  });
});

describe('DialogueConfirmation', () => {
  it('déclenche la confirmation', () => {
    const onConfirmer = vi.fn();
    render(
      <DialogueConfirmation
        ouverte
        titre="Supprimer ?"
        message="Action définitive."
        onConfirmer={onConfirmer}
        onAnnuler={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onConfirmer).toHaveBeenCalledTimes(1);
  });

  it('déclenche l’annulation', () => {
    const onAnnuler = vi.fn();
    render(
      <DialogueConfirmation
        ouverte
        titre="Supprimer ?"
        message="Action définitive."
        onConfirmer={() => {}}
        onAnnuler={onAnnuler}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onAnnuler).toHaveBeenCalledTimes(1);
  });

  it('accepte des libellés personnalisés', () => {
    render(
      <DialogueConfirmation
        ouverte
        titre="Corbeille"
        message="Message"
        libelleConfirmer="Mettre à la corbeille"
        libelleAnnuler="Conserver"
        onConfirmer={() => {}}
        onAnnuler={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mettre à la corbeille' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conserver' })).toBeInTheDocument();
  });
});

describe('Champ', () => {
  it('associe le libellé au champ de saisie', () => {
    render(
      <Champ label="Nom du client" obligatoire>
        {(id) => <Saisie id={id} />}
      </Champ>,
    );

    expect(screen.getByLabelText(/Nom du client/)).toBeInTheDocument();
  });

  it('signale une mention exigée en contrôle', () => {
    render(
      <Champ label="Numéro REVTC" mentionReglementaire>
        {(id) => <Saisie id={id} />}
      </Champ>,
    );

    expect(screen.getByText('contrôle')).toHaveAttribute(
      'title',
      'Mention exigée en cas de contrôle',
    );
  });

  it('n’affiche pas la pastille réglementaire quand elle n’est pas demandée', () => {
    render(
      <Champ label="Notes internes">
        {(id) => <Saisie id={id} />}
      </Champ>,
    );

    expect(screen.queryByText('contrôle')).toBeNull();
  });

  it('annonce l’erreur aux lecteurs d’écran', () => {
    render(
      <Champ label="SIREN" erreur="Le SIREN doit comporter exactement 9 chiffres.">
        {(id) => <Saisie id={id} />}
      </Champ>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('9 chiffres');
  });

  it('n’affiche aucun message d’erreur quand tout va bien', () => {
    render(
      <Champ label="SIREN" erreur={null}>
        {(id) => <Saisie id={id} />}
      </Champ>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Bascule', () => {
  it('signale l’option active', () => {
    render(
      <Bascule
        label="Régime de TVA"
        valeur="assujetti"
        options={[
          { valeur: 'assujetti', libelle: 'Assujetti' },
          { valeur: 'franchise_en_base', libelle: 'Franchise' },
        ]}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Assujetti' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Franchise' })).toHaveAttribute('aria-checked', 'false');
  });

  it('remonte le changement de valeur', () => {
    const onChange = vi.fn();
    render(
      <Bascule
        label="Régime de TVA"
        valeur="assujetti"
        options={[
          { valeur: 'assujetti', libelle: 'Assujetti' },
          { valeur: 'franchise_en_base', libelle: 'Franchise' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Franchise' }));
    expect(onChange).toHaveBeenCalledWith('franchise_en_base');
  });
});

describe('CaseACocher', () => {
  it('remonte la case cochée', () => {
    const onChange = vi.fn();
    render(<CaseACocher id="test-case" label="Débours" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Débours'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('relie le libellé à la case même sans identifiant fourni', () => {
    // Sans cette liaison, cliquer sur le texte ne coche rien et un lecteur d'écran
    // annonce une case sans nom. La plupart des appels ne passent aucun identifiant :
    // c'est au composant d'en fournir un.
    render(<CaseACocher label="Débours" checked={false} onChange={() => {}} />);

    const caseACocher = screen.getByLabelText('Débours');
    const identifiant = caseACocher.getAttribute('id');

    expect(identifiant).toBeTruthy();
    // React écrit `for` dans le DOM, pas `htmlFor`.
    expect(screen.getByText('Débours')).toHaveAttribute('for', identifiant);
  });
});

describe('Bouton', () => {
  it('est désactivé pendant un chargement', () => {
    render(<Bouton chargement>Générer le bon</Bouton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('est désactivé quand on le demande', () => {
    render(<Bouton disabled>Supprimer</Bouton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('reste cliquable sinon', () => {
    const onClick = vi.fn();
    render(<Bouton onClick={onClick}>Enregistrer</Bouton>);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('porte la classe de sa variante', () => {
    render(<Bouton variante="danger">Supprimer</Bouton>);
    expect(screen.getByRole('button').className).toContain('btn-danger');
  });
});
