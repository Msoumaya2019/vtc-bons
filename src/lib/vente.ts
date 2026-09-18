/**
 * Interrupteur de la version payante.
 *
 * `false` : l'application est LIBRE et illimitée. Aucun plafond n'est atteint, le bandeau
 * d'essai ne s'affiche pas, aucune formule n'est proposée. `true` : la version d'essai et
 * la vente reprennent — sans qu'aucune autre ligne ne change.
 *
 * C'est une constante de COMPILATION, et non un réglage. Un interrupteur rangé dans les
 * réglages serait lisible et modifiable par l'utilisateur, donc un contournement du
 * plafond livré avec l'application ; et la sauvegarde étant du JSON lisible, il serait
 * même modifiable sans ouvrir l'application. Ce qui est vendu se décide au moment où l'on
 * construit le binaire, jamais après.
 *
 * Le mécanisme reste ENTIER derrière l'interrupteur : le comptage, la grâce, la
 * vérification de licence, les écrans. C'est ce qui permet de le rallumer d'un mot, et
 * c'est pourquoi ses tests continuent de l'éprouver allumé — voir `tests/quota.test.ts`.
 * Un mécanisme qu'on éteint sans le laisser éprouvé n'est plus un mécanisme, c'est une
 * promesse : on ne découvrirait qu'il est cassé qu'au moment de vendre.
 *
 * `venteActive` reste injectable dans les options d'accès, comme la clé publique et la
 * date de référence. Sans cela, plus aucun test ne pourrait éprouver le plafond, et il
 * faudrait le rallumer pour le vérifier — c'est-à-dire livrer l'essai à tous pour
 * contrôler qu'il fonctionne.
 */
export const VENTE_ACTIVE = false;
