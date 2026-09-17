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
 * Trois vérifications, dont deux qui relient des fichiers que rien ne reliait :
 *  1. le schéma d'adresse s'accorde d'un bout à l'autre — application, manifeste Android,
 *     raccourci Android, déclaration iOS et script d'insertion ;
 *  2. chaque adresse de raccourci du manifeste reste dans la portée déclarée par `scope` ;
 *  3. l'onglet visé est bien déclaré comme route dans `src/App.tsx` — sans quoi la route
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

/**
 * ACCORD DU SCHÉMA D'ADRESSE, D'UN BOUT À L'AUTRE.
 *
 * Le schéma `vtcbons` est écrit en clair à QUATRE endroits qui ne se voient pas entre eux :
 * la constante de l'application, le fragment du manifeste Android, la déclaration iOS du
 * flux de travail, et le marqueur d'idempotence du script qui pose le fragment.
 *
 * En changer un seul ne casse rien à la compilation, ne fait échouer aucun test, et ne se
 * voit pas à l'écran : le système ouvre bien l'application, qui refuse alors l'adresse en
 * silence. C'est très exactement le « raccourci qui n'ouvre rien » que l'en-tête de
 * `src/lib/lienProfond.ts` désigne comme le danger à éviter — et rien ne le vérifiait.
 *
 * La constante de l'application fait foi ; les trois autres doivent s'y accorder. Ce
 * contrôle passe AVANT la lecture du manifeste, pour qu'une compilation absente ne puisse
 * pas masquer un désaccord de schéma.
 */
function verifierAccordDuSchema() {
  const source = readFileSync(new URL('src/lib/lienProfond.ts', racine), 'utf8');

  const schema = source.match(/SCHEMA_LIEN_PROFOND\s*=\s*'([^']+)'/)?.[1];
  const gabarit = source.match(/ADRESSE_INSTANTANE\s*=\s*`([^`]+)`/)?.[1];

  if (!schema || !gabarit) {
    console.error(
      "Le schéma d'adresse n'a pas pu être lu dans src/lib/lienProfond.ts : la forme des " +
        'constantes a changé. Ce contrôle serait donc resté VIDE, et un vide ne prouve ' +
        'rien — adapter ce vérificateur plutôt que de le laisser passer.',
    );
    process.exit(1);
  }

  const adresse = gabarit.replace('${SCHEMA_LIEN_PROFOND}', schema);

  /**
   * Chaque déclaration est relevée par son motif, et TOUTES doivent porter la même valeur.
   *
   * Chercher la simple PRÉSENCE du bon schéma ne suffit pas, et le défaut a été constaté :
   * le script d'insertion déclare le schéma deux fois — une fois comme marqueur de contrôle,
   * une fois comme détecteur d'idempotence. N'en corriger qu'une laissait le contrôle au
   * vert, alors que le script aurait réinséré le fragment une seconde fois. C'est l'ABSENCE
   * de valeur divergente qu'il faut vérifier, pas la présence d'une valeur attendue.
   */
  const declarations = [
    {
      fichier: 'native/android/activite.xml',
      motif: /android:scheme="([^"]+)"/g,
      attendu: schema,
      consequence: "l'intent-filter ne recevrait pas le lien",
    },
    {
      fichier: 'native/android/raccourcis.xml',
      motif: /android:data="([^"]+)"/g,
      attendu: adresse,
      consequence: "le raccourci Android ouvrirait une adresse que l'application refuse",
    },
    {
      fichier: '.github/workflows/ios-unsigned.yml',
      motif: /SCHEMA\s*=\s*"([^"]+)"/g,
      attendu: schema,
      consequence: "iOS n'accepterait pas le lien",
    },
    {
      fichier: 'scripts/declarer-raccourci-android.py',
      motif: /android:scheme="([^"]+)"/g,
      attendu: schema,
      consequence:
        "le script ne reconnaîtrait plus sa propre insertion, et l'insérerait une seconde fois",
    },
  ];

  const problemes = [];
  for (const { fichier, motif, attendu, consequence } of declarations) {
    let contenu;
    try {
      contenu = readFileSync(new URL(fichier, racine), 'utf8');
    } catch {
      problemes.push(`${fichier} : introuvable. Le dépôt est incomplet.`);
      continue;
    }

    const valeurs = [...contenu.matchAll(motif)].map(([, valeur]) => valeur);

    if (valeurs.length === 0) {
      problemes.push(
        `${fichier} : aucune déclaration trouvée — ${consequence}. ` +
          `Le schéma déclaré par l'application est « ${schema} ».`,
      );
      continue;
    }

    for (const valeur of valeurs) {
      if (valeur !== attendu) {
        problemes.push(
          `${fichier} : « ${valeur} » là où l'application attend « ${attendu} » — ${consequence}.`,
        );
      }
    }
  }

  if (problemes.length > 0) {
    for (const probleme of problemes) console.error(probleme);
    process.exit(1);
  }

  console.log(
    `Schéma d'adresse « ${schema} » accordé : application, manifeste Android, raccourci ` +
      'Android, déclaration iOS et script d’insertion.',
  );
}

verifierAccordDuSchema();

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
