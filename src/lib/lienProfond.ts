/**
 * Liens profonds : ouvrir l'application directement sur un onglet.
 *
 * Un raccourci d'écran d'accueil ne peut pas ÉMETTRE un bon. Il tourne hors de
 * l'application, dans un autre processus, sans accès à ses données ni à son code : tout
 * ce qu'il sait faire, c'est ouvrir l'application à un endroit donné. C'est cette
 * traduction qu'on trouve ici.
 *
 * Le schéma d'adresse est déclaré dans les projets natifs — `AndroidManifest.xml` et
 * `Info.plist`. Ces dossiers ne sont pas versionnés et sont régénérés à chaque
 * compilation : les déclarations vivent donc dans les flux de travail. Les trois
 * doivent rester d'accord, sinon le raccourci ouvre l'application sans rien faire.
 */

/** Le schéma d'adresse de l'application. Doit correspondre aux déclarations natives. */
export const SCHEMA_LIEN_PROFOND = 'vtcbons';

/**
 * Les cibles acceptées, et elles seules.
 *
 * Une liste blanche, et non une conversion libre : l'adresse vient de l'EXTÉRIEUR de
 * l'application. Une adresse non reconnue doit ne rien faire, surtout pas retomber sur
 * la route « * » — celle-ci ramène à l'assistant de création en silence, et un
 * raccourci mal formé ouvrirait alors le mauvais écran sans que rien ne le signale.
 */
const CIBLES: Readonly<Record<string, string>> = {
  instantane: '/instantane',
};

/**
 * L'onglet visé par une adresse de lien profond, ou `null` si elle ne vient pas de
 * l'application, ou ne vise aucune cible connue.
 *
 * Les deux écritures sont acceptées, car elles diffèrent selon la façon dont le
 * raccourci est construit : « vtcbons://instantane » place la cible dans l'hôte, et
 * « vtcbons:///instantane » dans le chemin.
 */
export function ongletDepuisLien(url: string | null | undefined): string | null {
  if (!url) return null;

  let adresse: URL;
  try {
    adresse = new URL(url);
  } catch {
    // Une adresse illisible n'est pas une raison de planter : l'application s'ouvre
    // simplement là où elle s'ouvre d'habitude.
    return null;
  }

  if (adresse.protocol !== `${SCHEMA_LIEN_PROFOND}:`) return null;

  const cible = (adresse.hostname || adresse.pathname)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  return CIBLES[cible] ?? null;
}
