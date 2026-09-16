/**
 * Configuration Capacitor.
 *
 * Capacitor enveloppe l'application web dans un projet natif iOS et Android. Il ne
 * change RIEN au fonctionnement de l'application : le code reste celui du dossier
 * `src/`, et l'application continue de fonctionner dans un navigateur et comme PWA.
 *
 * `appId` est un identifiant DÉFINITIF : il détermine le dossier de données de
 * l'application sur le téléphone. Le modifier après une première installation fait
 * perdre l'accès aux documents déjà enregistrés. Il doit donc être choisi maintenant,
 * une fois pour toutes, et rester identique dans l'App Store et sur Google Play.
 *
 * Les dossiers `ios/` et `android/` ne sont pas versionnés : ils sont régénérés par la
 * CI à chaque compilation (`npx cap add`). Cela évite de maintenir à la main des
 * milliers de lignes de code natif, et supprime tout risque de committer un secret de
 * signature.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.vtcbons.app',
  appName: 'vtc-bons',
  webDir: 'dist',

  // Le fond doit rester clair : l'application ne propose pas de thème sombre forcé.
  backgroundColor: '#ffffff',

  ios: {
    // Les PDF sont ouverts dans une visionneuse intégrée plutôt que téléchargés.
    contentInset: 'always',
  },

  android: {
    // Aucun trafic en clair : l'application n'appelle aucun serveur.
    allowMixedContent: false,
  },

  server: {
    // Les fichiers sont embarqués dans l'application : elle démarre en mode avion.
    androidScheme: 'https',
  },
};

export default config;
