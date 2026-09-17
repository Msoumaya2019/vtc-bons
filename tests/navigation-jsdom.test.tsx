/**
 * Comportement de jsdom sur lequel repose la navigation des tests.
 *
 * Ce fichier ne teste PAS l'application. Il établit et surveille le comportement de jsdom
 * dont dépend `allerA` dans `app.test.tsx`. Il existe parce que ce comportement n'est pas
 * celui qu'on imagine, et qu'il a réellement produit des échecs déplacés d'une exécution à
 * l'autre — un test différent à chaque fois, chacun montrant l'écran d'une AUTRE route.
 *
 * Les trois faits mesurés ici :
 *
 * 1. Écrire dans `location.hash` met l'adresse à jour TOUT DE SUITE, mais jsdom n'émet
 *    `popstate` que plus tard, depuis un `setTimeout(…, 0)` : `navigateToFragment` appelle
 *    `traverseHistory(entry, { nonBlockingEvents: true })`.
 * 2. Le gestionnaire de react-router relit `window.location` au moment de l'événement. Un
 *    `replaceState` concurrent survenu dans l'intervalle devient donc l'adresse suivie, et
 *    l'adresse demandée n'est JAMAIS observée.
 * 3. Émettre l'événement soi-même, dans la même tâche, referme cette fenêtre.
 *
 * Si jsdom devient synchrone un jour, l'assertion du cas 1 tombe : c'est le signal que la
 * précaution d'`allerA` peut être simplifiée. Ce fichier est donc aussi un rappel de
 * péremption, pas seulement une documentation.
 */
import { describe, expect, it } from 'vitest';

/** Laisse s'écouler les minuteries différées, dont celle qui porte `popstate`. */
const laisserPasserLesMinuteries = () => new Promise((r) => setTimeout(r, 30));

describe('navigation des tests — le comportement de jsdom', () => {
  it('l’adresse change immédiatement, mais popstate est différé', async () => {
    window.location.hash = '#/a';
    const adresseDansLaMemeTache = window.location.hash;

    const vues: string[] = [];
    const noter = () => vues.push(window.location.hash);
    window.addEventListener('popstate', noter);

    window.location.hash = '#/b';
    const pendantLEcriture = [...vues];
    await laisserPasserLesMinuteries();
    window.removeEventListener('popstate', noter);

    expect(adresseDansLaMemeTache).toBe('#/a');
    expect(pendantLEcriture).toEqual([]);
    expect(vues.length).toBeGreaterThan(0);
  });

  it('un remplacement d’adresse concurrent détourne l’adresse observée', async () => {
    const vues: string[] = [];
    const noter = () => vues.push(window.location.hash);
    window.addEventListener('popstate', noter);

    window.location.hash = '#/a';
    await laisserPasserLesMinuteries();

    vues.length = 0;
    window.location.hash = '#/b';
    // Ce que fait la redirection « / » vers « /nouveau » de l'application : un remplacement.
    window.history.replaceState({}, '', '#/c');
    await laisserPasserLesMinuteries();
    window.removeEventListener('popstate', noter);

    expect(vues).toContain('#/c');
    expect(vues).not.toContain('#/b');
  });

  it('un événement émis dans la même tâche tient l’adresse demandée', async () => {
    const vues: string[] = [];
    const noter = () => vues.push(window.location.hash);
    window.addEventListener('popstate', noter);

    window.location.hash = '#/a';
    await laisserPasserLesMinuteries();

    vues.length = 0;
    window.location.hash = '#/b';
    // La précaution d'`allerA` : prévenir le routeur sans lui laisser de fenêtre.
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.history.replaceState({}, '', '#/c');
    await laisserPasserLesMinuteries();
    window.removeEventListener('popstate', noter);

    expect(vues[0]).toBe('#/b');
  });
});
