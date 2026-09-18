/**
 * Délivre une licence : signe une charge utile avec la clé privée.
 *
 * C'est le pendant de `src/lib/licence.ts`. L'application ne peut que VÉRIFIER ; c'est
 * ici, et seulement ici, qu'un droit est créé. La clé privée lue est celle que
 * `.gitignore` écarte du dépôt.
 *
 * Exemples :
 *   node scripts/delivrer-licence.mjs --sujet "Transports Dupont" --formule mensuel
 *   node scripts/delivrer-licence.mjs --sujet "Transports Dupont" --formule annuel
 *   node scripts/delivrer-licence.mjs --sujet "Mon appareil" --jours 7300 --type developpeur
 *
 * `--formule` est préféré à `--jours` pour un client : la durée vient alors de
 * `src/features/premium/offres.ts`, la même que celle annoncée à l'achat. Recopier « 31 »
 * ici donnerait, au premier changement de tarif, un an signé à un abonné mensuel — et rien
 * ne le signalerait avant que le client ne s'en aperçoive, en mieux.
 *
 * La date d'expiration est calculée en heure LOCALE, comme `joursRestants()` dans
 * `src/lib/format.ts` : un calcul en UTC décalerait d'un jour selon le fuseau, et un
 * abonnement d'un mois finirait la veille.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lireFormules } from './formules-licence.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIER_PRIVE = join(ICI, 'cle-licence-privee.jwk.json');

function lireArguments(argv) {
  const valeurs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const cle = argv[index];
    if (!cle.startsWith('--')) continue;
    const valeur = argv[index + 1];
    if (valeur === undefined || valeur.startsWith('--')) {
      valeurs[cle.slice(2)] = true;
    } else {
      valeurs[cle.slice(2)] = valeur;
      index += 1;
    }
  }
  return valeurs;
}

function dateLocaleISO(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

function ajouterJours(nombre) {
  const date = new Date();
  date.setDate(date.getDate() + nombre);
  return dateLocaleISO(date);
}

const args = lireArguments(process.argv.slice(2));

if (!existsSync(FICHIER_PRIVE)) {
  console.error(`Clé privée introuvable : ${FICHIER_PRIVE}`);
  console.error('L’engendrer d’abord avec : node scripts/generer-cles-licence.mjs');
  process.exit(1);
}

const sujet = typeof args.sujet === 'string' ? args.sujet.trim() : '';
if (sujet === '') {
  console.error('--sujet est obligatoire : c’est le nom qui permettra de retrouver qui a payé.');
  process.exit(1);
}

const type = typeof args.type === 'string' ? args.type : 'abonnement';
if (type !== 'abonnement' && type !== 'developpeur') {
  console.error(`--type doit valoir « abonnement » ou « developpeur », reçu « ${type} ».`);
  process.exit(1);
}

let formules;
try {
  formules = lireFormules();
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : String(erreur));
  console.error('Refus de délivrer à l’aveugle : la durée doit venir d’une source sûre.');
  process.exit(1);
}

const formule = typeof args.formule === 'string' ? args.formule : null;

if (formule !== null && typeof args.jours === 'string') {
  console.error('--formule et --jours s’excluent : la durée doit venir d’un seul endroit.');
  process.exit(1);
}

let jours;
if (formule !== null) {
  if (!Object.hasOwn(formules, formule)) {
    console.error(
      `--formule doit valoir ${Object.keys(formules).join(' ou ')}, reçu « ${formule} ».`,
    );
    process.exit(1);
  }
  jours = formules[formule];
} else {
  jours = typeof args.jours === 'string' ? Number(args.jours) : NaN;
}

if (!Number.isInteger(jours) || jours < 0) {
  console.error('--formule ou --jours est obligatoire.');
  console.error(`  --formule ${Object.keys(formules).join(' | ')}   (durée lue dans offres.ts)`);
  console.error('  --jours <entier>          (durée libre, pour une licence de développement)');
  process.exit(1);
}

const charge = { sujet, expiration: ajouterJours(jours), type };
const chargeOctets = new TextEncoder().encode(JSON.stringify(charge));

const priveeJwk = JSON.parse(readFileSync(FICHIER_PRIVE, 'utf8'));
const cle = await crypto.subtle.importKey(
  'jwk',
  priveeJwk,
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign'],
);

const signature = new Uint8Array(
  await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, chargeOctets),
);

const jeton = `${Buffer.from(chargeOctets).toString('base64url')}.${Buffer.from(signature).toString('base64url')}`;

console.log(`Charge      : ${JSON.stringify(charge)}`);
console.log(`Expiration  : ${charge.expiration} (dans ${jours} jour(s))`);
console.log('');
console.log('Jeton de licence :');
console.log(jeton);
