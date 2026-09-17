/**
 * Vérifie les flux de travail GitHub sans les pousser.
 *
 * POURQUOI CE FICHIER EXISTE.
 *
 * Un flux de travail se teste normalement en le poussant, et c'est le pire moment pour découvrir
 * une faute : sur ce projet, la compilation Android installe Java, le SDK, puis les dépendances
 * avant d'échouer. Deux allers-retours suffisent à perdre une heure.
 *
 * Les défauts se répartissent en deux familles, très inégales en coût :
 *
 *   • YAML mal formé   — le flux ne démarre pas. Immédiat, bruyant, sans conséquence.
 *   • script `run:` invalide — le flux démarre et échoue APRÈS l'installation complète. C'est
 *     celui-ci qui coûte cher, et il ne se voit qu'en lisant le script ligne à ligne.
 *
 * Ce script lit donc les deux : il analyse le YAML, puis passe CHAQUE script `run:` à `bash -n`
 * (analyse sans exécution). Ce qu'un humain rate, `bash -n` l'attrape en deux secondes.
 *
 * Usage : node scripts/check-workflows.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import yaml from 'js-yaml';

const DOSSIER = '.github/workflows';

/**
 * Remplace les expressions GitHub par une valeur inerte.
 *
 * GitHub substitue `${{ … }}` AVANT de confier le script au shell : `bash` ne saurait pas les
 * lire, et `bash -n` échouerait sur du code pourtant correct. Sans cette neutralisation, le
 * contrôle produirait des faux positifs à chaque expression — donc on cesserait de le croire.
 */
function neutraliser(script) {
  return script.replace(/\$\{\{[^}]*\}\}/g, 'VALEUR');
}

/** Les échecs relevés, sous forme « fichier : message ». */
const echecs = [];
let verifications = 0;

function controler(condition, fichier, message) {
  verifications += 1;
  if (!condition) echecs.push(`${fichier} : ${message}`);
}

/**
 * Une action est épinglée si elle porte un `@` suivi d'une version.
 *
 * `uses: actions/checkout` sans version peut changer de comportement sans qu'aucune ligne du
 * dépôt n'ait bougé. Les références mobiles (`@main`, `@master`, `@HEAD`) ont le même défaut.
 */
function estEpinglee(reference) {
  if (typeof reference !== 'string' || !reference.includes('@')) return false;
  const version = reference.slice(reference.lastIndexOf('@') + 1);
  return version.length > 0 && !['main', 'master', 'HEAD'].includes(version);
}

/** Passe un script `run:` à l'analyse syntaxique du shell. */
function scriptValide(script) {
  const resultat = spawnSync('bash', ['-n'], {
    input: neutraliser(script),
    encoding: 'utf-8',
  });
  if (resultat.error) {
    throw new Error(`bash introuvable : ${resultat.error.message}`);
  }
  return resultat.status === 0 ? null : (resultat.stderr || '').trim();
}

const fichiers = readdirSync(DOSSIER).filter((nom) => /\.ya?ml$/.test(nom));

if (fichiers.length === 0) {
  console.error(`Aucun flux de travail dans ${DOSSIER}.`);
  process.exit(1);
}

for (const nom of fichiers.sort()) {
  const contenu = readFileSync(path.join(DOSSIER, nom), 'utf-8');

  let flux;
  try {
    flux = yaml.load(contenu);
  } catch (erreur) {
    echecs.push(`${nom} : YAML invalide — ${erreur.message}`);
    continue;
  }

  controler(flux !== null && typeof flux === 'object', nom, 'le document ne contient pas un objet');

  // Le déclencheur. Sous un analyseur en schéma YAML 1.1, `on:` devient la clé booléenne `true`
  // et le flux ne se déclencherait jamais — d'où le contrôle du type, et pas seulement de la
  // présence.
  controler('on' in (flux ?? {}), nom, 'aucun déclencheur `on`');
  controler(
    !(true in (flux ?? {})),
    nom,
    'le déclencheur a été lu comme un booléen (schéma YAML 1.1)',
  );

  controler('permissions' in (flux ?? {}), nom, 'aucun bloc `permissions`');
  controler(
    flux?.jobs !== null &&
      typeof flux?.jobs === 'object' &&
      Object.keys(flux.jobs ?? {}).length > 0,
    nom,
    'aucun travail dans `jobs`',
  );

  for (const [nomTravail, travail] of Object.entries(flux?.jobs ?? {})) {
    const ou = `${nom} / ${nomTravail}`;
    controler(typeof travail?.['runs-on'] === 'string', ou, '`runs-on` absent');
    controler(Array.isArray(travail?.steps) && travail.steps.length > 0, ou, 'aucune étape');

    for (const [rang, etape] of (travail?.steps ?? []).entries()) {
      const ouEtape = `${ou} / étape ${rang + 1}`;

      // Une étape qui n'a ni `uses` ni `run` ne fait rien, et GitHub l'accepte : c'est une
      // étape oubliée qui passe inaperçue.
      controler(
        typeof etape?.uses === 'string' || typeof etape?.run === 'string',
        ouEtape,
        'ni `uses` ni `run` — l’étape ne fait rien',
      );

      if (typeof etape?.uses === 'string') {
        controler(estEpinglee(etape.uses), ouEtape, `action non épinglée : ${etape.uses}`);
      }

      if (typeof etape?.run === 'string') {
        const probleme = scriptValide(etape.run);
        controler(probleme === null, ouEtape, `script \`run:\` invalide — ${probleme}`);
      }
    }
  }
}

if (echecs.length > 0) {
  console.error(`\n${echecs.length} défaut(s) :\n`);
  for (const echec of echecs) console.error(`  • ${echec}`);
  process.exit(1);
}

console.log(`${fichiers.length} flux analysés, ${verifications} vérifications, aucun défaut.`);
