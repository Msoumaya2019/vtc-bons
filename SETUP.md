# Installation, pas à pas

Ce guide suppose que vous n'avez jamais utilisé GitHub. Il n'y a aucune ligne de commande
à taper : tout se fait dans le navigateur.

Comptez une heure pour les étapes 1 à 5. Les étapes 6 et 7 ne servent que si vous voulez
installer l'application sur votre téléphone.

---

> **État actuel — les étapes 1 à 5 sont déjà faites.**
>
> - Dépôt : <https://github.com/Msoumaya2019/vtc-bons> (public)
> - Application en ligne : **<https://msoumaya2019.github.io/vtc-bons/>**
> - Les compilations Android et iOS ont été vérifiées de bout en bout : elles produisent
>   bien l'APK de test, l'APK de production non signé, l'App Bundle et l'IPA non signé.
>   Ils se récupèrent dans l'onglet **Actions** du dépôt, en bas de chaque exécution.
>
> Ce guide reste la référence si vous refaites l'installation ailleurs. Pour installer
> l'application sur votre téléphone, allez directement aux **étapes 6 et 7**.

---

## Ce dont vous avez besoin

- Un compte GitHub (gratuit) — <https://github.com/signup>
- Un ordinateur avec un navigateur
- Pour l'iPhone : l'application **eSign** sur le téléphone
- Pour Android : le gestionnaire de fichiers du téléphone

---

## Étape 1 — Créer le dépôt GitHub

1. Connectez-vous à GitHub.
2. En haut à droite, cliquez sur **+**, puis **New repository**.
3. Remplissez :
   - **Repository name** : `vtc-bons`
   - **Description** : `Bons de commande et factures pour chauffeur VTC`
   - **Public** ou **Private** : à votre convenance. Les deux fonctionnent. Le dépôt
     **ne contient aucun secret**.
   - **Ne cochez rien** : ni README, ni .gitignore, ni licence. Ils sont déjà fournis.
4. Cliquez sur **Create repository**.

> **Important** : notez bien le nom d'utilisateur et le nom du dépôt. Votre adresse web
> sera `https://VOTRE-UTILISATEUR.github.io/vtc-bons/`.

---

## Étape 2 — Envoyer les fichiers

Le plus simple, sans rien installer :

