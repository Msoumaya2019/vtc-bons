/**
 * Vérifie que le raccourci d'écran d'accueil déclaré dans le manifeste est réellement
 * utilisable.
 *
 * Pourquoi ce contrôle existe : un raccourci ne se voit PAS dans l'application. S'il est
 * mal formé — adresse hors du périmètre autorisé, ou onglet qui n'existe plus — le
 * navigateur l'écarte en silence, ou ouvre un autre écran. Aucun test ne le couvre, rien
 * dans l'interface ne le signale, et le défaut n'apparaîtrait que sur le téléphone du
 * chauffeur, après un appui long sur l'icône, devant un client qui attend.
 *
 * Le contrôle porte sur le fichier RÉELLEMENT publié (`dist/manifest.webmanifest`) et non
 * sur la configuration qui le produit : c'est le fichier généré que le navigateur lit, et
 * lui seul. C'est aussi la seule façon de voir qu'un champ a été conservé tel quel par le
 * greffon de génération.
 *
 * Deux vérifications, dont une qui relie deux fichiers que rien ne reliait :
 *  1. chaque adresse de raccourci reste dans la portée déclarée par `scope` ;
 *  2. l'onglet visé est bien déclaré comme route dans `src/App.tsx` — sans quoi la route
 *     « * » ramènerait le chauffeur vers l'assistant de création, sans le moindre message.
 */
import { readFileSync } from 'node:fs';

const racine = new URL('../', import.meta.url);

/**
 * Base fictive pour résoudre les adresses relatives du manifeste.
 *
 * Elle imite volontairement un sous-répertoire (`/vtc-bons/`), comme GitHub Pages : c'est
 * ce qui permet de voir qu'une adresse absolue écrite par erreur sortirait de la portée.
 * Résoudre contre la racine du domaine masquerait précisément le défaut recherché.
 */
const BASE = 'https://exemple.test/vtc-bons/manifest.webmanifest';

let manifeste;
try {
  manifeste = JSON.parse(readFileSync(new URL('dist/manifest.webmanifest', racine), 'utf8'));
} catch {
  console.error(
    'Le manifeste publié est introuvable (dist/manifest.webmanifest). ' +
      'Lancez « npm run build » avant ce contrôle.',
  );
  process.exit(1);
}

const raccourcis = manifeste.shortcuts ?? [];

if (raccourcis.length === 0) {
  console.error(
    "Aucun raccourci n'est déclaré dans le manifeste publié. Un appui long sur l'icône " +
      "de l'application installée n'offrira donc aucun accès direct à l'onglet Instantané. " +
      'Voir la section « Raccourci d’écran d’accueil » du README.',
  );
  process.exit(1);
}

// Les routes déclarées dans l'application : seul juge de ce qui existe vraiment.
const sourceApplication = readFileSync(new URL('src/App.tsx', racine), 'utf8');
const routesDeclarees = [...sourceApplication.matchAll(/<Route\s+path="([^"]+)"/g)].map(
  ([, chemin]) => chemin,
);

const portee = new URL(manifeste.scope ?? './', BASE);
const problemes = [];

for (const raccourci of raccourcis) {
  const nom = raccourci.name ?? '(sans nom)';

  // `name` et `url` sont les deux seuls champs obligatoires du manifeste.
  if (!raccourci.name || !raccourci.url) {
    problemes.push(`« ${nom} » : les champs « name » et « url » sont obligatoires.`);
    continue;
  }

  const adresse = new URL(raccourci.url, BASE);

  // Hors de la portée déclarée, le navigateur écarte le raccourci sans rien dire.
  if (!adresse.href.startsWith(portee.href)) {
    problemes.push(
      `« ${nom} » : l'adresse « ${raccourci.url} » sort de la portée « ${manifeste.scope} ».`,
    );
    continue;
  }

  // Le dièse porte l'onglet. Sans lui, le raccourci ouvrirait la racine de l'application,
  // c'est-à-dire l'assistant de création : l'inverse de ce qui est voulu.
  if (!adresse.hash) {
    problemes.push(
      `« ${nom} » : l'adresse « ${raccourci.url} » ne désigne aucun onglet (il manque le dièse).`,
    );
    continue;
  }

  const chemin = adresse.hash.slice(1).split('?')[0];

  if (!routesDeclarees.includes(chemin)) {
    problemes.push(
      `« ${nom} » : l'onglet « ${chemin} » n'est pas déclaré dans src/App.tsx. ` +
        `Routes existantes : ${routesDeclarees.join(', ')}.`,
    );
  }
}

if (problemes.length > 0) {
  for (const probleme of problemes) console.error(probleme);
  process.exit(1);
}

console.log(
  `Raccourcis d'écran d'accueil utilisables : ${raccourcis.length} déclaré(s), tous dans ` +
    `la portée « ${manifeste.scope} » et pointant vers un onglet existant.`,
);
