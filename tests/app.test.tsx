/**
 * Démarrage de l'application, bout en bout.
 *
 * Les autres fichiers testent des unités. Celui-ci monte l'application RÉELLE, avec ses
 * fournisseurs, son routeur et sa base : c'est le seul test capable de détecter une
 * erreur de câblage — un contexte mal placé, une route absente, un écran qui plante au
 * premier rendu. Ce genre de défaut ne se voit ni au typecheck, ni au build.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { db, effacerToutesLesDonnees, getSettings, saveSettings } from '../src/lib/db';
import { ANTEDATATIONS_PROPOSEES } from '../src/lib/antedatation';
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
 * Lien profond simulé.
 *
 * Le greffon `@capacitor/app` n'existe que dans l'enveloppe native : en test, c'est lui
 * qui apporte l'adresse par laquelle l'application a été ouverte. Le remplacer permet
 * d'éprouver le seul comportement qui compte — l'application ouvre-t-elle le bon onglet
 * quand elle est lancée par son raccourci.
 *
 * `addListener` rend une promesse : c'est la signature réelle du greffon, et l'oublier
 * ferait passer un test qui ne ressemble pas à l'application.
 */
const appSimulee = vi.hoisted(() => ({
  getLaunchUrl: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({ App: appSimulee }));

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

  // Valeurs par défaut du lien profond : aucune adresse de lancement, et un écouteur
  // qui rend un objet conforme au greffon. Un `vi.fn()` nu rendrait `undefined`, et
  // l'application appellerait `.remove()` dessus.
  appSimulee.getLaunchUrl.mockResolvedValue(undefined);
  appSimulee.addListener.mockResolvedValue({ remove: vi.fn() });

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

  it('propose le lien profond dans l’application native, où l’adresse du site ne résoudrait nulle part', async () => {
    // Dans l'application native, l'origine n'est pas celle du site mais celle de la fenêtre
    // interne : « https://localhost » sur Android, « capacitor://localhost » sur iOS. Une
    // telle adresse ne s'ouvre que depuis l'intérieur de l'application — le chauffeur qui en
    // ferait un raccourci créerait un raccourci mort.
    //
    // Ce bloc était pourtant ENTIÈREMENT masqué ici, au motif qu'il n'y avait rien à
    // proposer. C'était vrai du manifeste, et faux du lien profond : la déclaration native
    // existait, mais son adresse n'était écrite nulle part dans l'application, si bien que
    // le raccourci iOS — qui se construit à la main dans l'application Raccourcis — ne
    // pouvait pas être renseigné. On vérifie donc que c'est bien le lien profond qui
    // s'affiche, et non l'adresse du site : la différence est tout l'objet du test.
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };

    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/reglages', 'Réglages');

    const adresse = await screen.findByTestId('adresse-raccourci', {}, { timeout: DELAI });
    expect(adresse).toHaveTextContent(/^vtcbons:\/\/instantane$/);
    expect(adresse).not.toHaveTextContent(/#\/instantane/);
  });

  it('propose l’adresse du site dans le navigateur, et permet de la copier', async () => {
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
    expect(adresse).not.toHaveTextContent(/^vtcbons:/);
    expect(screen.getByTestId('copier-adresse')).toBeInTheDocument();
  });

  it('permet de régler l’antédatation de la réservation, et l’enregistre', async () => {
    // Le champ est la seule voie par laquelle le chauffeur peut régler ce décalage. Sans
    // lui, le comportement reste celui d'origine — réservation et prise en charge à la
    // même heure — et le justificatif ne prouve rien de plus que lui-même.
    //
    // Les réglages sont posés AVANT le rendu, comme dans le test de l'aide à la saisie :
    // les valeurs par défaut ont un SIREN et un numéro REVTC vides, si bien que
    // l'enregistrement serait refusé et que le test échouerait pour une raison qui n'a
    // rien à voir avec ce qu'il vérifie.
    await saveSettings(reglagesTest());
    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/reglages', 'Réglages');

    // La section est repliée au départ, et son contenu n'est donc PAS rendu : on l'ouvre
    // comme le ferait le chauffeur, plutôt que de chercher un champ qui n'existe pas
    // encore dans le document.
    const section = await screen.findByRole(
      'button',
      { name: /Antédater la réservation/ },
      { timeout: DELAI },
    );
    expect(section).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(section);

    const choix = await screen.findByTestId('antedatation-reservation', {}, { timeout: DELAI });
    expect(choix).toHaveValue('0');
    expect(within(choix).getAllByRole('option')).toHaveLength(ANTEDATATIONS_PROPOSEES.length);
    // Les deux extrémités de l'échelle, et pas seulement leur nombre : « Aucune » est ce
    // qui permet de revenir au comportement d'origine, et « 2 heures » la borne haute.
    expect(within(choix).getByRole('option', { name: 'Aucune' })).toBeInTheDocument();
    expect(within(choix).getByRole('option', { name: '2 heures' })).toBeInTheDocument();

    fireEvent.change(choix, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // On attend la valeur RELUE DEPUIS LA BASE, et non un texte de l'écran : c'est la
    // seule preuve que le réglage a réellement été écrit, et non seulement affiché.
    await waitFor(
      async () => {
        expect((await getSettings()).antedatationReservationMinutes).toBe(30);
      },
      { timeout: DELAI },
    );
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

describe('lien profond', () => {
  /** Simule l'application native, ouverte par une adresse — ou par aucune. */
  function lancerParAdresse(url?: string) {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    appSimulee.getLaunchUrl.mockResolvedValue(url === undefined ? undefined : { url });
  }

  it('ouvre l’onglet Instantané quand l’application est lancée par son raccourci', async () => {
    // C'est tout ce qu'un raccourci d'écran d'accueil sait faire : ouvrir l'application
    // à un endroit donné. S'il n'ouvre pas l'onglet, le chauffeur traverse l'assistant
    // de création devant un client qui attend — précisément ce qu'il voulait éviter.
    lancerParAdresse('vtcbons://instantane');

    render(<App />);
    await attendreDemarrage();

    // L'adresse d'abord : c'est le signal le plus direct. Un échec ici dit « attendu
    // #/instantane, trouvé #/nouveau », là où une attente d'écran expirerait après dix
    // secondes sans rien apprendre.
    await waitFor(() => expect(window.location.hash).toBe('#/instantane'), { timeout: DELAI });

    // Puis un texte propre à l'onglet : « Instantané » figure aussi dans la barre
    // d'onglets, donc l'attendre ne prouverait pas que l'écran correspondant est ouvert.
    expect(
      await screen.findByText('Aucun profil instantané', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nouveau bon de commande')).toBeNull();

    // Un seul abonnement, et une seule interrogation du natif. Un effet qui se rejoue à
    // chaque navigation poserait un écouteur DE PLUS à chaque changement d'écran — une
    // fuite silencieuse, et un même lien traité plusieurs fois. Relevé en éprouvant ce
    // test par mutation : `getLaunchUrl` était alors appelé deux fois pour un démarrage.
    expect(appSimulee.getLaunchUrl).toHaveBeenCalledTimes(1);
    expect(appSimulee.addListener).toHaveBeenCalledTimes(1);
  });

  it('n’ouvre rien quand le lien ne vise aucune cible connue', async () => {
    lancerParAdresse('vtcbons://onglet-qui-nexiste-pas');

    render(<App />);
    await attendreDemarrage();

    expect(
      await screen.findByText('Nouveau bon de commande', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aucun profil instantané')).toBeNull();
  });

  it('suit un lien reçu alors que l’application est déjà ouverte', async () => {
    lancerParAdresse();
    let ouvrir!: (evenement: { url: string }) => void;
    appSimulee.addListener.mockImplementation(
      async (_nom: string, ecouteur: (evenement: { url: string }) => void) => {
        ouvrir = ecouteur;
        return { remove: vi.fn() };
      },
    );

    render(<App />);
    await attendreDemarrage();
    await attendreEcran('#/bons', 'Aucun bon de commande');

    // Le système relance l'application sur place : c'est le second cas, et il ne passe
    // pas par `getLaunchUrl`.
    ouvrir({ url: 'vtcbons://instantane' });

    await waitFor(() => expect(window.location.hash).toBe('#/instantane'), { timeout: DELAI });
    expect(
      await screen.findByText('Aucun profil instantané', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
  });

  it('ne fait rien dans un navigateur, où aucun lien profond n’arrive', async () => {
    // `window.Capacitor` a été retiré par le `beforeEach` : nous sommes dans un
    // navigateur. Le greffon répondrait pourtant « instantané », et c'est ce qui rend ce
    // test utile : sans la garde, une adresse native détournerait aussi la version web.
    appSimulee.getLaunchUrl.mockResolvedValue({ url: 'vtcbons://instantane' });

    render(<App />);
    await attendreDemarrage();

    // Le greffon d'abord : c'est l'assertion qui échoue le plus tôt et le plus
    // clairement. Le composant est monté et son effet a déjà été exécuté — l'application
    // est dans un navigateur, il n'a donc aucune raison d'interroger le natif.
    expect(appSimulee.getLaunchUrl).not.toHaveBeenCalled();

    expect(
      await screen.findByText('Nouveau bon de commande', {}, { timeout: DELAI }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aucun profil instantané')).toBeNull();
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

/**
 * Barres fixes du bas de l'écran.
 *
 * CE QUE CES TESTS GARDENT, ET CE QU'ILS NE GARDENT PAS.
 *
 * Le bouton « Enregistrer » des Réglages était à moitié caché par la barre d'onglets, sur un
 * téléphone à indicateur d'accueil : la barre d'enregistrement lisait un décalage écrit en
 * dur — 56 px — alors que la barre d'onglets grandit de la zone sûre du bas. Mesuré dans un
 * moteur, insertion basse simulée à 34 px : 36 px de recouvrement, et 24 px du bouton cachés
 * sur les 44 px de sa hauteur.
 *
 * Ils gardent la CAUSE — le décalage doit être LU depuis une variable partagée, jamais
 * recopié — et non l'effet. jsdom ne calcule aucune mise en page : une mesure de recouvrement
 * écrite ici serait verte quoi qu'il arrive. C'est la mesure dans un vrai moteur qui a validé
 * le remède ; ces tests empêchent seulement qu'on réécrive le chiffre.
 */
describe('barres fixes du bas', () => {
  /** Le nom de la variable `var(--…)` portée par une chaîne. */
  function variableLue(texte: string): string {
    const trouve = /var\((--[a-z-]+)\)/.exec(texte);
    if (!trouve) throw new Error(`aucune variable var(--…) dans « ${texte} »`);
    return trouve[1];
  }

  /** Ouvre les Réglages et rend la barre d'enregistrement. */
  async function ouvrirLaBarre() {
    await saveSettings(reglagesTest());
    render(<App />);
    await attendreDemarrage();

    // Le repère de version, et non « Réglages » : ce dernier est aussi le libellé d'un
    // onglet, donc l'attente serait satisfaite avant même que la route ait changé.
    await allerA('#/reglages');
    await waitFor(() => expect(screen.getByTestId('version-application')).toBeInTheDocument(), {
      timeout: DELAI,
    });

    const bouton = screen.getByRole('button', { name: 'Enregistrer' });
    const barre = bouton.closest('.fixed');
    expect(barre, 'la barre d’enregistrement n’est plus fixe').not.toBeNull();
    return barre as HTMLElement;
  }

  it('adosse la barre d’enregistrement à la hauteur réelle de la barre d’onglets', async () => {
    const barre = await ouvrirLaBarre();
    const nav = document.querySelector('nav[aria-label="Navigation principale"]') as HTMLElement;

    // Les deux se réfèrent à la MÊME variable. En renommer une sans l'autre fait échouer ce
    // test, alors qu'un décalage recopié des deux côtés ne se verrait nulle part.
    expect(variableLue(barre.className)).toBe(variableLue(nav.style.height));
  });

  it('n’écrit jamais le décalage en dur, ni la classe qui n’y faisait rien', async () => {
    const barre = await ouvrirLaBarre();

    // Un décalage chiffré, c'est le défaut d'origine : la barre d'onglets grandit de la zone
    // sûre du bas, le chiffre non.
    expect(barre.className).not.toMatch(/bottom-\[\d/);

    // `zone-sure-bas` y était inopérante — `py-3` l'emportait, mesuré à 12 px — tout en
    // donnant à lire que la zone sûre était traitée. Elle n'a plus rien à y faire : la barre
    // n'est plus au bord de l'écran.
    expect(barre.className).not.toContain('zone-sure-bas');
  });

  it('déclare la hauteur une seule fois, dans la feuille de style, zone sûre comprise', () => {
    // jsdom ne charge aucune feuille de style : la variable se lit donc dans le source. Si
    // elle disparaissait, `var()` ne résoudrait rien, `bottom` retomberait à `auto`, et la
    // barre repartirait dans le flux du document — un défaut qu'aucun autre test ne verrait.
    //
    // Le chemin passe par le répertoire de travail, et non par `import.meta.url` : sous
    // jsdom, cette URL n'a pas le schéma `file:`, et `readFileSync` la refuse.
    const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
    const declaration = /--hauteur-barre-onglets:\s*([^;]+);/.exec(css);

    expect(declaration, 'la variable de hauteur n’est plus déclarée').not.toBeNull();
    const valeur = declaration![1];
    expect(valeur).toMatch(/calc\(/);
    expect(valeur).toContain('env(safe-area-inset-bottom');
  });
});
