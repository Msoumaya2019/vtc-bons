/**
 * Génération des icônes de l'application.
 *
 * Pourquoi un script plutôt que des fichiers binaires déposés dans le dépôt ?
 *  1. les icônes sont reproductibles : `npm run icons` régénère exactement les mêmes ;
 *  2. aucune dépendance n'est ajoutée au projet — l'encodeur PNG ci-dessous s'appuie
 *     uniquement sur `node:zlib`, ce qui évite d'installer une bibliothèque de traitement
 *     d'image (et ses binaires natifs) pour quatre fichiers ;
 *  3. le dessin est décrit en clair, donc modifiable sans outil graphique.
 *
 * Le rendu utilise un échantillonnage 4×4 par pixel : les bords restent lisses sans
 * anticrénelage matériel.
 *
 * Usage : npm run icons
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_ICONES = join(RACINE, 'public', 'icons');

const BLEU_HAUT = [0x25, 0x63, 0xeb];
const BLEU_BAS = [0x1e, 0x40, 0xaf];
const BLANC = [0xff, 0xff, 0xff];
const BLEU_GLYPHE = [0x1d, 0x4e, 0xd8];

// ———————————————————————————————————————————————————————————————
// Encodeur PNG minimal (RGBA 8 bits, sans filtrage)
// ———————————————————————————————————————————————————————————————

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const octet of buffer) {
    c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length, 0);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps), 0);
  return Buffer.concat([longueur, corps, crc]);
}

/** @param {Uint8Array} pixels RGBA, largeur × hauteur × 4 octets */
function encoderPng(pixels, largeur, hauteur) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 6; // RGBA
  entete[10] = 0; // compression deflate
  entete[11] = 0; // filtrage standard
  entete[12] = 0; // pas d'entrelacement

  // Chaque ligne est précédée de son octet de filtre (0 = aucun).
  const brut = Buffer.alloc(hauteur * (1 + largeur * 4));
  for (let y = 0; y < hauteur; y += 1) {
    const depart = y * (1 + largeur * 4);
    brut[depart] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * largeur * 4, largeur * 4).copy(
      brut,
      depart + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', entete),
    chunk('IDAT', deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ———————————————————————————————————————————————————————————————
// Primitives de dessin (distances signées, en coordonnées normalisées 0..1)
// ———————————————————————————————————————————————————————————————

/** Distance signée à un rectangle arrondi centré en (cx, cy). Négatif = à l'intérieur. */
function distanceRectangleArrondi(x, y, cx, cy, demiLargeur, demiHauteur, rayon) {
  const qx = Math.abs(x - cx) - (demiLargeur - rayon);
  const qy = Math.abs(y - cy) - (demiHauteur - rayon);
  const exterieur = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return exterieur + Math.min(Math.max(qx, qy), 0) - rayon;
}

/** Distance signée à un segment épaissi (extrémités arrondies). */
function distanceSegment(x, y, ax, ay, bx, by, demiEpaisseur) {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t) - demiEpaisseur;
}

function melanger(fond, couleur, alpha) {
  return [
    Math.round(fond[0] * (1 - alpha) + couleur[0] * alpha),
    Math.round(fond[1] * (1 - alpha) + couleur[1] * alpha),
    Math.round(fond[2] * (1 - alpha) + couleur[2] * alpha),
  ];
}

// ———————————————————————————————————————————————————————————————
// Dessin de l'icône
// ———————————————————————————————————————————————————————————————

/**
 * @param {number} taille      côté en pixels
 * @param {boolean} maskable   true = fond carré plein et motif réduit à 72 %,
 *                             pour survivre au rognage circulaire des lanceurs Android
 */
function dessiner(taille, maskable) {
  const pixels = new Uint8Array(taille * taille * 4);
  const SOUS = 4; // échantillons par axe
  const total = SOUS * SOUS;
  const pas = 1 / (taille * SOUS);

  // Le motif est centré puis mis à l'échelle : réduit pour un masque, pleine page sinon.
  const echelle = maskable ? 0.72 : 0.92;
  const versMotif = (valeur) => (valeur - 0.5) / echelle + 0.5;

  for (let py = 0; py < taille; py += 1) {
    for (let px = 0; px < taille; px += 1) {
      // Accumulation en prémultiplié : la couleur n'est pondérée que par les
      // échantillons réellement couverts, sinon les bords virent au noir.
      let sommeR = 0;
      let sommeV = 0;
      let sommeB = 0;
      let sommeAlpha = 0;

      for (let sy = 0; sy < SOUS; sy += 1) {
        for (let sx = 0; sx < SOUS; sx += 1) {
          const x = (px * SOUS + sx + 0.5) * pas;
          const y = (py * SOUS + sy + 0.5) * pas;

          // 1. Fond : dégradé vertical, bords arrondis. En maskable, le fond est
          //    carré et plein, puisque le système applique lui-même la découpe.
          const dansFond =
            maskable || distanceRectangleArrondi(x, y, 0.5, 0.5, 0.5, 0.5, 0.225) <= 0;
          if (!dansFond) continue;

          let couleur = melanger(BLEU_HAUT, BLEU_BAS, y);

          const mx = versMotif(x);
          const my = versMotif(y);

          // 2. Le document blanc.
          if (distanceRectangleArrondi(mx, my, 0.5, 0.48, 0.25, 0.31, 0.055) <= 0) {
            couleur = melanger(couleur, BLANC, 1);
          }

          // 3. Deux lignes de texte suggérées.
          const ligne1 = distanceRectangleArrondi(mx, my, 0.5, 0.3, 0.16, 0.017, 0.017);
          const ligne2 = distanceRectangleArrondi(mx, my, 0.46, 0.405, 0.12, 0.017, 0.017);
          if (ligne1 <= 0 || ligne2 <= 0) couleur = melanger(couleur, BLEU_GLYPHE, 1);

          // 4. Le trait de validation, qui évoque le bon de commande mieux qu'un texte.
          const cocheA = distanceSegment(mx, my, 0.37, 0.575, 0.455, 0.66, 0.02);
          const cocheB = distanceSegment(mx, my, 0.455, 0.66, 0.655, 0.475, 0.02);
          if (cocheA <= 0 || cocheB <= 0) couleur = melanger(couleur, BLEU_GLYPHE, 1);

          sommeR += couleur[0];
          sommeV += couleur[1];
          sommeB += couleur[2];
          sommeAlpha += 1;
        }
      }

      const decalage = (py * taille + px) * 4;
      if (sommeAlpha === 0) continue;

      // Dé-prémultiplication : on revient à une couleur pleine, l'opacité portant
      // seule la couverture du bord.
      pixels[decalage] = Math.round(sommeR / sommeAlpha);
      pixels[decalage + 1] = Math.round(sommeV / sommeAlpha);
      pixels[decalage + 2] = Math.round(sommeB / sommeAlpha);
      pixels[decalage + 3] = Math.round((sommeAlpha / total) * 255);
    }
  }

  return pixels;
}

// ———————————————————————————————————————————————————————————————
// Favicon SVG — même dessin, décrit vectoriellement
// ———————————————————————————————————————————————————————————————

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="vtc-bons">
  <title>vtc-bons</title>
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#1e40af"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14.4" fill="url(#fond)"/>
  <rect x="16" y="10.9" width="32" height="39.7" rx="3.5" fill="#ffffff"/>
  <rect x="21.8" y="18.1" width="20.5" height="2.2" rx="1.1" fill="#1d4ed8"/>
  <rect x="21.8" y="24.8" width="15.4" height="2.2" rx="1.1" fill="#1d4ed8"/>
  <path d="M23.7 36.8 L29.1 42.2 L42 29.4" fill="none" stroke="#1d4ed8" stroke-width="2.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// ———————————————————————————————————————————————————————————————
// Exécution
// ———————————————————————————————————————————————————————————————

mkdirSync(DOSSIER_ICONES, { recursive: true });

const cibles = [
  { fichier: 'icon-192.png', taille: 192, maskable: false },
  { fichier: 'icon-512.png', taille: 512, maskable: false },
  { fichier: 'icon-maskable-512.png', taille: 512, maskable: true },
  { fichier: 'apple-touch-icon-180.png', taille: 180, maskable: true },
];

for (const { fichier, taille, maskable } of cibles) {
  const png = encoderPng(dessiner(taille, maskable), taille, taille);
  writeFileSync(join(DOSSIER_ICONES, fichier), png);
  console.log(`${fichier} — ${taille}×${taille} — ${png.length} octets`);
}

writeFileSync(join(RACINE, 'public', 'favicon.svg'), FAVICON_SVG);
console.log('favicon.svg écrit');
