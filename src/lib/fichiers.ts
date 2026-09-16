/**
 * Téléchargement et partage de fichiers.
 * Isolé ici pour être partagé entre les PDF et les sauvegardes.
 */

export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const ancre = document.createElement('a');
  ancre.href = url;
  ancre.download = nomFichier;
  ancre.rel = 'noopener';
  document.body.appendChild(ancre);
  ancre.click();
  document.body.removeChild(ancre);
  // Révocation différée : certains navigateurs ont besoin de l'URL le temps du téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ouvrirBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Partage via la Web Share API quand elle est disponible : sur iOS et Android, c'est le
 * chemin naturel pour enregistrer dans Fichiers ou envoyer par Mail ou Messages.
 * Repli sur le téléchargement, qui reste le seul moyen dans un navigateur de bureau.
 */
export async function partagerBlob(
  blob: Blob,
  nomFichier: string,
  titre: string,
  typeMime = 'application/pdf',
): Promise<'partage' | 'telecharge'> {
  try {
    const fichier = new File([blob], nomFichier, { type: typeMime });
    const donnees: ShareData = { files: [fichier], title: titre };
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(donnees) &&
      typeof navigator.share === 'function'
    ) {
      await navigator.share(donnees);
      return 'partage';
    }
  } catch {
    // Partage annulé par l'utilisateur ou indisponible : on retombe sur le téléchargement.
  }
  telechargerBlob(blob, nomFichier);
  return 'telecharge';
}
