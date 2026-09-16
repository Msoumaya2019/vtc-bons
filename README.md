# vtc-bons

Bons de commande et factures pour chauffeur VTC.

L'application tourne **entièrement sur le téléphone** : pas de compte, pas de serveur. Elle
fonctionne en mode avion, y compris lors d'un contrôle. Le seul appel extérieur possible est
l'aide à la saisie d'adresse — facultative, et désactivable dans les Réglages.

---

## Ce que fait l'application

**Un bon de commande conforme, en trois minutes.** Vous choisissez un client enregistré,
vous saisissez le trajet et le prix, l'application vérifie que les mentions obligatoires
sont toutes renseignées, puis produit un PDF.

**La facture associée.** Le bon se transforme en facture d'un geste. Les montants sont
calculés par un moteur unique : les deux documents ne peuvent pas diverger. Une facture ne
peut jamais être émise deux fois pour la même course.

**Un mode contrôle.** Un écran plein, en gros caractères, qui présente le justificatif de
réservation d'une seule course, avec les sept mentions réglementaires et les assurances.
C'est l'écran à montrer à un agent.

**Vos clients enregistrés.** Vous saisissez vos coordonnées une fois. Vous enregistrez
deux ou trois clients habituels, et vous n'avez plus à les ressaisir.

**L'onglet Instantané.** Pour vos courses récurrentes, un seul geste suffit : vous appuyez
sur le client, et le bon est émis. Le lieu de prise en charge est **votre position du
moment**, convertie en adresse ; la destination, le prix et le reste viennent du profil que
vous avez renseigné une fois pour toutes sur la fiche du client. Aucun formulaire, aucune
confirmation, aucun calcul à attendre.

Si votre position n'est pas disponible — hors connexion, autorisation refusée — le lieu de
prise en charge enregistré dans le profil est utilisé, et l'application vous le dit. Le bon
est émis dans les deux cas.

**L'adresse assistée.** Vous tapez les premières lettres du lieu de prise en charge : les
propositions s'affichent, comme sur une carte. Un bouton **« Ma position »** remplit
l'adresse de départ sans que vous ayez à la saisir. La distance et la durée du trajet se
calculent alors toutes seules, par la route.

Cette aide est facultative. Désactivée, ou sans connexion, le champ redevient une simple
saisie et la distance se renseigne à la main.

---

## Conformité réglementaire

L'application applique les règles suivantes, qui sont vérifiées par des tests automatisés.

### Le bon de commande est un justificatif de réservation préalable

**Arrêté du 6 août 2025** (JO du 29 août 2025, en vigueur depuis le **29 octobre 2025**),
pris en application de l'**article L. 3120-2 du Code des transports**. Le support papier
comme le support électronique sont admis.

Sept mentions sont obligatoires :

1. Nom ou raison sociale de l'exploitant, et ses coordonnées
2. Numéro d'inscription au registre des VTC (REVTC) — art. L. 3122-3 C. transports
3. Numéro unique d'identification (SIREN) — art. D. 123-235 C. commerce
4. Nom et coordonnées téléphoniques du client
5. Date et heure de la réservation
6. Date et heure de prise en charge souhaitées
7. Lieu de prise en charge indiqué par le client

L'application **refuse d'émettre** un bon s'il manque l'une d'elles. Elle refuse également
un bon dont la réservation serait datée après la prise en charge : un justificatif daté
après la course ne prouve pas qu'il y a eu réservation, il prouve le contraire.

### Le cas du bon instantané

Un bon instantané est daté de l'instant où vous le générez : la réservation et la prise en
charge portent alors la même date et la même heure. C'est accepté — la règle interdit une
réservation *postérieure*, pas une réservation simultanée.

Mais dites-le-vous ainsi : **c'est le justificatif le plus faible que l'application puisse
produire.** Il établit que le bon existait au moment du contrôle, pas que la course avait
été réservée à l'avance. Générez-le donc **avant que le client ne monte**, jamais après la
course — un bon instantané créé à l'arrivée ne prouverait rien du tout.

Quand vous connaissez la course à l'avance, passez par *Nouveau* : la date de réservation y
est distincte, et le justificatif est bien plus solide.

En l'absence de justificatif, l'infraction est une contravention de 5ᵉ classe
(**article R. 3124-11** du Code des transports), passible de 1 500 €, doublée en cas de
récidive. La maraude, elle, est un délit.

### La TVA

- Transport de personnes : **10 %** (taux réduit, **article 279 du CGI**).
- Les services annexes — attente, bagages, frais d'approche, mise à disposition — suivent
  le sort de la prestation principale. Ils sont donc à 10 % également. **Jamais 20 %.**
