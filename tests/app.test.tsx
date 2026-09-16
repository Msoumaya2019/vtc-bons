/**
 * Démarrage de l'application, bout en bout.
 *
 * Les autres fichiers testent des unités. Celui-ci monte l'application RÉELLE, avec ses
 * fournisseurs, son routeur et sa base : c'est le seul test capable de détecter une
 * erreur de câblage — un contexte mal placé, une route absente, un écran qui plante au
 * premier rendu. Ce genre de défaut ne se voit ni au typecheck, ni au build.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { db, effacerToutesLesDonnees, getSettings, saveSettings } from '../src/lib/db';
import { bonTest, reglagesTest } from './aides';

/**
 * Aide à la saisie d'adresse.
 *
 * Le service est remplacé ici comme dans `geo.test.ts` : sans cela, monter
 * l'application ferait partir de vrais appels vers Photon et OSRM à chaque test.
 */
const geoSimule = vi.hoisted(() => ({
  chercherAdresses: vi.fn(),
  calculerDistance: vi.fn(),
  geocoderAdresse: vi.fn(),
  adresseDepuisPosition: vi.fn(),
  positionActuelle: vi.fn(),
  messageEchecPosition: vi.fn(() => 'Position indisponible.'),
}));

vi.mock('../src/lib/geo', () => geoSimule);

/**
 * Délai d'attente des écrans.
 *
 * Volontairement large : ce fichier monte l'application entière, et les quatorze
 * fichiers de test s'exécutent en parallèle sur la même machine. Le seuil par
 * défaut, une seconde, devient insuffisant sous charge — ce qui produisait des
 * échecs aléatoires sans aucun rapport avec le comportement testé. Ce test ne
 * mesure pas une vitesse : il vérifie un enchaînement.
 *
 * Relevé de cinq à dix secondes après une campagne de mesure : sur huit cœurs, les
 * quatorze environnements de test se disputent les mêmes cœurs, et un ouvrier peut
 * rester privé de processeur pendant plusieurs secondes. Trois exécutions
 * consécutives ont échoué, chaque fois sur un test DIFFÉRENT, et chaque fois à
 * 5 053, 5 067 et 5 067 ms — c'est-à-dire précisément au seuil, jamais avant. Un
 * défaut de comportement se manifesterait au même endroit à chaque fois ; un
 * dépassement qui se déplace et qui s'arrête pile sur la limite est un problème de
 * charge. La même campagne, menée sans les modifications en cours, a échoué de la
 * même façon : la fragilité ne vient pas du code testé.
 */
const DELAI = 10_000;

/**
 * Délai maximal d'un test de ce fichier.
 *
 * Le seuil par défaut, cinq secondes, ne suffit pas ici : chaque test monte
 * l'application complète, et les exécuteurs de GitHub ne disposent que de deux
 * cœurs pour quatorze fichiers lancés en parallèle. Dépassé, un test échoue avec un
 * « timed out » qui ne dit rien du comportement — exactement le genre de panne que ce
 * fichier a déjà provoquée une fois.
 *
 * Le budget doit rester supérieur à la SOMME des attentes d'un même test : le plus
 * long en enchaîne trois (démarrage, écran, puis deux lectures). À dix secondes
 * l'attente, trois attentes consomment trente secondes — d'où quarante-cinq, et non
 * vingt. Relever l'une sans l'autre rendrait le budget incohérent : un échec se
 * signalerait alors par un « timed out » qui masquerait le comportement observé.
 *
 * Relevé pour ce fichier seulement : ailleurs, un test qui s'éternise doit continuer
 * d'être signalé vite.
 */
vi.setConfig({ testTimeout: 45_000 });

/** Amène l'application sur une route, puis attend que l'écran correspondant s'affiche. */
async function attendreEcran(chemin: string, texteAttendu: RegExp | string) {
  window.location.hash = chemin;
  await screen.findByText(texteAttendu, {}, { timeout: DELAI });
}

