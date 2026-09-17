/**
 * Partage et téléchargement de fichiers.
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI IL EXISTE.
 *
 * Les deux boutons « Partager » et « Télécharger » étaient INERTES sur l'APK : aucun message,
 * aucun effet. La cause n'était pas dans le composant mais dans le choix du mécanisme :
 * `navigator.share` n'existe pas dans une WebView Android (browser-compat-data :
 * `webview_android: false`, crbug 40540400), et l'attribut `download` d'une ancre y est
 * ignoré. Toute la stratégie reposait donc sur deux mécanismes absents du seul environnement
 * qui compte pour l'APK.
 *
 * Aucun test ne couvrait ce chemin, et c'est ce qui a laissé passer le défaut. Le premier test
 * ci-dessous est celui qui l'aurait attrapé : il place le code dans les conditions d'une
 * WebView Android — pas de `navigator.share` — et exige que les greffons natifs prennent le
 * relais.
 *
 * Le second point éprouvé ici est la FIDÉLITÉ des octets : un base64 mal formé enverrait un
 * PDF corrompu chez le client, et c'est la seule chose que le chauffeur ne peut pas vérifier
 * avant d'envoyer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ecrireFichier = vi.hoisted(() => vi.fn());
const partagerNatif = vi.hoisted(() => vi.fn());

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: ecrireFichier },
}));

vi.mock('@capacitor/share', () => ({ Share: { share: partagerNatif } }));

import { blobEnBase64, partagerBlob, telechargerBlob } from '../src/lib/fichiers';

/** Les ancres créées par le repli, dans l'ordre où elles ont été cliquées. */
let ancres: HTMLAnchorElement[] = [];

/** Pose l'API de partage du web, telle qu'un navigateur ou la WebView d'iOS la fournit. */
function poserPartageWeb(partage: (donnees: ShareData) => Promise<void> = async () => undefined) {
  const share = vi.fn(partage);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
  return share;
}

/** Retire l'API de partage du web : c'est l'état d'une WebView Android. */
function retirerPartageWeb() {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
}

/** Place l'application dans son enveloppe native, sur Android. */
function surAndroid() {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
}

beforeEach(() => {
  retirerPartageWeb();
  delete window.Capacitor;
  ecrireFichier.mockReset();
  partagerNatif.mockReset();
  ancres = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    ancres.push(this);
  });
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:essai', configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  retirerPartageWeb();
  delete window.Capacitor;
});

