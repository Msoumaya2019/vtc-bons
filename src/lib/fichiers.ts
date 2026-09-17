/**
 * Téléchargement et partage de fichiers — PDF et sauvegardes.
 *
 * POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT.
 *
 * La version précédente ne reposait que sur deux mécanismes du web, tous deux ABSENTS de la
 * WebView Android — c'est-à-dire du seul environnement où l'APK existe :
 *
 *  - `navigator.share` n'est pas implémenté dans une WebView Android (browser-compat-data :
 *    `webview_android: false`, crbug 40540400), alors qu'il l'est dans celle d'iOS, qui suit
 *    Safari. Le bouton « Partager » ne partageait donc rien sur Android ;
 *  - l'attribut `download` d'une ancre est ignoré par une WebView. Le repli ne téléchargeait
 *    donc rien non plus.
 *
 * Résultat : les deux boutons ne faisaient RIEN, sans le moindre message — le chauffeur
 * appuyait, et il ne se passait rien. Constaté sur l'APK, et c'est le pire des états : un
 * bouton inerte ne se distingue pas d'un bouton qu'on n'a pas touché.
 *
 * Le partage passe désormais par les greffons natifs, qui ne dépendent d'aucune API du web.
 * L'ordre des tentatives suit le moindre risque : l'API web d'abord, parce qu'elle ne demande
 * ni écriture sur disque ni permission et qu'elle est la seule à fonctionner dans un
 * navigateur ; les greffons ensuite ; l'ancre en dernier recours.
 */

import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { estApplicationNative } from './native';

/**
 * Taille des tranches de conversion. Voir `blobEnBase64`.
 */
const TAILLE_TRANCHE = 0x8000;

/**
 * Convertit un blob en base64, par tranches.
 *
 * `String.fromCharCode(...octets)` étale le tableau en arguments : au-delà d'une centaine de
 * milliers d'octets, la pile d'appels déborde — « Maximum call stack size exceeded » — et le
 * partage échoue sur les PDF un peu volumineux, c'est-à-dire sur ceux qui comptent. Les
 * tranches évitent cela, et un PDF de plusieurs mégaoctets passe sans peine.
 *
 * Le base64 est la forme qu'exige le greffon d'écriture : il décode avant d'écrire, et refuse
 * toute autre forme pour des données binaires.
 */
export async function blobEnBase64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let debut = 0; debut < octets.length; debut += TAILLE_TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + TAILLE_TRANCHE));
  }
  return btoa(binaire);
}

/**
 * Vrai si l'erreur est une annulation demandée par la personne.
 *
 * La distinction est nécessaire : une feuille de partage REFUSÉE ne doit pas en rouvrir une
 * seconde. Le chauffeur a appuyé sur « Annuler », ce n'est pas une demande d'essayer autre
 * chose — et le repli le ferait, ce qui donnerait une feuille qui se rouvre toute seule.
 */
function estAnnulation(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'name' in erreur &&
    (erreur as { name?: unknown }).name === 'AbortError'
  );
}

/** Le partage par l'API du web. Vrai si le partage a bien été proposé. */
async function partagerParApiWeb(
  blob: Blob,
  nomFichier: string,
  titre: string,
  typeMime: string,
): Promise<boolean> {
  try {
    const fichier = new File([blob], nomFichier, { type: typeMime });
    const donnees: ShareData = { files: [fichier], title: titre };
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(donnees) &&
      typeof navigator.share === 'function'
    ) {
      await navigator.share(donnees);
      return true;
    }
  } catch (erreur) {
    return estAnnulation(erreur);
  }
  return false;
}

/**
 * Le partage par les greffons natifs. Vrai si le partage a bien été proposé.
 *
 * Le fichier est écrit dans le CACHE de l'application, et pas ailleurs : c'est la seule
 * destination que Capacitor autorise au partage sur Android, son FileProvider n'exposant que
 * ce dossier. Aucune permission n'est requise pour ce dossier, et rien ne quitte l'appareil
 * tant que le chauffeur n'a pas choisi une destination dans la feuille du système.
 *
 * Rend `false` quand le mécanisme est indisponible — greffons absents d'une version
 * antérieure de l'application, par exemple — pour laisser l'appelant tenter la suite.
 */
async function partagerParGreffons(
  blob: Blob,
  nomFichier: string,
  titre: string,
): Promise<boolean> {
  try {
    const { uri } = await Filesystem.writeFile({
      path: nomFichier,
      data: await blobEnBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title: titre, dialogTitle: titre, files: [uri] });
    return true;
  } catch (erreur) {
    return estAnnulation(erreur);
  }
}

/** Le téléchargement par ancre. Seul chemin possible dans un navigateur de bureau. */
function telechargerParAncre(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const ancre = document.createElement('a');
  ancre.href = url;
  ancre.download = nomFichier;
  ancre.rel = 'noopener';
  document.body.appendChild(ancre);
  ancre.click();
  document.body.removeChild(ancre);
  // Révocation différée : certains navigateurs ont besoin de l'URL le temps du téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Télécharge un fichier, ou le fait enregistrer par le système quand il n'y a pas de
 * téléchargement possible.
 *
 * Dans une WebView, l'attribut `download` d'une ancre est ignoré : il n'existe pas de
 * téléchargement direct. La feuille de partage du système propose « Enregistrer dans
 * Fichiers », et c'est ainsi qu'on enregistre un document sur Android comme sur iOS — le
 * bouton « Télécharger » ouvre donc la même feuille, parce qu'il n'y a pas d'autre issue.
 */
export async function telechargerBlob(blob: Blob, nomFichier: string): Promise<void> {
  if (estApplicationNative() && (await partagerParGreffons(blob, nomFichier, nomFichier))) return;
  telechargerParAncre(blob, nomFichier);
}

/**
 * Partage un fichier par le meilleur moyen disponible.
 *
 * Rend `'partage'` quand une feuille a été proposée, `'telecharge'` quand il a fallu se
 * rabattre sur le téléchargement.
 */
export async function partagerBlob(
  blob: Blob,
  nomFichier: string,
  titre: string,
  typeMime = 'application/pdf',
): Promise<'partage' | 'telecharge'> {
  if (await partagerParApiWeb(blob, nomFichier, titre, typeMime)) return 'partage';
  if (await partagerParGreffons(blob, nomFichier, titre)) return 'partage';
  telechargerParAncre(blob, nomFichier);
  return 'telecharge';
}
