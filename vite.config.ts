import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Identifiant de la compilation, gravé dans le bundle.
 *
 * Il existe parce qu'un défaut DÉJÀ corrigé a été signalé une seconde fois : ni
 * l'application ni son service worker ne disaient quelle version était à l'écran, et
 * l'onglet ouvert continue d'exécuter l'ancien code après une mise à jour. Sans repère
 * affiché, un essai sur le téléphone ne prouve rien — il ne dit pas ce qui a été essayé.
 *
 * On grave le commit et sa date, et non la date de compilation : ces deux valeurs ne
 * changent QUE si le code change. Une date de compilation rendrait deux constructions
 * du même code différentes, ce qui interdirait de comparer le bundle publié avec une
 * construction locale — vérification sur laquelle repose la publication.
 */
function identifiantCompilation(): { commit: string; date: string } {
  try {
    return {
      commit: execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(),
      date: execSync('git log -1 --format=%cs', { encoding: 'utf8' }).trim(),
    };
  } catch {
    // Sans dépôt Git — archive téléchargée, environnement exotique — on ne fait pas
    // échouer la compilation pour une ligne d'information.
    return { commit: 'inconnu', date: '' };
  }
}

const compilation = identifiantCompilation();

// `base: './'` est indispensable : le site est publié sur GitHub Pages, donc dans un
// sous-répertoire (/<depot>/). Les chemins relatifs fonctionnent aussi bien à la racine
// que dans un sous-répertoire, et restent valides dans une WebView Capacitor.
export default defineConfig({
  base: './',

  define: {
    __COMMIT__: JSON.stringify(compilation.commit),
    __DATE_COMMIT__: JSON.stringify(compilation.date),
  },

  build: {
    // Le moteur de rendu PDF (@react-pdf/renderer) est isolé dans son propre morceau et
    // chargé à la demande : voir src/lib/pdf/moteurPdf.tsx. Il pèse à lui seul plus de
    // 500 ko, seuil d'alerte par défaut de Vite, ce qui produirait un avertissement
    // permanent — et un avertissement qu'on apprend à ignorer ne sert plus à rien.
    //
    // Ce qui compte est la taille du morceau initial : le seuil est donc relevé juste
    // au-dessus du morceau PDF, pour qu'une VRAIE dérive du reste de l'application
    // déclenche toujours l'alerte.
    chunkSizeWarningLimit: 1300,
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'vtc-bons — bons de commande et factures',
        short_name: 'vtc-bons',
        description:
          'Bons de commande et factures pour chauffeur VTC. Fonctionne hors connexion, sans compte.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Raccourci d'écran d'accueil : un appui long sur l'icône de l'application
        // installée ouvre directement l'onglet Instantané, au lieu de laisser le
        // chauffeur traverser l'assistant de création. C'est le seul gain de gestes
        // que la plateforme autorise — un raccourci ne peut pas émettre le bon à la
        // place du chauffeur, il ne fait qu'ouvrir l'application au bon endroit.
        //
        // Le dièse est essentiel : l'application utilise un HashRouter, et c'est la
        // seule partie de l'adresse que le serveur ne voit pas. GitHub Pages renvoie
        // donc bien index.html, et c'est l'application qui lit l'onglet demandé.
        //
        // Portée : l'adresse doit rester DANS le périmètre déclaré par `scope`, sinon
        // le navigateur ignore le raccourci sans le dire. Un fragment n'étant pas un
        // chemin, « ./#/instantane » reste dans « ./ ».
        //
        // Réservé à Chrome/Edge sous Android (84+) et au Chrome de bureau (96+).
        // Safari sur iOS ne connaît PAS ce mécanisme : le raccourci n'y apparaîtra
        // pas, et l'adresse directe reste alors le seul moyen. Ne pas s'en étonner.
        shortcuts: [
          {
            name: 'Bon instantané',
            short_name: 'Instantané',
            description:
              'Ouvrir les profils prêts, pour émettre un bon en un seul geste à l’arrivée du client.',
            url: './#/instantane',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Préchargement intégral de l'app shell : l'application doit démarrer en mode avion.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les polices du PDF sont embarquées dans le bundle : aucune ressource distante.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
