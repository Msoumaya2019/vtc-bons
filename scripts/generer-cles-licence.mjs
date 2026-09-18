/**
 * Engendre la paire de clés qui signe les licences.
 *
 * À exécuter UNE fois. Les deux clés n'ont pas le même destin, et c'est tout le
 * mécanisme :
 *
 *  - la clé PRIVÉE signe. Elle est écrite dans `scripts/cle-licence-privee.jwk.json`,
 *    que `.gitignore` écarte. Elle ne doit jamais entrer dans le dépôt, exactement
 *    comme la clé de signature Android.
 *  - la clé PUBLIQUE vérifie. Elle est faite pour être publiée : elle est recopiée
 *    dans `src/lib/licence.ts`, et c'est elle qui permet à l'application de
 *    reconnaître une licence sans rien demander à personne, donc hors ligne.
 *
 * La paire engendrée ici est une paire de DÉVELOPPEMENT. Le jour de la première
 * vente, la paire de production sera engendrée sur le serveur, et la clé publique
 * remplacée dans `src/lib/licence.ts`. Remplacer la clé publique invalide les
 * licences déjà délivrées — sans conséquence tant qu'il n'y en a aucune.
 */

import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIER_PRIVE = join(ICI, 'cle-licence-privee.jwk.json');

if (existsSync(FICHIER_PRIVE)) {
  console.error(`La clé privée existe déjà : ${FICHIER_PRIVE}`);
  console.error('La supprimer délibérément avant d’en engendrer une autre —');
  console.error('les licences déjà signées par l’ancienne cesseraient d’être reconnues.');
  process.exit(1);
}

const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);

const publiqueBrute = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));
const priveeJwk = await crypto.subtle.exportKey('jwk', paire.privateKey);

writeFileSync(FICHIER_PRIVE, `${JSON.stringify(priveeJwk, null, 2)}\n`, 'utf8');

const publiqueBase64Url = Buffer.from(publiqueBrute).toString('base64url');

console.log(`Clé privée écrite dans ${FICHIER_PRIVE} (écartée par .gitignore).`);
console.log('');
console.log(`Clé publique brute : ${publiqueBrute.length} octets (point P-256 non compressé).`);
console.log('');
console.log('À recopier dans src/lib/licence.ts :');
console.log('');
console.log(`  export const CLE_PUBLIQUE = '${publiqueBase64Url}';`);
console.log('');