1. Sur la page de votre nouveau dépôt, cliquez sur le lien **uploading an existing file**.
2. Ouvrez le dossier `vtc-bons` sur votre ordinateur.
3. **Sélectionnez tout** ce qu'il contient **sauf** :
   - le dossier `node_modules` (s'il existe — il est volumineux et inutile ici)
   - le dossier `dist` (s'il existe)
4. Glissez-déposez dans la page GitHub.

> Le dossier `.github` commence par un point : il peut être masqué par votre système de
> fichiers. Activez l'affichage des fichiers cachés pour être sûr de l'envoyer —
> **c'est lui qui contient la compilation automatique**.

5. En bas de la page, dans **Commit changes**, écrivez `Version initiale`.
6. Cliquez sur **Commit changes**.

---

## Étape 3 — Autoriser les Actions

La compilation se fait sur les serveurs de GitHub, gratuitement pour un dépôt public.

1. Dans votre dépôt, cliquez sur l'onglet **Actions**.
2. Si un message vous propose d'activer les workflows, cliquez sur
   **I understand my workflows, go ahead and enable them**.
3. Cliquez sur **Intégration continue** dans la colonne de gauche, puis sur
   **Run workflow** → **Run workflow**.

Au bout d'une à deux minutes, une coche verte doit apparaître. Si vous voyez une croix
rouge, ouvrez le détail : le message d'erreur est en français et indique le fichier
concerné.

---

## Étape 4 — Publier la version web

1. Dans votre dépôt : **Settings** (en haut) → **Pages** (colonne de gauche).
2. Sous **Source**, choisissez **GitHub Actions**. Ne choisissez pas « Deploy from a
   branch ».
3. Retournez dans l'onglet **Actions**, cliquez sur **Publier la version web** →
   **Run workflow**.
4. Attendez la fin (une à deux minutes), puis ouvrez :

   ```
   https://VOTRE-UTILISATEUR.github.io/vtc-bons/
   ```

L'application s'ouvre dans votre navigateur. Sur téléphone, vous pouvez l'ajouter à
l'écran d'accueil : **Partager** → **Sur l'écran d'accueil** (iPhone) ou **⋮** →
**Ajouter à l'écran d'accueil** (Android). Elle fonctionnera alors hors connexion.

---

## Étape 5 — Première configuration dans l'application

Ouvrez l'onglet **Réglages** et remplissez, dans l'ordre :

1. **Identité** — c'est le plus important. Raison sociale, adresse, téléphone, SIREN,
   **numéro REVTC**. Sans ces informations, l'application refusera d'émettre un bon :
   c'est volontaire, ce sont les mentions exigées en contrôle.
2. **Régime de TVA** — choisissez *Assujetti* (10 %) ou *Franchise en base*. En franchise,
   la mention « TVA non applicable, article 293 B du CGI » sera ajoutée automatiquement.
3. **Assurance** — nom de l'assureur, numéro de contrat, couverture géographique.
   Ces mentions figurent sur la facture.
4. **Coordonnées bancaires** — IBAN et BIC, si vous acceptez les virements.
5. **Numérotation** — les préfixes (`BC`, `FA`, `AV`). Laissez les valeurs par défaut
   sauf raison particulière.
6. **Apparence** — votre logo et votre couleur, si vous en avez.
7. **Aide à la saisie d'adresse** — laissée active par défaut. Elle propose les adresses au
   fil de la frappe, remplit le lieu de prise en charge depuis votre position, et calcule
   la distance et la durée du trajet par la route. C'est la **seule** fonction qui sort du
   téléphone : elle transmet le texte des champs d'adresse à deux services ouverts, Photon
   et OSRM. Si vous préférez que rien ne sorte, décochez-la — la saisie à la main reste
   strictement identique.

Puis ouvrez l'onglet **Clients** et enregistrez au moins votre premier client : **le
numéro de téléphone est obligatoire**, c'est la mention 4 du justificatif.

Faites ensuite **une sauvegarde** tout de suite (Réglages → Sauvegarde), pour vérifier que
le mécanisme fonctionne avant d'avoir des documents à perdre.

---

## Étape 6 — Installer sur Android

1. Dans votre dépôt : onglet **Actions** → **Android — APK et App Bundle** →
   **Run workflow**.
2. Attendez la fin (environ cinq minutes).
3. En bas de la page du workflow, sous **Artifacts**, téléchargez :
   - `android-apk-debug` pour tester tout de suite ;
   - `android-apk-release-non-signe` pour la version à signer vous-même ;
   - `android-aab-non-signe` pour Google Play.
4. Les fichiers arrivent dans une archive `.zip`. Décompressez-la.
5. Transférez l'APK sur votre téléphone (courriel, câble, cloud personnel).
6. Sur le téléphone, ouvrez le fichier et autorisez l'installation depuis cette source
   lorsque Android le demande.

### Signer l'APK de production

L'APK `release` est **non signé** : Android refuse de l'installer tel quel. Deux solutions :

- **eSign** : ouvrez l'APK dans eSign et signez-le avec votre certificat, exactement comme
  pour l'IPA.
- **apksigner** (ligne de commande, sur ordinateur) :

  ```bash
  apksigner sign --ks ma-cle.jks --out vtc-bons-signe.apk app-release-unsigned.apk
  ```

> **Conservez votre fichier de clé et son mot de passe en lieu sûr.** S'ils sont perdus,
> vous ne pourrez plus publier de mise à jour de l'application sur Google Play. Ne les
> mettez **jamais** dans ce dépôt : il est public.

Pour l'App Bundle destiné à Google Play, la signature est gérée par la Play Console
(*Play App Signing*) : déposez le `.aab` tel quel.

---

## Étape 7 — Installer sur iPhone avec eSign

1. Dans votre dépôt : onglet **Actions** → **iOS — IPA non signé** → **Run workflow**.
2. Attendez la fin (environ dix minutes : les machines Apple sont plus lentes).
3. Sous **Artifacts**, téléchargez `ios-ipa-non-signe`, puis décompressez l'archive pour
   obtenir `vtc-bons-non-signe.ipa`.
4. Transférez l'IPA sur votre iPhone.
5. Ouvrez eSign et importez l'IPA.
6. Signez-le avec votre certificat et votre profil de provisionnement, puis installez.

### Ce qu'il faut savoir avant de commencer

- **Votre appareil doit être déclaré dans le profil de provisionnement.** Un certificat
  Apple ne permet d'installer que sur les appareils dont l'identifiant (UDID) y figure.
  C'est la limite d'Apple, pas celle de l'application.
- **Un certificat de développeur gratuit expire au bout de 7 jours.** Il faut alors
  resigner. Un certificat payant (99 $/an) tient un an.
- **L'application ne sera pas installable par quelqu'un d'autre** avec ce procédé : eSign
  installe sur vos appareils, pas sur ceux de vos clients. Pour distribuer largement, il
  faut passer par l'App Store.
- **L'application demandera l'accès à votre position** la première fois que vous appuyez
  sur « Ma position ». Acceptez : refusé, le bouton ne produit rien. L'explication affichée
  par iOS est déclarée automatiquement par la compilation — vous n'avez **rien** à
  configurer dans Xcode, et rien à ajouter à la main dans `Info.plist`.

### Publier sur l'App Store plus tard

Il faudra un compte Apple Developer (99 $/an) et signer avec un certificat de distribution.
Le code de l'application ne change pas. Attention toutefois à la règle 4.2 des règles de
l'App Store : Apple exige qu'une application ait une fonctionnalité suffisante pour être
acceptée. Une application utile à un seul métier passe en général, mais ce n'est jamais
garanti.

---

## Étape 8 — Sauvegarder, et recommencer

**C'est l'étape la plus importante du guide.**

Vos documents vivent uniquement sur votre téléphone. Faites une sauvegarde :

- après chaque journée de travail, ou au minimum chaque semaine ;
- **avant** toute mise à jour de l'application ;
- **avant** de changer de téléphone.

Réglages → Sauvegarde → **Exporter (ZIP)**, puis envoyez le fichier sur vous-même par
courriel ou déposez-le sur un espace personnel. Ce fichier contient vos données **et**
tous vos PDF.

Pour restaurer sur un nouveau téléphone : Réglages → Sauvegarde → **Restaurer**, et
choisissez le fichier ZIP. **Attention : la restauration écrase tout** ce qui se trouve
sur l'appareil. L'application vous demande une confirmation explicite.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « L'application refuse d'émettre le bon » | Une mention obligatoire manque | Le message indique le champ exact. Allez dans Réglages (REVTC, SIREN, téléphone) ou sur la fiche client (téléphone) |
| « Ce bon a déjà été facturé » | Protection anti-double facturation | Utilisez « Dupliquer » pour créer une nouvelle version |
| Le workflow échoue à l'étape « Analyse statique » | Une erreur de code a été introduite | Ouvrez le détail : le fichier et la ligne sont indiqués |
| Rien ne s'affiche sur l'adresse GitHub Pages | Pages n'est pas configuré sur « GitHub Actions » | Reprenez l'étape 4 |
| L'APK refuse de s'installer | Il n'est pas signé | Signez-le (étape 6) |
| L'IPA refuse de s'installer | L'appareil n'est pas dans le profil de provisionnement, ou le certificat a expiré | Vérifiez le profil dans eSign |
| Les documents ont disparu après réinstallation | L'identifiant de l'application a changé, ou le stockage a été purgé | Restaurez la dernière sauvegarde ZIP |
| Le bouton « Ma position » ne fait rien | L'accès à la position a été refusé au premier lancement | Réglages du téléphone → vtc-bons → Position → autoriser « lors de l'utilisation » |
| Aucune adresse n'est proposée pendant la frappe | L'aide est désactivée, ou il n'y a pas de réseau | Vérifiez Réglages → « Aide à la saisie d'adresse ». Sans réseau, écrivez l'adresse à la main : la saisie fonctionne toujours |
| La distance ne se calcule pas | L'adresse a été tapée à la main, sans passer par une proposition | Appuyez sur **Calculer la distance** sous le champ, ou saisissez-la vous-même |
| La compilation échoue à « Déclarer l'usage de la position » | Le modèle de projet de Capacitor a changé | Le message indique la clé ou la permission manquante : la déclaration doit être réinjectée, puisque `ios/` et `android/` sont régénérés |

---

## Avertissements à ne pas oublier

- **Ne changez jamais l'identifiant `fr.vtcbons.app`** (fichier `capacitor.config.ts`)
  après une première installation. C'est lui qui détermine le dossier de vos données :
  le modifier revient à installer une autre application, vide.
- **Ne déposez jamais de fichier de signature** (`.keystore`, `.jks`, `.p12`,
  `.mobileprovision`) **ni de fichier `.env`** dans ce dépôt. Il est public. La
  compilation automatique échoue volontairement si elle en détecte un.
- **Conservez vos factures émises dix ans.** L'application conserve tout, mais elle ne
  remplace pas une sauvegarde : exportez régulièrement l'archive ZIP, qui contient les
  PDF tels qu'ils ont été émis.