/** L'application chargée : l'écran d'attente doit avoir disparu. */
async function attendreDemarrage() {
  await waitFor(
    () => {
      expect(screen.queryByText('Ouverture de vos données locales…')).toBeNull();
    },
    { timeout: DELAI },
  );
}

let erreursConsole: string[] = [];

beforeEach(async () => {
  await effacerToutesLesDonnees();
  window.location.hash = '#/';

  // React signale dans la console toute erreur de rendu ou de prop. Un démarrage propre
  // ne doit rien y écrire : ce contrôle attrape les défauts qu'aucune assertion ne
  // penserait à couvrir.
  erreursConsole = [];
  vi.spyOn(console, 'error').mockImplementation((...arguments_) => {
    erreursConsole.push(arguments_.map(String).join(' '));
  });
});

describe('démarrage', () => {
  it('affiche l’écran d’attente, puis l’application', async () => {
    render(<App />);

    // Premier rendu : la base n'est pas encore ouverte.
    expect(screen.getByText('Ouverture de vos données locales…')).toBeInTheDocument();

    await attendreDemarrage();
    expect(screen.getByText('vtc-bons')).toBeInTheDocument();
  });

  it('ne provoque aucune erreur au montage', async () => {
    render(<App />);
    await attendreDemarrage();

    expect(erreursConsole).toEqual([]);
  });

  it('crée les réglages par défaut au premier lancement', async () => {
    render(<App />);
    await attendreDemarrage();

    // La base doit contenir l'enregistrement de réglages : sans lui, l'application
    // rechargerait un écran vide à chaque ouverture.
    expect(await db.settings.get('app')).toBeDefined();
  });

  it('présente les six onglets de navigation', async () => {
    render(<App />);
    await attendreDemarrage();

    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    // Les libellés « Mes bons » et « Mes factures » ont été raccourcis en accueillant
    // le sixième onglet : à six, la largeur disponible sur un téléphone ne permet plus
    // de porter le possessif. Ce test les fige donc dans leur forme courte.
    for (const libelle of [
      'Nouveau',
      'Instantané',
      'Bons',
      'Factures',
      'Clients',
      'Réglages',
    ]) {
      expect(navigation).toHaveTextContent(libelle);
    }
  });

  it('donne accès à l’aide depuis l’en-tête', async () => {
    render(<App />);
    await attendreDemarrage();

    expect(screen.getByRole('link', { name: 'Aide et conformité' })).toBeInTheDocument();
  });
});

describe('charte', () => {
  it('applique la couleur d’accent enregistrée dans les réglages', async () => {
    await saveSettings(reglagesTest({ couleurAccent: '#0f766e' }));

    render(<App />);
    await attendreDemarrage();

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0f766e');
    });
  });

  it('retombe sur le bleu par défaut si la couleur est absente', async () => {
    await saveSettings(reglagesTest({ couleurAccent: '' }));

    render(<App />);
    await attendreDemarrage();

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#1d4ed8');
    });
  });
});

describe('routes', () => {
  it('redirige la racine vers l’assistant de création', async () => {
    render(<App />);
    await attendreDemarrage();

    expect(await screen.findByText('Nouveau bon de commande')).toBeInTheDocument();
    expect(screen.getByText('Client et créneau')).toBeInTheDocument();
  });

  it('ramène une route inconnue vers l’assistant', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/route-qui-nexiste-pas', 'Nouveau bon de commande');
  });

  it('ouvre la liste des bons, vide au premier lancement', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/bons', 'Aucun bon de commande');
  });

  it('ouvre les factures, vides au premier lancement', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/factures', 'Aucune facture');
  });

  it('ouvre les clients, vides au premier lancement', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/clients', 'Aucun client enregistré');
  });

  it('ouvre les réglages', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/reglages', 'Réglages');
  });

  it('ouvre l’aide et la conformité', async () => {
    render(<App />);
    await attendreDemarrage();

    // On attend un titre propre à la page : « Aide et conformité » figure aussi dans
    // l'en-tête, donc l'attendre ne prouverait pas que la page est chargée.
    await attendreEcran('#/aide', 'Pourquoi le bon de commande est un document important');
    expect(screen.getByText('TVA applicable au transport de personnes')).toBeInTheDocument();
    // La mention de franchise est rappelée à plusieurs endroits de la page.
    expect(screen.getAllByText(/293 B du CGI/).length).toBeGreaterThan(0);
  });
});

