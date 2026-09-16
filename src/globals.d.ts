/**
 * Déclarations des valeurs gravées dans le bundle à la compilation.
 *
 * Elles sont remplacées littéralement par Vite (`define`, dans `vite.config.ts`), d'où
 * l'absence de toute importation ici. Le commentaire qui les définit là-bas explique
 * pourquoi c'est le commit et sa date, et non la date de compilation, qui sont gravés.
 */

/** Commit court de la compilation, ou « inconnu » hors dépôt Git. */
declare const __COMMIT__: string;

/** Date du commit, au format AAAA-MM-JJ. Vide hors dépôt Git. */
declare const __DATE_COMMIT__: string;