- Péages et parkings refacturés : intégrés à la base taxable à 10 % par défaut, ou traités
  en **débours** (refacturés à l'identique, hors base) si vous activez l'option.
- **Franchise en base** : aucun montant de TVA, aucun taux affiché, et la mention
  obligatoire « TVA non applicable, article 293 B du CGI ».

La TVA est calculée **par taux sur la base HT**, jamais ligne à ligne : c'est la méthode
qui évite les écarts d'un centime entre le détail et le total.

### La facture

Dix-neuf mentions obligatoires sont vérifiées (numéro chronologique continu, dates
d'émission et de prestation, identités complète du vendeur et de l'acheteur, détail de la
TVA par taux, échéance et conditions de règlement, pénalités de retard et indemnité
forfaitaire de 40 €, assurance professionnelle, coordonnées bancaires…).

**La signature n'est pas exigée sur une facture en France.** Elle ne figure donc pas dans
la liste.

### Facturation électronique

À titre informatif, le calendrier est le suivant :

- **1ᵉʳ septembre 2026** : obligation de pouvoir *recevoir* une facture électronique, pour
  toutes les entreprises assujetties à la TVA.
- **1ᵉʳ septembre 2027** : obligation d'*émettre* au format Factur-X, UBL ou CII, et
  e-reporting pour les TPE et micro-entreprises.

Ces formats ne sont pas implémentés dans cette version.

---

## Où sont vos données

**Sur votre téléphone, et nulle part ailleurs.** Les documents sont stockés dans la base
locale du navigateur (IndexedDB). Aucun compte n'est créé, aucune statistique n'est
collectée, aucun document n'est envoyé où que ce soit.

### La seule exception : l'aide à la saisie d'adresse

Elle mérite d'être dite précisément, parce qu'elle est la seule ligne de ce projet qui
sorte de l'appareil.

- **Ce qui sort** : le texte que vous tapez dans un champ d'adresse, ou vos coordonnées
  lorsque vous appuyez sur « Ma position ». Rien d'autre. Ni les noms de vos clients, ni
  les prix, ni les documents, ni votre identité.
- **Vers qui** : [Photon](https://photon.komoot.io/), pour retrouver une adresse, et
  [OSRM](https://project-osrm.org/), pour calculer une distance routière. Tous deux sont
  ouverts, gratuits, sans compte ni clé d'API, et hébergés en Allemagne par des
  associations (Komoot, FOSSGIS). Ils ne reçoivent aucune donnée identifiante — pas même
  un identifiant de compte, puisqu'il n'y en a pas.
- **Comment l'éteindre** : *Réglages → Aide à la saisie d'adresse*. Une fois désactivée,
  plus rien ne sort du téléphone. La saisie à la main continue de fonctionner exactement
  comme avant, et la distance reste modifiable à la main.

Sans connexion, ces services sont simplement injoignables : l'application ne bloque jamais,
et vous saisissez l'adresse et la distance vous-même.

Conséquence directe, et c'est la chose la plus importante à retenir :

> **Si vous perdez ou réinitialisez votre téléphone sans sauvegarde, vos documents sont
> définitivement perdus.**

Utilisez donc **Réglages → Sauvegarde** régulièrement, et conservez le fichier ailleurs
que sur le téléphone (courriel, disque, cloud personnel). L'application vous rappelle
toutes les deux semaines si la dernière sauvegarde est trop ancienne.

L'export ZIP contient les données **et** tous les PDF déjà émis, tels qu'ils ont été
émis. C'est le format à privilégier.

---

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org/) **22.22.2 ou plus récent** (c'est la version
minimale exigée par jsdom, utilisée par les tests).

```bash
npm ci          # installe les dépendances
npm run dev     # lance l'application sur http://localhost:5173
```

Pour construire la version de production :

```bash
npm run build   # vérifie les types, puis génère dist/
npm run preview # sert dist/ pour vérifier le résultat
```

Le guide pas à pas, sans ligne de commande, se trouve dans **[SETUP.md](SETUP.md)**.

---

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification des types puis build de production |
| `npm run preview` | Sert le dossier `dist/` |
| `npm test` | Tests en continu |
| `npm run test:run` | Tests, une seule fois |
| `npm run lint` | Analyse statique |
| `npm run typecheck` | Vérification des types seule |
| `npm run format` | Mise en forme automatique |
| `npm run icons` | Régénère les icônes de l'application |
| `npm run verifier:binaires` | Vérifie que les binaires natifs de Rollup suivent sa version |
| `npm run cap:android` | Ouvre le projet Android dans Android Studio |
| `npm run cap:ios` | Ouvre le projet iOS dans Xcode |

---

## Ce que les tests vérifient

360 tests, répartis en seize fichiers. Ils ne mesurent pas la quantité de code, mais les
endroits où une erreur coûte cher.

| Fichier | Ce qu'il protège |
| --- | --- |
| `tva.test.ts` | Le calcul HT / TVA / TTC : taux à 10 %, services annexes jamais à 20 %, TVA par taux et non par ligne, franchise, débours, remises réparties au centime près |
| `money.test.ts` | Conversions et arrondis — aucun calcul monétaire en flottant |
| `numbering.test.ts` | Séquence continue, sans trou ni doublon, y compris sous vingt appels simultanés |
| `conformite.test.ts` | Les 7 mentions de l'arrêté, une par une, et le refus d'émettre un bon daté après la course |
| `documentData.test.ts` | Le contenu réellement imprimé sur les PDF, mentions comprises |
| `pdf.test.ts` | Le rendu effectif des PDF : quinze documents réellement produits |
| `factures.test.ts` | Refus de la double facturation, avoirs, statuts, indicateurs |
| `backup.test.ts` | Aller-retour de sauvegarde fidèle, sauvegarde corrompue refusée |
| `geo.test.ts` | L'aide à l'adresse face au réseau : coupé, en panne, réponse illisible — la fonction rend toujours la main. Vérifie aussi l'ordre des coordonnées envoyées à OSRM : inversées, elles ne produisent pas d'erreur mais un point au milieu de l'océan, et une distance absurde |
| `champ-adresse.test.tsx` | Le champ d'adresse : choix d'une proposition, parcours au clavier, et Échap qui referme la liste **sans** fermer la fenêtre qui l'abrite |
| `instantane.test.ts` | Le bon instantané : conversion du prix TTC en HT (sans quoi le client paierait la TVA deux fois), repli sur l'adresse du profil quand la position manque, et surtout l'absence de brouillon laissé derrière un échec |
| `instantane-ecran.test.tsx` | L'onglet Instantané : profil incomplet annoncé **avant** l'appui, génération en un clic, réserve qui reste affichée, et relecture d'une fiche client enregistrée avant cette fonctionnalité |
| `app.test.tsx` | Le démarrage réel de l'application : montage, routage, charte, mode contrôle |
| `format.test.ts`, `validation.test.ts`, `ui.test.tsx` | Dates en heure locale, identifiants administratifs, composants d'interface |

Le test le plus utile est peut-être `app.test.tsx` : c'est le seul capable de détecter une
erreur de câblage — un contexte mal placé, une route oubliée, un écran qui plante au
premier rendu. Ni la vérification des types ni le build ne voient ce genre de défaut.

---

## Structure du projet

```
src/
  types.ts                 Types du domaine — tous les montants sont en centimes entiers
  lib/
    money.ts               Manipulation monétaire (aucun calcul flottant en euros)
    tva.ts                 Moteur HT / TVA / TTC — le cœur fiscal
    db.ts                  Base locale Dexie (IndexedDB)
    numbering.ts           Numérotation atomique, sans trou ni doublon
    mentions.ts            Référentiel unique des mentions réglementaires
    backup.ts              Sauvegarde et restauration
    geo.ts                 Recherche d'adresses et distance routière — le seul appel réseau
    pdf/
      documentData.ts      Contenu imprimé, construit de façon pure et testable
      moteurPdf.tsx        Le moteur de rendu, chargé à la demande
      generate.ts          Entrée du service PDF
  features/
    bons/                  Bons de commande, bon instantané, contrôle de conformité, mode contrôle
    factures/              Factures, avoirs, indicateurs
    clients/               Clients enregistrés, et leur profil de bon instantané
    reglages/              Réglages et sauvegarde
  components/              Interface — dont le champ d'adresse assisté
  tests/                     Tests automatisés
  scripts/                   Génération des icônes
  .github/workflows/         Compilation et publication automatiques
```

Trois principes structurent le code :

- **Tout montant est un entier de centimes.** Aucun calcul monétaire n'est fait en nombre
  flottant d'euros. Les seules opérations flottantes autorisées sont les multiplications
  par un taux, immédiatement suivies d'un arrondi.
- **Les documents émis sont figés.** À l'émission, les coordonnées de l'exploitant et du
  client sont recopiées dans le document. Modifier ses réglages plus tard ne change jamais
  un PDF déjà émis.
- **Le moteur PDF n'est pas chargé au démarrage.** La bibliothèque de mise en page est
  isolée dans son propre morceau et n'est téléchargée qu'au premier document généré ou
  affiché : le démarrage ne pèse que **142 ko compressés** au lieu de 584 ko. Le service
  worker la précache malgré tout, donc elle reste disponible hors connexion.

---

## Distribution

| Cible | Comment |
| --- | --- |
| Navigateur / PWA | GitHub Pages, via le workflow « Publier la version web » |
| Android | `android.yml` produit un APK de test, un APK de production non signé et un App Bundle non signé |
| iOS | `ios-unsigned.yml` produit un IPA non signé, à signer soi-même (eSign, Sideloadly…) |

**Aucun certificat, aucune clé de signature, aucun mot de passe n'est stocké dans ce
dépôt**, qui est public. La signature est faite localement, au moment de l'installation.
Les dossiers `ios/` et `android/` ne sont pas versionnés : ils sont régénérés à chaque
compilation.

**Les autorisations de localisation sont déclarées par la compilation elle-même.** iOS
exige une explication d'usage dans `Info.plist`, faute de quoi il ferme l'application au
lieu d'afficher le dialogue. Android exige deux permissions dans son manifeste — le
manifeste du greffon de géolocalisation est vide, contrairement à celui de Capacitor pour
la permission Internet. Ces deux dossiers étant régénérés à chaque compilation, les
déclarations sont réinjectées par les workflows, qui vérifient ensuite qu'elles ont bien
été écrites : un manifeste incomplet arrête la compilation plutôt que de produire un APK
dont le bouton « Ma position » échouerait silencieusement.

---

## Sécurité et dépendances

Le code livré aux utilisateurs ne dépend que de sept bibliothèques :
`react`, `react-dom`, `react-router-dom`, `dexie`, `fflate`, `@react-pdf/renderer` et
`@capacitor/geolocation`. **Aucune d'elles ne présente de vulnérabilité connue** :

```bash
npm audit --omit=dev   # → found 0 vulnerabilities
```

L'analyse complète, outillage compris, signale trois avis de sévérité *modérée* dans
`uuid`, atteint par `xcode`, lui-même utilisé par la CLI de Capacitor. Cet outil ne sert
qu'à générer le projet Xcode sur une machine de développement ; il ne part jamais dans
l'application et ne traite aucune donnée utilisateur. La correction proposée par npm
imposerait de rétrograder Capacitor, ce qui casserait la compilation iOS : le remède
serait pire que le mal. Ces avis sont donc assumés, et documentés ici plutôt que masqués.

Deux garde-fous sont en place :

- La compilation automatique **échoue** si un fichier de signature (`.keystore`, `.jks`,
  `.p12`, `.mobileprovision`) ou un fichier `.env` est présent dans le dépôt.
- Aucune donnée ne quitte l'appareil, à la seule exception de l'aide à la saisie d'adresse
  décrite plus haut — désactivable, et qui ne transmet que le contenu des champs d'adresse.
  Il n'y a ni serveur, ni compte, ni télémétrie.

### Binaires natifs de Rollup

`package.json` déclare trois dépendances optionnelles qui ne servent pas au code :
`@rollup/rollup-linux-x64-gnu`, `@rollup/rollup-darwin-arm64` et `@rollup/rollup-darwin-x64`.

Ce n'est pas un choix esthétique. npm n'inscrit dans `package-lock.json` que les dépendances
optionnelles correspondant à la plateforme sur laquelle le lock a été produit
([bug npm #4828](https://github.com/npm/cli/issues/4828)). Ce dépôt étant développé sous
Windows, le lock ne contenait que les binaires Windows : `npm ci` fabriquait donc, sur les
exécuteurs Linux et macOS, une installation où Rollup refusait de démarrer. La compilation
échouait sur GitHub, jamais en local — la panne la plus coûteuse à diagnostiquer.

Les déclarer en dépendances optionnelles **directes** force npm à les inscrire toutes, quelle
que soit la plateforme. Corollaire : leurs versions doivent suivre celle de Rollup. La CI le
vérifie (`npm run verifier:binaires`) et échoue avec un message explicite si elles se
désalignent.

Si vous compilez sur une autre plateforme avec `npm ci` et rencontrez
`Cannot find module @rollup/rollup-…`, ajoutez le paquet correspondant — par exemple
`@rollup/rollup-linux-arm64-gnu` sur un Linux ARM — à `optionalDependencies`, à la version
de Rollup, puis relancez `npm install`.

---

## Avertissement

Cette application produit des documents conformes aux textes cités, mais elle ne constitue
ni un conseil juridique ni un conseil fiscal. Les mentions réglementaires évoluent :
vérifiez-les auprès des textes en vigueur ou de votre expert-comptable.

Les seuils et taux sont modifiables dans les Réglages précisément parce qu'ils changent.

---

## Licence

MIT — voir [LICENSE](LICENSE).
