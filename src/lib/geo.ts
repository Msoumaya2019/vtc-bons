/**
 * AIDE À LA SAISIE D'ADRESSE.
 *
 * C'est le SEUL endroit de l'application qui sorte sur le réseau. Trois services,
 * tous gratuits, sans compte et sans clé d'API — condition indispensable, le dépôt
 * étant public :
 *
 *   • Photon (Komoot, Allemagne)  — recherche d'adresse et géocodage inverse ;
 *   • OSRM (FOSSGIS, Allemagne)   — distance routière réelle entre deux points ;
 *   • la géolocalisation du système, pour proposer l'adresse où l'on se trouve.
 *
 * Deux règles gouvernent ce module :
 *
 *   1. RIEN N'EST BLOQUANT. Hors connexion, si le service est en panne ou si le
 *      délai est dépassé, chaque fonction renvoie null ou une liste vide. La saisie
 *      manuelle d'une adresse reste toujours possible : l'application ne dépend
 *      jamais de ces services pour fonctionner.
 *   2. RIEN N'EST CONSERVÉ. Aucune adresse n'est écrite sur le disque ni envoyée
 *      ailleurs qu'aux deux services ci-dessus. Le cache ci-dessous ne vit que le
 *      temps de l'écran, pour éviter d'interroger le service à chaque lettre.
 */

import { Geolocation } from '@capacitor/geolocation';

export interface Adresse {
  /** Libellé complet, tel qu'il sera inscrit sur le bon. */
  libelle: string;
  longitude: number;
  latitude: number;
}

export interface PositionGeo {
  longitude: number;
  latitude: number;
}

export interface Distance {
  km: number;
  minutes: number;
}

/**
 * Pourquoi une position n'a pas pu être obtenue. L'écran en déduit un message
 * utile : « autorisation refusée » n'appelle pas la même réaction que « délai
 * dépassé ».
 */
export type EchecPosition = 'refusee' | 'indisponible' | 'delai';

/** Au-delà, on considère le service injoignable. Mieux vaut rendre la main. */
const DELAI_RESEAU_MS = 8_000;

/**
 * Photon demande de ne pas dépasser une requête par seconde. La frappe est déjà
 * temporisée, mais rien ne garantit qu'une rafale ne parte pas d'un coup.
 */
const INTERVALLE_MINIMUM_MS = 1_000;

let derniereRequete = 0;

async function attendreTour(): Promise<void> {
  const attente = derniereRequete + INTERVALLE_MINIMUM_MS - Date.now();
  if (attente > 0) await new Promise((resoudre) => setTimeout(resoudre, attente));
  derniereRequete = Date.now();
}

/**
 * Requête réseau tolérante : délai maximal, annulation possible, et aucun échec
 * propagé. Renvoie null plutôt que de lever — l'appelant n'a jamais à se protéger.
 */
async function demander(url: string, signal?: AbortSignal): Promise<unknown> {
  const minuterie = new AbortController();
  const expiration = setTimeout(() => minuterie.abort(), DELAI_RESEAU_MS);
  const surAnnulation = () => minuterie.abort();
  signal?.addEventListener('abort', surAnnulation);

  try {
    await attendreTour();
    const reponse = await fetch(url, { signal: minuterie.signal });
    if (!reponse.ok) return null;
    return (await reponse.json()) as unknown;
  } catch {
    // Réseau coupé, délai dépassé, service en panne, JSON invalide : dans tous les
    // cas la saisie manuelle prend le relais, donc rien à signaler ici.
    return null;
  } finally {
    clearTimeout(expiration);
    signal?.removeEventListener('abort', surAnnulation);
  }
}

interface ProprietesPhoton {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
}

interface ReponsePhoton {
  features?: {
    geometry?: { coordinates?: number[] };
    properties?: ProprietesPhoton;
  }[];
}

/**
 * Compose un libellé lisible. Photon met tantôt la voie dans `street`, tantôt dans
 * `name` selon la nature du lieu — d'où le repli. On évite aussi de répéter la
 * ville quand elle tient déjà lieu de nom, ce qui donnerait « Pontoise, 95300
 * Pontoise ».
 */
function composerLibelle(proprietes: ProprietesPhoton): string {
  const voie = [proprietes.housenumber, proprietes.street || proprietes.name]
    .filter(Boolean)
    .join(' ');
  const localite = [proprietes.postcode, proprietes.city].filter(Boolean).join(' ');

  if (voie && voie.toLowerCase() !== (proprietes.city ?? '').toLowerCase()) {
    return [voie, localite].filter(Boolean).join(', ');
  }
  return localite || voie;
}

function lireAdresses(donnees: unknown): Adresse[] {
  const reponse = donnees as ReponsePhoton | null;
  if (!reponse?.features) return [];

  const adresses: Adresse[] = [];
  for (const element of reponse.features) {
    const coordonnees = element.geometry?.coordinates;
    const libelle = composerLibelle(element.properties ?? {});
    if (!coordonnees || coordonnees.length < 2 || !libelle) continue;
    adresses.push({
      libelle,
      longitude: coordonnees[0],
      latitude: coordonnees[1],
    });
  }
  return adresses;
}

