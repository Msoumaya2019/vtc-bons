#!/usr/bin/env python3
"""
Déclare, dans le projet Android généré, le schéma d'adresse « vtcbons » et le raccourci
d'écran d'accueil qui l'emprunte.

Pourquoi ce script existe
-------------------------
`android/` n'est pas versionné : il est recréé par `npx cap add android` à chaque
compilation, et sur la CI c'est à chaque exécution. Toute déclaration écrite à la main dans
ce dossier disparaît donc au premier `cap add`. Les déclarations durables vivent dans
`native/android/`, et ce script les recopie dans le projet généré.

Pourquoi Python et non Node
---------------------------
Les trois opérations sont des manipulations de XML : insérer un fragment à un endroit
précis, recopier un document, puis relire les trois pour vérifier qu'ils sont bien formés.
La bibliothèque standard de Python fait les trois sans rien installer. L'étape des
permissions de localisation, dans le même flux de travail, valide déjà le manifeste par
`python3` pour la même raison.

Ce que ce script relie, et que rien d'autre ne relie
----------------------------------------------------
`android:targetPackage` et `android:targetClass` du raccourci sont écrits en dur dans
`native/android/raccourcis.xml`, alors que l'identifiant de l'application vient de
`capacitor.config.ts` et se retrouve dans `android/app/build.gradle`. Les désaccorder
produit un raccourci qui n'ouvre RIEN : aucune erreur de compilation, et aucun signe
visible ailleurs que sur le téléphone, devant un client qui attend. Le contrôle croisé est
donc fait ici, sur le `build.gradle` réellement généré.

Usage : python3 scripts/declarer-raccourci-android.py android
"""

import pathlib
import re
import sys
import xml.dom.minidom

RACINE = pathlib.Path(__file__).resolve().parent.parent
FRAGMENTS = RACINE / 'native' / 'android'

# Les ancres sont des lignes ENTIÈRES, indentation comprise : le modèle de Capacitor indente
# `</activity>` de huit espaces. Viser une sous-chaîne toucherait la première occurrence
# venue, y compris un `</activity>` cité dans un commentaire.
ANCRE_ACTIVITE = '        </activity>'
ANCRE_RESSOURCES = '</resources>'


def erreur(message):
    """Sort en erreur.

    `::error::` est reconnu par GitHub sur la sortie standard comme sur la sortie d'erreur,
    et fait apparaître l'annotation dans le résumé de l'exécution — là où elle se voit,
    plutôt qu'au milieu du journal.
    """
    sys.exit(f'::error::{message}')


def lire(chemin):
    """Lit en UTF-8. Le mode par défaut ramène les fins de ligne à « \\n »."""
    with open(chemin, encoding='utf-8') as fichier:
        return fichier.read()


def ecrire(chemin, texte):
    """Écrit en UTF-8 SANS traduire les fins de ligne.

    Le mode « newline='\\n' » n'ajoute aucune traduction : sans lui, Windows écrirait des
    « \\r\\n » dans les fichiers XML du projet généré, et le résultat dépendrait de la
    machine qui exécute le script.
    """
    with open(chemin, 'w', encoding='utf-8', newline='\n') as fichier:
        fichier.write(texte)


def fragment_natif(nom):
    """Le chemin d'un fragment versionné, après avoir vérifié qu'il existe.

    Sans ce contrôle, un fragment absent produirait un `FileNotFoundError` au milieu du
    script, dont le message anglais ne dit ni ce qui manque ni pourquoi. Or c'est le cas
    d'un dépôt incomplet, où l'étape doit s'arrêter net et le dire.
    """
    chemin = FRAGMENTS / nom
    if not chemin.is_file():
        erreur(f'fragment {chemin} introuvable : le dépôt est incomplet.')
    return chemin


def inserer(chemin, ancre, fragment, marqueurs, deja_present):
    """Insère le contenu de `fragment` juste avant la ligne `ancre`, qui doit être UNIQUE.

    Une substitution qui ne correspond à rien réussit quand même : l'insertion serait
    simplement absente, et l'application privée du raccourci sans que rien ne le signale.
    D'où le comptage de l'ancre AVANT d'écrire, et la vérification des marqueurs APRÈS.

    `deja_present` rend l'insertion rejouable : lancé deux fois sur le même dossier, le
    script ne pose pas un second intent-filter. L'invariant reste le même dans les deux
    cas — après cette fonction, les marqueurs sont là.
    """
    texte = lire(chemin)

    if deja_present in texte:
        print(f'{chemin.name} : « {deja_present} » déjà présent, insertion laissée telle quelle.')
        return

    lignes = texte.split('\n')
    positions = [rang for rang, ligne in enumerate(lignes) if ligne == ancre]
    if len(positions) != 1:
        erreur(
            f'{chemin} : l\'ancre {ancre!r} apparaît {len(positions)} fois, or elle doit '
            f'apparaître exactement une fois. Le modèle de Capacitor a changé : reprendre '
            f'l\'insertion dans native/android/.'
        )

    lignes[positions[0]:positions[0]] = lire(fragment).split('\n')
    texte = '\n'.join(lignes)

    for marqueur in marqueurs:
        if marqueur not in texte:
            erreur(f'{chemin} : « {marqueur} » absent après insertion.')

    ecrire(chemin, texte)
    print(f'{chemin.name} : {" et ".join(marqueurs)} insérés.')


