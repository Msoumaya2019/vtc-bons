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

/**
 * Demande une route au routeur, de façon SYNCHRONE.
 *
 * Écrire dans `location.hash` met l'adresse à jour tout de suite, mais jsdom ne prévient le
 * routeur que par une `popstate` DIFFÉRÉE d'un `setTimeout(…, 0)`. Or `HashRouter` n'écoute
 * que `popstate`, et il relit `window.location` au moment de l'événement : toute navigation
 * concurrente survenue dans l'intervalle est donc celle qu'il suivra, et l'adresse demandée
 * n'est jamais observée. Mesuré sur jsdom seul, sans l'application :
 *
 *   écriture « #/b » puis `replaceState('#/c')`  ->  le routeur n'a vu que « #/c »
 *   écriture « #/b » puis événement synchrone     ->  le routeur a vu « #/b »
 *
 * C'est ce qui produisait des échecs sur un test DIFFÉRENT à chaque exécution, chaque fois
 * avec l'écran de l'assistant de création affiché alors qu'une autre route était demandée :
 * la redirection « / » vers « /nouveau » passait entre l'écriture et l'événement. En émettant
 * l'événement nous-mêmes, dans la même tâche, la fenêtre se referme.
 */
async function allerA(chemin: string) {
  // La redirection initiale « / » vers « /nouveau » passe par `replaceState`, qui réécrit
  // l'adresse de l'entrée courante. Tant qu'elle n'a pas eu lieu, elle peut survenir APRÈS
  // notre demande de route et l'écraser. L'adresse portant « #/nouveau » prouve qu'elle est
  // derrière nous. La garde est ici, et non chez l'appelant, pour qu'aucun ne puisse l'oublier.
  await waitFor(() => expect(window.location.hash).toBe('#/nouveau'), { timeout: DELAI });

  window.location.hash = chemin;
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Amène l'application sur une route, puis attend que l'écran correspondant s'affiche. */
async function attendreEcran(chemin: string, texteAttendu: RegExp | string) {
  await allerA(chemin);
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

  // Une plateforme native simulée par un test ne doit pas survivre au suivant : la suite en
  // compte qui vérifient le comportement de navigateur. Le retrait est fait ici, et non dans
  // le test qui la pose, pour qu'un test interrompu ne laisse pas la suite dans un état faux.
  delete window.Capacitor;

  // Valeurs par défaut des simulations réseau. Sans elles, un `vi.fn()` nu rend
  // `undefined`, et l'application appelle `.then()` sur ce résultat depuis une minuterie de
  // frappe : l'exception levée là est non rattrapée, souvent après la fin du test, et
  // attribuée à un autre fichier — du bruit qui finit par masquer de vraies erreurs.
  //
  // Le bloc « aide à la saisie d'adresse » ci-dessous remplace ces valeurs par les siennes.
  geoSimule.chercherAdresses.mockResolvedValue([]);
  geoSimule.calculerDistance.mockResolvedValue(null);

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

  it('affiche le repère de version, sans quoi un essai ne dit pas ce qui a été essayé', async () => {
    // Un onglet ou une application déjà ouverts continuent d'exécuter l'ancien code après
    // une mise à jour : un défaut DÉJÀ corrigé a été signalé une seconde fois pour cette
    // raison. Ce repère est la seule chose qui permette de savoir quelle version est à
    // l'écran — et de vérifier qu'une installation a bien pris.
    //
    // La forme est vérifiée, et non la simple présence : « Version inconnue » est le
    // message de repli quand la substitution n'a pas eu lieu à la compilation. Une
    // assertion qui se contenterait de « Version » passerait aussi dans ce cas, et ne
    // protégerait donc rien.
    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/reglages', 'Réglages');

    const repere = await screen.findByTestId('version-application', {}, { timeout: DELAI });
    expect(repere).toHaveTextContent(/^Version du \d{2}\/\d{2}\/\d{4} \([0-9a-f]{7,}\)$/);
  });

  it('affiche l’adresse directe de l’onglet Instantané, seul recours sur iPhone', async () => {
    // Safari sur iOS ne connaît pas les raccourcis déclarés dans le manifeste : la seule
    // voie qui reste est de créer soi-même un raccourci vers l'adresse de l'onglet. Or une
    // application installée n'affiche aucune barre d'adresse — c'est donc ici, et nulle
    // part ailleurs, que le chauffeur peut la lire.
    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/reglages', 'Réglages');

    const adresse = await screen.findByTestId('adresse-raccourci', {}, { timeout: DELAI });
    // On vérifie la FIN de l'adresse : l'origine et le sous-répertoire dépendent du
    // déploiement, alors que l'onglet est la partie qui doit rester stable.
    expect(adresse).toHaveTextContent(/#\/instantane$/);
  });

  it('ne propose pas cette adresse dans l’application native, où elle ne résoudrait nulle part', async () => {
    // Dans l'application native, l'origine n'est pas celle du site mais celle de la fenêtre
    // interne : « https://localhost » sur Android, « capacitor://localhost » sur iOS. Une
    // telle adresse ne s'ouvre que depuis l'intérieur de l'application — le chauffeur qui en
    // ferait un raccourci créerait un raccourci mort. Or les applications natives ne lisent
    // pas le manifeste non plus : il n'y a rien à y proposer, donc rien à y montrer.
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };

    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/reglages', 'Réglages');

    // L'ordre de ces deux assertions fait toute la valeur du test. « Réglages » figure AUSSI
    // dans la barre d'onglets : l'attendre ne prouve pas que la page est chargée, et une
    // assertion d'absence lue à cet instant passerait parce que RIEN n'est encore rendu — y
    // compris sur un code fautif. On attend donc d'abord un repère propre à la page, et
    // seulement ensuite on constate l'absence.
    expect(
      await screen.findByTestId('version-application', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('adresse-raccourci')).toBeNull();
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

  it('ouvre l’onglet Instantané sans passer par la racine, ce sur quoi repose un raccourci', async () => {
    // Tous les autres tests de ce fichier amènent l'application à la racine PUIS changent de
    // route. Un raccourci d'écran d'accueil fait exactement l'inverse : l'application démarre
    // alors que l'adresse porte DÉJÀ l'onglet. C'est un démarrage à froid sur une route
    // profonde, et rien ne le couvrait — or c'est tout ce qu'un raccourci sait faire.
    //
    // Ce que ce test protège : le jour où la route change de nom, le raccourci installé sur le
    // téléphone ouvrirait silencieusement l'assistant de création, puisque la route « * »
    // ramène tout chemin inconnu vers « /nouveau ». Aucune erreur ne serait levée nulle part,
    // et le défaut ne se verrait que sur le téléphone du chauffeur, devant un client qui attend.
    //
    // L'adresse est donc posée AVANT le rendu, contrairement à ce que fait `attendreEcran`.
    window.location.hash = '#/instantane';
    render(<App />);
    await attendreDemarrage();

    // On attend un texte propre à l'onglet : « Instantané » figure aussi dans la barre
    // d'onglets, donc l'attendre ne prouverait pas que l'écran correspondant est ouvert.
    expect(
      await screen.findByText('Aucun profil instantané', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nouveau bon de commande')).toBeNull();
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

      await allerA('#/controle/bon-inexistant');

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

    // Le geste du chauffeur, touche par touche — c'est ce déroulé qui avait été
    // signalé : « je mets 1, ça met 1 ; je mets la virgule, ça efface le 1 ; je mets
    // le 5, ça met 5 ». L'étape intermédiaire compte autant que le résultat : un champ
    // qui ne survit pas à la virgule ne peut jamais atteindre « 1,5 ».
    fireEvent.change(remise, { target: { value: '1' } });
    expect(remise.value).toBe('1');

    fireEvent.change(remise, { target: { value: '1,' } });
    expect(remise.value).toBe('1,');

    fireEvent.change(remise, { target: { value: '1,5' } });
    expect(remise.value).toBe('1,5');

    // 1,5 % de 100 € : 98,50 € HT, et non 100 €. On vise la ligne « Total HT » : le
    // montant apparaît aussi dans le détail de TVA, où il désigne la base taxable.
    expect(screen.getByText('Total HT').closest('div')).toHaveTextContent('98,50 €');
  });
});