/** Cache de session : évite de redemander au service ce qu'on vient d'obtenir. */
const cacheRecherche = new Map<string, Adresse[]>();

/**
 * Vide le cache et remet le régulateur à zéro. Réservé aux tests : sans cela, le
 * délai d'une seconde entre deux requêtes rendrait chaque test lent et dépendant
 * de l'ordre d'exécution.
 */
export function reinitialiserGeo(): void {
  cacheRecherche.clear();
  derniereRequete = 0;
}

/**
 * Propositions d'adresses pour un texte en cours de frappe.
 *
 * Renvoie une liste vide si le texte est trop court, si le réseau est absent ou si
 * le service ne répond pas : l'écran n'affiche alors simplement aucune suggestion.
 */
export async function chercherAdresses(
  texte: string,
  options: { signal?: AbortSignal; limite?: number } = {},
): Promise<Adresse[]> {
  const requete = texte.trim();
  // En dessous de quatre caractères, les propositions sont du bruit.
  if (requete.length < 4) return [];

  const cle = `${requete.toLowerCase()}|${options.limite ?? 5}`;
  const deja = cacheRecherche.get(cle);
  if (deja) return deja;

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', requete);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('limit', String(options.limite ?? 5));

  const adresses = lireAdresses(await demander(url.toString(), options.signal));
  if (adresses.length > 0) cacheRecherche.set(cle, adresses);
  return adresses;
}

/**
 * Adresse correspondant à une position : c'est ce qui permet de proposer « l'endroit
 * où je suis » sans que le chauffeur ait à le taper.
 */
export async function adresseDepuisPosition(
  position: PositionGeo,
  options: { signal?: AbortSignal } = {},
): Promise<Adresse | null> {
  const url = new URL('https://photon.komoot.io/reverse');
  url.searchParams.set('lon', String(position.longitude));
  url.searchParams.set('lat', String(position.latitude));
  url.searchParams.set('lang', 'fr');

  return lireAdresses(await demander(url.toString(), options.signal))[0] ?? null;
}

/**
 * Résout une adresse écrite à la main en coordonnées, pour pouvoir calculer une
 * distance même quand le chauffeur n'a rien choisi dans les propositions.
 */
export async function geocoderAdresse(
  texte: string,
  options: { signal?: AbortSignal } = {},
): Promise<Adresse | null> {
  return (await chercherAdresses(texte, { ...options, limite: 1 }))[0] ?? null;
}

interface ReponseOsrm {
  code?: string;
  routes?: { distance?: number; duration?: number }[];
}

/**
 * Distance routière réelle entre deux adresses, par la route et non à vol d'oiseau.
 * Renvoie null si l'itinéraire n'a pas pu être obtenu.
 */
export async function calculerDistance(
  depart: PositionGeo,
  arrivee: PositionGeo,
  options: { signal?: AbortSignal } = {},
): Promise<Distance | null> {
  const trace = `${depart.longitude},${depart.latitude};${arrivee.longitude},${arrivee.latitude}`;
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${trace}`);
  url.searchParams.set('overview', 'false');

  const reponse = (await demander(url.toString(), options.signal)) as ReponseOsrm | null;
  const route = reponse?.routes?.[0];
  if (!route || typeof route.distance !== 'number') return null;

  return {
    // Au dixième de kilomètre : c'est la précision utile pour un devis, et cela
    // évite d'afficher « 42,2384 km ».
    km: Math.round(route.distance / 100) / 10,
    minutes: Math.round((route.duration ?? 0) / 60),
  };
}

/**
 * Position courante de l'appareil.
 *
 * On passe par le plugin Capacitor plutôt que par `navigator.geolocation` : dans
 * une WebView iOS, l'API du navigateur n'est pas fiable et échoue sans explication.
 * Le plugin couvre aussi le web, où il délègue à la même API — un seul chemin de
 * code, donc un seul comportement à vérifier.
 */
export async function positionActuelle(): Promise<
  { ok: true; position: PositionGeo } | { ok: false; raison: EchecPosition }
> {
  try {
    const coordonnees = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
    return {
      ok: true,
      position: {
        longitude: coordonnees.coords.longitude,
        latitude: coordonnees.coords.latitude,
      },
    };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    if (/denied|refus|permission/i.test(message)) return { ok: false, raison: 'refusee' };
    if (/timeout|délai|delai/i.test(message)) return { ok: false, raison: 'delai' };
    return { ok: false, raison: 'indisponible' };
  }
}

/** Message destiné au chauffeur, à partir de la raison de l'échec. */
export function messageEchecPosition(raison: EchecPosition): string {
  switch (raison) {
    case 'refusee':
      return 'Autorisation refusée. Activez la localisation pour cette application dans les réglages du téléphone.';
    case 'delai':
      return 'La position n’a pas été obtenue à temps. Réessayez, de préférence dehors.';
    default:
      return 'Position indisponible. Saisissez l’adresse à la main.';
  }
}
