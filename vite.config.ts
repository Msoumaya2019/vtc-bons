import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` est indispensable : le site est publié sur GitHub Pages, donc dans un
// sous-répertoire (/<depot>/). Les chemins relatifs fonctionnent aussi bien à la racine
// que dans un sous-répertoire, et restent valides dans une WebView Capacitor.
export default defineConfig({
  base: './',

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