describe('mode contrôle', () => {
  it('présente le justificatif d’une course, en plein écran', async () => {
    await db.bons.put(bonTest());

    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/controle/bon-1', 'Justificatif de réservation préalable');

    // Le lieu figure deux fois : dans son bloc principal, et dans la liste des mentions.
    // On vérifie qu'il est bien présent dans le bloc mis en avant.
    const blocLieu = screen.getByText('Lieu de prise en charge').closest('section');
    expect(blocLieu).toHaveTextContent('12 rue de la Gare, 95300 Pontoise');

    expect(screen.getByText('Mode contrôle')).toBeInTheDocument();
    expect(screen.getByText('Arrêté du 6 août 2025 — art. L. 3120-2 du Code des transports')).toBeInTheDocument();
  });

  it('masque la navigation : l’agent ne doit voir que la course concernée', async () => {
    await db.bons.put(bonTest());

    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/controle/bon-1', 'Justificatif de réservation préalable');

    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
  });

  it('affiche les sept mentions réglementaires', async () => {
    await db.bons.put(bonTest());

    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/controle/bon-1', 'Justificatif de réservation préalable');

    expect(
      screen.getByText(/Les 7 mentions obligatoires prévues par l’article 1er/),
    ).toBeInTheDocument();
  });

  it('ne plante pas si le bon n’existe pas', async () => {
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/controle/bon-inexistant', 'Justificatif introuvable.');
    expect(screen.getByRole('button', { name: 'Revenir' })).toBeInTheDocument();
  });

  it('annonce le chargement avant de conclure à l’absence', async () => {
    // La lecture de la base est asynchrone. On la retient volontairement, pour
    // observer l'état intermédiaire : l'écran ne doit pas encore affirmer que le
    // justificatif est introuvable. Sans cette précaution, l'écran clignoterait
    // avec un message faux, sous les yeux d'un agent.
    const lire = db.bons.get.bind(db.bons);
    let liberer!: () => void;
    const retenue = new Promise<void>((resoudre) => {
      liberer = resoudre;
    });
    // Dexie déclare `get` avec plusieurs signatures. TypeScript retient la dernière
    // pour typer le mock, alors que l'application appelle la première — par clé.
    // D'où cette assertion, cantonnée à ce test.
    const espion = vi.spyOn(db.bons, 'get').mockImplementation(
      ((cle: string) =>
        // On lit réellement, mais on retient la réponse. Chaîner sur la promesse
        // renvoyée par Dexie conserve son type : un simple `async` renverrait un
        // `Promise` ordinaire, que la signature de Dexie refuse.
        lire(cle).then(async (resultat) => {
          await retenue;
          return resultat;
        })) as unknown as typeof db.bons.get,
    );

    try {
      render(<App />);
      await attendreDemarrage();

      window.location.hash = '#/controle/bon-inexistant';

      expect(
        await screen.findByText('Chargement du justificatif…', {}, { timeout: DELAI }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Justificatif introuvable.')).toBeNull();

      liberer();

      expect(
        await screen.findByText('Justificatif introuvable.', {}, { timeout: DELAI }),
      ).toBeInTheDocument();
    } finally {
      espion.mockRestore();
    }
  });
});

describe('aide à la saisie d’adresse', () => {
  /**
   * Les valeurs attendues ici ne dépendent que d'un état React, pas d'un montage
   * complet : un délai plus court que `DELAI` suffit. Surtout, il reste sous le délai
   * maximal d'un test — sans quoi un échec se signalerait par un dépassement de temps,
   * au lieu de dire quelle valeur manquait.
   */
  const DELAI_ETAT = 2_000;

  const PONTOISE = {
    libelle: '12 Rue de la Gare, 95300 Pontoise',
    longitude: 2.0969,
    latitude: 49.0512,
  };

  const ROISSY = {
    libelle: 'Aéroport Charles-de-Gaulle, 95700 Roissy-en-France',
    longitude: 2.55,
    latitude: 49.0097,
  };

  beforeEach(() => {
    geoSimule.chercherAdresses.mockImplementation((texte: string) =>
      Promise.resolve(texte.toLowerCase().includes('pontoise') ? [PONTOISE] : [ROISSY]),
    );
    geoSimule.calculerDistance.mockResolvedValue({ km: 42.2, minutes: 37 });
  });

  /** Ouvre le formulaire de bon et passe à l'étape du trajet. */
  async function ouvrirLeTrajet() {
    await saveSettings(reglagesTest());
    render(<App />);
    await attendreDemarrage();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }, { timeout: DELAI }));
  }

  it('calcule la distance dès que les deux adresses sont connues', async () => {
    await ouvrirLeTrajet();

    const depart = screen.getByRole('combobox', { name: /Lieu de prise en charge/ });
    const arrivee = screen.getByRole('combobox', { name: /Destination/ });

    fireEvent.change(depart, { target: { value: 'Pontoise' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    fireEvent.change(arrivee, { target: { value: 'Roissy' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    expect(depart).toHaveValue(PONTOISE.libelle);
    expect(arrivee).toHaveValue(ROISSY.libelle);

    await waitFor(
      () => expect(screen.getByLabelText(/Distance estimée/)).toHaveValue(42.2),
      { timeout: DELAI_ETAT },
    );
  });

  it('efface la distance calculée dès qu’une adresse est retouchée', async () => {
    // Sans cela, le bon conserverait un kilométrage qui ne correspond plus au trajet
    // affiché — un chiffre faux, présenté comme un calcul.
    await ouvrirLeTrajet();

    const depart = screen.getByRole('combobox', { name: /Lieu de prise en charge/ });
    const arrivee = screen.getByRole('combobox', { name: /Destination/ });

    fireEvent.change(depart, { target: { value: 'Pontoise' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    fireEvent.change(arrivee, { target: { value: 'Roissy' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    const distance = screen.getByLabelText(/Distance estimée/);
    await waitFor(() => expect(distance).toHaveValue(42.2), { timeout: DELAI_ETAT });

    fireEvent.change(arrivee, { target: { value: 'Roissy, terminal 2E' } });

    await waitFor(() => expect(distance).toHaveValue(null), { timeout: DELAI_ETAT });
  });

  it('laisse intacte une distance saisie à la main', async () => {
    await ouvrirLeTrajet();

    const depart = screen.getByRole('combobox', { name: /Lieu de prise en charge/ });
    const arrivee = screen.getByRole('combobox', { name: /Destination/ });

    fireEvent.change(depart, { target: { value: 'Pontoise' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    fireEvent.change(arrivee, { target: { value: 'Roissy' } });
    fireEvent.mouseDown(await screen.findByRole('option', {}, { timeout: DELAI }));

    const distance = screen.getByLabelText(/Distance estimée/);
    await waitFor(() => expect(distance).toHaveValue(42.2), { timeout: DELAI_ETAT });

    // Le chauffeur corrige le kilométrage : la valeur n'est plus celle du calcul.
    fireEvent.change(distance, { target: { value: '18' } });

    // Retoucher une adresse invalide le calcul — pas la saisie du chauffeur.
    fireEvent.change(arrivee, { target: { value: 'Roissy, terminal 2E' } });

    await waitFor(() => expect(distance).toHaveValue(18), { timeout: DELAI_ETAT });
  });

  it('se coupe depuis les réglages, et l’enregistre', async () => {
    // La case est le seul moyen de faire cesser les appels sortants. Si elle
    // n'enregistrait pas, le chauffeur croirait avoir coupé quelque chose qui continue
    // de partir — un réglage de confidentialité qui ne tient pas sa promesse.
    await saveSettings(reglagesTest());
    render(<App />);
    await attendreDemarrage();

    await attendreEcran('#/reglages', 'Réglages');

    // On attend la section elle-même, et non un texte de la page : « Réglages » est aussi
    // le nom de l'onglet de navigation, si bien qu'une attente sur ce texte serait
    // satisfaite avant même que la page soit rendue.
    const section = await screen.findByRole(
      'button',
      { name: /Aide à la saisie d’adresse/ },
      { timeout: DELAI },
    );
    expect(section).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(section);

    const case_ = screen.getByLabelText('Proposer des adresses et calculer la distance');
    expect(case_).toBeChecked();

    fireEvent.click(case_);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(
      async () => {
        expect((await getSettings()).aideAdresse).toBe(false);
      },
      { timeout: DELAI_ETAT },
    );
  });
});

describe('saisie des montants', () => {
  /**
   * Les champs de montant étaient CONTRÔLÉS : leur valeur était réécrite à chaque frappe.
   * Sur un téléphone, le curseur repartait à la fin et le texte tapé était remplacé par sa
   * version formatée — taper 7 après « 0,00 » donnait « 0,007 », soit un centime, et
   * effacer semblait sans effet. Invisible au clavier d'un ordinateur.
   *
   * Ces tests mesurent le COMPORTEMENT DU CHAMP, pas le calcul : ils vérifient que ce qui
   * est tapé reste à l'écran.
   */

  /** Ouvre l'assistant de création et avance jusqu'à l'étape « Prestation et prix ». */
  async function ouvrirLesPrestations() {
    await saveSettings(reglagesTest());
    render(<App />);
    await attendreDemarrage();

    // L'assistant n'oppose aucune validation au passage d'étape : deux appuis suffisent.
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }, { timeout: DELAI }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
  }

  it('ne réécrit pas le prix unitaire sous les doigts du chauffeur', async () => {
    await ouvrirLesPrestations();

    const prix = screen.getByLabelText('Prix unitaire TTC') as HTMLInputElement;

    // Une ligne neuve vaut zéro, donc le champ doit être VIDE. Un « 0,00 » affiché
    // obligerait à effacer avant de saisir, et c'est cette obligation qui faisait qu'un
    // chiffre tapé après la virgule ne changeait rien.
    expect(prix.value).toBe('');

    fireEvent.change(prix, { target: { value: '9' } });
    expect(prix.value).toBe('9');

    fireEvent.change(prix, { target: { value: '95' } });
    expect(prix.value).toBe('95');
  });

  it('accepte une remise en pourcentage écrite avec une virgule', async () => {
    // Un clavier de téléphone propose la virgule comme séparateur décimal. Sans
    // normalisation, « 1,5 » vaut NaN et la remise retombait silencieusement à zéro :
    // le chauffeur annonçait une remise que le bon n'appliquait pas.
    await ouvrirLesPrestations();

    // 110 € TTC à 10 % de TVA, soit 100 € HT : la remise doit se voir dans le total.
    fireEvent.change(screen.getByLabelText('Prix unitaire TTC'), { target: { value: '110' } });

    fireEvent.change(screen.getByLabelText('Type de remise'), {
      target: { value: 'pourcentage' },
    });
    const remise = screen.getByLabelText('Remise (%)') as HTMLInputElement;

    fireEvent.change(remise, { target: { value: '1,5' } });

    expect(remise.value).toBe('1,5');
    // 1,5 % de 100 € : 98,50 € HT, et non 100 €. On vise la ligne « Total HT » : le
    // montant apparaît aussi dans le détail de TVA, où il désigne la base taxable.
    expect(screen.getByText('Total HT').closest('div')).toHaveTextContent('98,50 €');
  });
});
