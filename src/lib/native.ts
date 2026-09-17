export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/**
 * Détection de l'enveloppe native Capacitor.
 *
 * Ce que cette détection commande : le CHOIX DU MÉCANISME de partage et de téléchargement
 * (`./fichiers`). Les deux contextes n'ont pas les mêmes moyens, et les confondre a coûté
 * cher — les deux boutons étaient inertes sur l'APK :
 *
 *  - dans un navigateur, le téléchargement par ancre fonctionne, et la Web Share API permet
 *    d'envoyer le PDF vers Fichiers, Mail ou Messages ;
 *  - dans une WebView, l'attribut `download` d'une ancre est ignoré, et la Web Share API
 *    n'existe pas du tout sur Android (browser-compat-data : `webview_android: false`).
 *    Le partage doit donc y passer par les greffons natifs.
 *
 * iOS est le cas trompeur : sa WebView suit Safari, si bien que `navigator.share` y
 * fonctionne. Un défaut peut donc n'apparaître que sur Android, et se croire absent.
 */
export function estApplicationNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function plateforme(): string {
  if (typeof window === 'undefined') return 'web';
  try {
    return window.Capacitor?.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
}