describe('partage', () => {
  it('passe par l’API du web dans un navigateur, sans rien écrire sur le disque', async () => {
    const share = poserPartageWeb();

    const resultat = await partagerBlob(new Blob(['%PDF-1.4']), 'bon-1.pdf', 'Bon de commande');

    expect(resultat).toBe('partage');
    expect(share).toHaveBeenCalledTimes(1);
    const donnees = share.mock.calls[0][0] as ShareData;
    expect((donnees.files?.[0] as File).name).toBe('bon-1.pdf');
    expect(ecrireFichier).not.toHaveBeenCalled();
  });

  it('passe par les greffons natifs dans une WebView Android, où l’API du web n’existe pas', async () => {
    // C'est LE test qui manquait. Sans lui, le code pouvait retomber sur une ancre que la
    // WebView ignore, et rien ne le signalait.
    surAndroid();
    ecrireFichier.mockResolvedValue({ uri: 'file:///cache/bon-1.pdf' });
    partagerNatif.mockResolvedValue({ activityType: 'com.android.mail' });

    const resultat = await partagerBlob(new Blob(['%PDF-1.4']), 'bon-1.pdf', 'Bon de commande');

    expect(resultat).toBe('partage');
    expect(ecrireFichier).toHaveBeenCalledTimes(1);
    const options = ecrireFichier.mock.calls[0][0];
    // Le cache, et pas un autre dossier : c'est la seule destination que le FileProvider de
    // Capacitor expose au partage sur Android.
    expect(options.directory).toBe('CACHE');
    expect(options.path).toBe('bon-1.pdf');
    expect(partagerNatif).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///cache/bon-1.pdf'] }),
    );
    expect(ancres).toHaveLength(0);
  });

  it('écrit exactement les octets du document, et non une version approchante', async () => {
    // Un base64 mal formé enverrait un PDF corrompu chez le client, sans que personne ne
    // s'en aperçoive : le chauffeur ne peut pas relire le fichier qu'il envoie.
    surAndroid();
    const octets = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff, 0x00, 0x80, 0xfe,
    ]);
    ecrireFichier.mockResolvedValue({ uri: 'file:///cache/x.pdf' });
    partagerNatif.mockResolvedValue({});

    await partagerBlob(new Blob([octets]), 'x.pdf', 'x');

    const ecrit = ecrireFichier.mock.calls[0][0].data as string;
    const relu = Uint8Array.from(atob(ecrit), (caractere) => caractere.charCodeAt(0));
    expect(Array.from(relu)).toEqual(Array.from(octets));
  });

  it('ne rouvre pas une seconde feuille quand le chauffeur annule', async () => {
    // Appuyer sur « Annuler » n'est pas demander un autre chemin : le repli rouvrirait la
    // feuille sous le doigt, ce qui est le genre de comportement qu'on ne s'explique pas.
    const annulation = new Error('annulé');
    annulation.name = 'AbortError';
    poserPartageWeb(async () => {
      throw annulation;
    });
    surAndroid();

    expect(await partagerBlob(new Blob(['x']), 'x.pdf', 'x')).toBe('partage');
    expect(ecrireFichier).not.toHaveBeenCalled();
    expect(ancres).toHaveLength(0);
  });

  it('retombe sur le téléchargement quand le partage natif échoue', async () => {
    // Greffons absents d'une version antérieure de l'application, par exemple.
    vi.useFakeTimers();
    surAndroid();
    ecrireFichier.mockRejectedValue(new Error('greffon absent'));

    expect(await partagerBlob(new Blob(['x']), 'x.pdf', 'x')).toBe('telecharge');
    expect(ancres).toHaveLength(1);
    expect(ancres[0].download).toBe('x.pdf');
  });
});

describe('téléchargement', () => {
  it('fait enregistrer par le système dans une WebView, faute de téléchargement possible', async () => {
    surAndroid();
    ecrireFichier.mockResolvedValue({ uri: 'file:///cache/x.pdf' });
    partagerNatif.mockResolvedValue({});

    await telechargerBlob(new Blob(['x']), 'x.pdf');

    expect(partagerNatif).toHaveBeenCalledTimes(1);
    // L'ancre est le piège d'origine : une WebView ignore son attribut `download`.
    expect(ancres).toHaveLength(0);
  });

  it('télécharge par ancre dans un navigateur', async () => {
    vi.useFakeTimers();

    await telechargerBlob(new Blob(['x']), 'x.pdf');

    expect(ancres).toHaveLength(1);
    expect(ancres[0].download).toBe('x.pdf');
    expect(ecrireFichier).not.toHaveBeenCalled();
  });
});

describe('conversion en base64', () => {
  it('convertit un document volumineux sans dépasser la pile d’appels', async () => {
    // `String.fromCharCode(...octets)` étale le tableau en arguments : au-delà d'une centaine
    // de milliers d'octets, la pile d'appels déborde. Le partage échouerait donc précisément
    // sur les PDF qui comptent — sauvegarde complète, facture de plusieurs pages.
    const taille = 300_000;
    const gros = new Uint8Array(taille);
    for (let indice = 0; indice < taille; indice += 1) gros[indice] = indice % 251;

    // Le témoin d'abord : la version naïve échoue bel et bien, donc les tranches ne sont pas
    // décoratives. Sans cette ligne, rien ne prouverait que le découpage sert à quelque chose.
    expect(() => String.fromCharCode(...gros)).toThrow(RangeError);

    const base64 = await blobEnBase64(new Blob([gros]));
    const relu = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));

    expect(relu.length).toBe(taille);
    expect(relu[0]).toBe(0);
    expect(relu[taille - 1]).toBe((taille - 1) % 251);
  });

  it('laisse un document vide vide', async () => {
    expect(await blobEnBase64(new Blob([]))).toBe('');
  });
});
