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
 * Différence importante entre les deux contextes :
 *  - dans un navigateur (PWA), le téléchargement par ancre fonctionne et la Web Share API
 *    permet d'envoyer le PDF vers Fichiers, Mail ou Messages ;
 *  - dans une WebView native, l'attribut `download` d'une ancre est ignoré par le moteur
 *    de rendu. Le partage natif reste disponible, et l'utilisateur peut enregistrer le
 *    document depuis la feuille de partage du système.
 *
 * Le repli reste donc toujours le partage, puis l'ouverture du PDF dans la visionneuse.
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

/** Indique si le partage de fichiers est disponible sur cet appareil. */
export function partageFichierDisponible(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}
