/**
 * Vérifie que les binaires natifs de Rollup déclarés dans package.json sont
 * alignés sur la version de Rollup réellement installée.
 *
 * Pourquoi ces dépendances existent : npm n'inscrit dans package-lock.json que
 * les dépendances optionnelles correspondant à la plateforme sur laquelle le
 * lock a été produit (bug npm #4828). Ce projet est développé sous Windows :
 * le lock ne contenait donc que les binaires Windows, et `npm ci` fabriquait
 * sur Linux et macOS une installation où Rollup refusait de démarrer — la
 * compilation échouait sur la CI sans jamais échouer en local.
 *
 * Les déclarer en dépendances optionnelles DIRECTES force npm à les inscrire
 * toutes, quelle que soit la plateforme.
 *
 * Corollaire : leurs versions doivent suivre celle de Rollup. C'est l'objet de
 * ce contrôle, exécuté par la CI.
 */
import { readFileSync } from 'node:fs';

const racine = new URL('../', import.meta.url);

let versionRollup;
try {
  versionRollup = JSON.parse(
    readFileSync(new URL('node_modules/rollup/package.json', racine), 'utf8'),
  ).version;
} catch {
  console.error(
    "Rollup n'est pas installé. Lancez « npm ci » ou « npm install » avant ce contrôle.",
  );
  process.exit(1);
}

const { optionalDependencies = {} } = JSON.parse(
  readFileSync(new URL('package.json', racine), 'utf8'),
);

// On ne contrôle que les binaires de Rollup : d'autres dépendances optionnelles
// pourraient légitimement être ajoutées plus tard, à d'autres versions.
const binaires = Object.entries(optionalDependencies).filter(([paquet]) =>
  paquet.startsWith('@rollup/rollup-'),
);

if (binaires.length === 0) {
  console.error(
    "Aucun binaire de Rollup n'est déclaré dans package.json. La compilation échouera " +
      'sur Linux et macOS. Voir la section « Binaires natifs de Rollup » du README.',
  );
  process.exit(1);
}

const desalignes = binaires.filter(([, version]) => version !== versionRollup);

if (desalignes.length > 0) {
  for (const [paquet, version] of desalignes) {
    console.error(`${paquet} est épinglé en ${version}, mais Rollup installé est en ${versionRollup}.`);
  }
  console.error(
    'Alignez ces versions sur celle de Rollup dans package.json, puis régénérez ' +
      'package-lock.json avec « npm install ».',
  );
  process.exit(1);
}

console.log(
  `Binaires natifs de Rollup cohérents : ${binaires.length} déclarés, tous en ${versionRollup}.`,
);