def lire_gradle(gradle):
    """Lit l'`applicationId` et le `namespace` RÉELLEMENT écrits par `cap add`.

    Lire le `build.gradle` généré plutôt que `capacitor.config.ts` : c'est ce fichier que
    Gradle compile, et c'est lui qui décide du nom de paquet installé. Si `cap add` changeait
    un jour sa façon de reporter l'`appId`, c'est ici que cela se verrait.
    """
    contenu = lire(gradle)
    paquet = re.search(r'^\s*applicationId\s+"([^"]+)"', contenu, re.MULTILINE)
    espace = re.search(r'^\s*namespace\s*=\s*"([^"]+)"', contenu, re.MULTILINE)
    if not paquet or not espace:
        erreur(
            f'{gradle} : applicationId ou namespace introuvable. Le modèle de Capacitor a '
            f'changé.'
        )
    return paquet.group(1), espace.group(1)


def cible_du_raccourci(raccourci):
    """Lit le paquet et la classe que le raccourci demande d'ouvrir."""
    intention = xml.dom.minidom.parse(str(raccourci)).getElementsByTagName('intent')[0]
    return intention.getAttribute('android:targetPackage'), intention.getAttribute(
        'android:targetClass'
    )


def valider_xml(chemin):
    try:
        xml.dom.minidom.parse(str(chemin))
    except Exception as defaut:
        erreur(f'{chemin} n\'est plus un XML valide : {defaut}')
    print(f'{chemin.name} : XML valide.')


def main():
    if len(sys.argv) != 2:
        erreur('usage : declarer-raccourci-android.py <dossier android>')

    android = pathlib.Path(sys.argv[1]).resolve()
    principal = android / 'app' / 'src' / 'main'
    manifeste = principal / 'AndroidManifest.xml'
    chaines = principal / 'res' / 'values' / 'strings.xml'
    dossier_xml = principal / 'res' / 'xml'
    raccourci = dossier_xml / 'raccourcis.xml'
    gradle = android / 'app' / 'build.gradle'

    for chemin in (manifeste, chaines, gradle):
        if not chemin.is_file():
            erreur(f'{chemin} introuvable : le projet Android n\'a pas été généré.')

    # 1. L'adresse que l'application reçoit, et la déclaration du raccourci, DANS l'activité.
    inserer(
        manifeste,
        ANCRE_ACTIVITE,
        fragment_natif('activite.xml'),
        ['android:scheme="vtcbons"', 'android.app.shortcuts'],
        deja_present='android:scheme="vtcbons"',
    )

    # 2. Les libellés, qu'un raccourci ne peut désigner que par ressource de chaîne.
    inserer(
        chaines,
        ANCRE_RESSOURCES,
        fragment_natif('chaines.xml'),
        ['raccourci_instantane_court', 'raccourci_instantane_long'],
        deja_present='raccourci_instantane_court',
    )

    # 3. Le raccourci lui-même, recopié tel quel. Il a été validé par `aapt2` à l'édition de
    #    liens — un attribut inconnu y est refusé —, ce qu'aucun contrôle d'ici ne remplace.
    dossier_xml.mkdir(parents=True, exist_ok=True)
    ecrire(raccourci, lire(fragment_natif('raccourcis.xml')))
    print('raccourcis.xml : recopié dans res/xml/.')

    # 4. Le lien entre deux fichiers que rien ne relie.
    paquet, espace = lire_gradle(gradle)
    cible_paquet, cible_classe = cible_du_raccourci(raccourci)

    if cible_paquet != paquet:
        erreur(
            f'raccourcis.xml vise le paquet {cible_paquet!r}, alors que l\'application '
            f'installée s\'appelle {paquet!r}. Le raccourci n\'ouvrirait RIEN. Aligner '
            f'android:targetPackage sur l\'appId de capacitor.config.ts.'
        )

    # Le manifeste déclare « .MainActivity » : le nom pleinement qualifié se compose avec le
    # namespace. Le vérifier plutôt que de le supposer — un modèle renommé produirait un
    # raccourci qui ouvre l'application sans jamais atteindre l'onglet.
    if 'android:name=".MainActivity"' not in lire(manifeste):
        erreur(
            'AndroidManifest.xml ne déclare plus « .MainActivity » : la classe visée par le '
            'raccourci ne peut plus être déduite. Reprendre native/android/raccourcis.xml.'
        )

    classe = f'{espace}.MainActivity'
    if cible_classe != classe:
        erreur(
            f'raccourcis.xml vise la classe {cible_classe!r}, alors que l\'activité '
            f'déclarée par le manifeste est {classe!r}.'
        )

    print(f'Raccourci : {cible_paquet} / {cible_classe} — concordent avec build.gradle.')

    # 5. Les trois documents doivent rester lisibles par le compilateur Android.
    for chemin in (manifeste, chaines, raccourci):
        valider_xml(chemin)

    print('Raccourci d\'écran d\'accueil déclaré.')


if __name__ == '__main__':
    main()
