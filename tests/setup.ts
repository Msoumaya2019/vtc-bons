/**
 * Configuration des tests.
 *
 * `fake-indexeddb/auto` fournit une implémentation d'IndexedDB en mémoire : les tests de
 * base de données et de numérotation s'exécutent donc réellement, sans navigateur.
 */

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { Blob as BlobNode, File as FileNode } from 'node:buffer';

/**
 * jsdom 30 expose bien un `Blob` muni de `text()` et `slice()`, mais ce Blob n'est PAS
 * clonable par `structuredClone` : le clonage en renvoie un objet simple, dépourvu de
 * méthodes. Or IndexedDB clone chaque valeur écrite — un PDF stocké puis relu
 * reviendrait donc inutilisable.
 *
 * On lui substitue l'implémentation de Node, qui est clonable et conforme à la
 * spécification. Le comportement testé est ainsi celui des navigateurs réellement
 * ciblés, où stocker un `Blob` dans IndexedDB est une fonctionnalité standard.
 */
globalThis.Blob = BlobNode as unknown as typeof Blob;
globalThis.File = FileNode as unknown as typeof File;
