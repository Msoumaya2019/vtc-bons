/**
 * Lecture des durées de licence, depuis la source unique : `src/features/premium/offres.ts`.
 *
 * Ce module est PUR : l'importer ne signe rien, ne lit aucun argument et n'écrit nulle
 * part. C'est ce qui permet de l'éprouver — un module qui délivrerait une licence à
 * l'import serait une surprise coûteuse, et un test qui en dépendrait ne serait pas
 * exécutable sur une machine sans clé privée, c'est-à-dire sur toute intégration continue.
 *
 * POURQUOI CETTE LECTURE EXISTE. La durée d'une licence est écrite à deux endroits qui ne
 * peuvent pas se lire : l'écran qui annonce la formule au client, et le script qui signe
 * le droit. Recopier « 31 » dans le script tiendrait jusqu'au premier changement de tarif,
 * puis divergerait — et dans ce sens-là le défaut est invisible, puisqu'il avantage le
 * client : on signerait un an à un abonné mensuel sans que rien ne le signale.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));

export const SOURCE_FORMULES = join(ICI, '..', 'src', 'features', 'premium', 'offres.ts');

/** Les identifiants admis, dans l'ordre où ils sont déclarés. */
export const FORMULES_CONNUES = ['mensuel', 'annuel'];

/**
 * Rend `{ mensuel: 31, annuel: 366 }`, lu dans `offres.ts`.
 *
 * LÈVE si rien n'est trouvé, plutôt que de rendre un objet vide ou une valeur de repli :
 * un repli rendrait un changement de format silencieusement inoffensif, et c'est
 * précisément ce qu'on cherche à empêcher.
 */
export function lireFormules(chemin = SOURCE_FORMULES) {
  const source = readFileSync(chemin, 'utf8');
  const formules = {};
  const motif = /\{\s*id:\s*'([a-z]+)'[^}]*?jours:\s*(\d+)/g;

  let trouve;
  while ((trouve = motif.exec(source)) !== null) {
    formules[trouve[1]] = Number(trouve[2]);
  }

  if (Object.keys(formules).length === 0) {
    throw new Error(`Aucune formule lue dans ${chemin} : le format a dû changer.`);
  }
  return formules;
}
