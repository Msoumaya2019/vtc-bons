/**
 * Déclaration de types pour `formules-licence.mjs`.
 *
 * Le module est en JavaScript parce qu'il s'exécute sous Node sans transpileur ; les tests,
 * eux, sont en TypeScript et contrôlés par `tsc`. Cette déclaration est ce qui permet de
 * l'importer sans activer `allowJs` — donc sans faire entrer d'un coup tout le JavaScript
 * du dépôt dans le contrôle de types.
 *
 * Elle ne décrit QUE la signature. Le comportement est éprouvé pour de vrai :
 * `tests/offres.test.ts` confronte la lecture au fichier réel, et vérifie qu'une source
 * sans formule fait bien lever plutôt que de rendre un objet vide.
 */
export declare const SOURCE_FORMULES: string;
export declare const FORMULES_CONNUES: readonly string[];
export declare function lireFormules(chemin?: string): Record<string, number>;
