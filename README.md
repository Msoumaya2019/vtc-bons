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

Un raccourci d'écran d'accueil ouvre cet onglet directement, sans traverser l'assistant :
appui long sur l'icône de l'application installée, ou raccourci du navigateur. Voir
« Raccourci d'écran d'accueil », plus bas.

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

**Pour corriger cela, les Réglages permettent d'antédater la réservation** de 5, 10 ou
30 minutes, 1 heure ou 2 heures. La réservation recule d'autant, et la prise en charge
reste à l'heure du geste : le bon porte alors « réservé à 14 h 00, prise en charge à
14 h 30 », qui est la vérité de la plupart des courses et ce que l'agent s'attend à lire.

**Seule la réservation recule**, et c'est délibéré. Reculer les deux dates les laisserait
*égales* : le justificatif serait exactement aussi faible qu'avant, simplement daté plus
tôt — et il annoncerait une prise en charge déjà passée alors que le client est en train de
monter. C'est la séparation des deux dates qui en fait un justificatif de réservation
*préalable*.

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

### Partager un document, et ce que cela écrit sur le téléphone

Sur le téléphone, « Partager » comme « Télécharger » ouvrent la feuille de partage du
système. Ce n'est pas un choix d'interface : une WebView Android ignore l'attribut
`download` d'un lien et n'implémente pas `navigator.share` — il n'existe donc aucun
téléchargement direct possible. La feuille du système propose « Enregistrer dans Fichiers »,
qui est la façon d'enregistrer un document sur Android comme sur iOS.

Pour cela, l'application écrit une copie temporaire du PDF dans **son propre dossier de
cache**, le seul que son fournisseur de fichiers expose au partage sur Android. Aucune
permission n'est demandée, et **rien ne quitte l'appareil tant que vous n'avez pas choisi une
destination dans cette feuille**. Le système vide ce cache de lui-même quand la place manque ;
le document, lui, reste dans la base de l'application.

---

## Version d'essai, licence et abonnement

> **La vente est actuellement ÉTEINTE.** L'application est libre et illimitée : aucun plafond ne
> s'applique, aucun bandeau d'essai ne s'affiche, aucune formule n'est proposée. Le mécanisme
> décrit ci-dessous reste **entier et éprouvé** — c'est ce qui permet de le rallumer d'un mot.
> Pour le remettre en service, repasser `VENTE_ACTIVE` à `true` dans `src/lib/vente.ts` : une
> seule ligne, aucun autre changement. Les deux formules demandent en plus leurs liens de
> paiement, vides par défaut, dans `src/features/premium/offres.ts`.

Ce paragraphe décrit donc l'application **quand la vente est allumée**. Elle s'essaie alors sans
rien créer de plus : les dix premiers bons de commande, les dix premières factures et les dix
premiers clients sont libres. Au-delà, la **création** s'arrête — mais rien n'est jamais supprimé,
et rien de ce qui a déjà été émis ne devient inaccessible.

Ce plafond n'est pas une serrure, et il vaut mieux le savoir avant d'y consacrer du temps :
l'application ne parle à aucun serveur, donc rien ne peut vérifier de l'extérieur qu'un droit a
été payé. C'est une règle de bonne foi, et le contournement le moins cher est d'éditer une
sauvegarde, qui est du JSON lisible.

### Ce qui reste gratuit pour toujours

Le plafond ne porte que sur la création. Consulter les documents, les imprimer en PDF, corriger un
document déjà émis, exporter et sauvegarder restent possibles sans limite, licence ou pas. Ce
n'est pas une faveur commerciale : l'application détient la **seule copie** des factures émises —
le PDF vit dans IndexedDB, pas dans les fichiers du téléphone. Un verrou qui les rendrait
inaccessibles ne dirait pas « vous ne pouvez plus créer », il dirait « vous avez perdu vos
factures ».

### Ce qui est compté, et pourquoi ainsi

- **Un bon portant un numéro**, jamais un brouillon : un brouillon n'a pas de numéro par
  construction, donc un document abandonné ne laisse aucun trou dans la séquence légale.
- **Un bon déjà facturé compte encore** : le statut ne peut pas servir de critère, puisqu'un bon
  facturé quitte le statut « émis » — compter par statut permettrait d'émettre sans fin.
- **Une facture, mais pas un avoir** : un avoir corrige une facture, le compter punirait la
  correction d'une erreur.
- **Un client enregistré, mais pas un client supprimé** : une fiche saisie par erreur ne doit pas
  coûter un rang.

Le total n'est **jamais** lu dans les compteurs (`db.compteurs`) : le réglage de remise à zéro
annuelle y est actif par défaut, et l'essai serait éternel. Les trois plafonds sont comptés
**séparément** — un compteur commun empêcherait de facturer des bons déjà émis, ce qui n'est plus
une limite commerciale mais un problème légal.

### La licence, et la clé qui la crée

Un code de licence est une charge utile signée en **ECDSA P-256**, vérifiée par Web Crypto :
aucune dépendance ajoutée, et rien ne quitte l'appareil. La **clé publique** est publiée dans
`src/lib/licence.ts` ; la **clé privée** vit dans `scripts/cle-licence-privee.jwk.json`, écartée
du dépôt par `.gitignore`.

> **À sauvegarder vous-même, et à ne jamais publier.** La clé privée n'est pas dans ce dépôt, et
> c'est délibéré : elle est le seul secret du projet. Perdue, elle ne se retrouve pas — les
> licences déjà délivrées resteraient valables, mais plus aucune nouvelle ne pourrait être signée.
> De même, engendrer une nouvelle paire invalide toutes les licences déjà délivrées, puisque la
> clé publique embarquée change.

```bash
node scripts/generer-cles-licence.mjs                                  # engendre une paire, si besoin
node scripts/delivrer-licence.mjs --sujet "Nom du client" --formule mensuel
node scripts/delivrer-licence.mjs --sujet "Nom du client" --formule annuel
node scripts/delivrer-licence.mjs --sujet "Poste de développement" --jours 7300 --type developpeur
```

`--formule` lit la durée dans `src/features/premium/offres.ts`, la même que celle annoncée à
l'achat. Recopier « 31 » sur la ligne de commande donnerait, au premier changement de tarif, un an
signé à un abonné mensuel — et rien ne le signalerait avant que le client ne s'en aperçoive.

### L'abonnement, et la grâce de trois jours

Deux formules sont proposées — **3,99 € par mois**, **29,99 € par an** — chacune menant à un lien
de paiement Stripe ouvert dans le navigateur : aucune donnée bancaire ne passe par l'application,
et aucune requête n'est ajoutée. Les prix vivent en centimes dans `src/features/premium/offres.ts`,
et tout ce qui s'affiche en dérive — le prix au mois équivalent comme le pourcentage d'économie.
Un « −37 % » écrit à la main deviendrait faux au premier changement de tarif sans que rien ne le
signale.

Ces valeurs sont **cuites dans le binaire** : changer un tarif demande une nouvelle compilation
et, le paquet s'installant à la main, que chaque client réinstalle. Tant que les deux liens de
paiement sont vides, la carte d'achat ne s'affiche pas — un bouton qui ne mène nulle part tombe au
moment précis où le client a sorti sa carte, et passe pour une panne de l'application plutôt que
pour une configuration inachevée.

Un abonnement échu laisse **trois jours** de fonctionnement normal, tous plafonds levés : un
paiement met un à trois jours ouvrés à apparaître, et le jeton qui suit arrive par courriel,
pendant que le chauffeur conduit. Couper le jour où la date passe punirait un client à jour pour un
retard qui ne vient pas de lui. Pendant ces trois jours, le bandeau annonce « Abonnement échu —
N jours pour renouveler » plutôt que des compteurs, qui seraient faux et alarmants.

Le renouvellement est **manuel** : il faut signer un jeton par mois et par client. Au-delà de
quelques dizaines d'abonnés, il faudra automatiser la signature — le point délicat n'est pas
d'encaisser, c'est de signer.

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
| `node scripts/generer-cles-licence.mjs` | Engendre la paire de clés qui signe les licences — à exécuter **une seule fois** |
| `node scripts/delivrer-licence.mjs --sujet "…" --formule mensuel` | Signe un code de licence, dont la durée vient de `offres.ts` |
| `npm run verifier:binaires` | Vérifie que les binaires natifs de Rollup suivent sa version |
| `npm run verifier:raccourci` | Vérifie le raccourci d'écran d'accueil dans le manifeste publié, et l'accord du schéma d'adresse `vtcbons` entre l'application et ses quatre déclarations natives |
| `npm run verifier:flux` | Analyse les quatre flux de travail de `.github/workflows/` : chaque script `run` est passé à `bash -n`, et les déclarations sont confrontées à ce que le dépôt contient réellement. Il existe parce qu'une étape qui ne s'exécute que sur un exécuteur distant ne se voit pas en local |
| `npm run cap:android` | Ouvre le projet Android dans Android Studio |
| `npm run cap:ios` | Ouvre le projet iOS dans Xcode |

---

## Ce que les tests vérifient

516 tests, répartis en vingt-huit fichiers. Ils ne mesurent pas la quantité de code, mais les
endroits où une erreur coûte cher.

| Fichier | Ce qu'il protège |
| --- | --- |
| `tva.test.ts` | Le calcul HT / TVA / TTC : taux à 10 %, services annexes jamais à 20 %, TVA par taux et non par ligne, franchise, débours, remises réparties au centime près |
| `money.test.ts` | Conversions et arrondis — aucun calcul monétaire en flottant |
| `numbering.test.ts` | Séquence continue, sans trou ni doublon, y compris sous vingt appels simultanés |
| `conformite.test.ts` | Les 7 mentions de l'arrêté, une par une, le refus d'émettre un bon daté après la course, l'avertissement sur un bon sans montant, et celui sur l'adresse manquante de l'acheteur — le prix et l'adresse n'étant pas des mentions dont l'exigence est établie dans tous les cas, ils ne peuvent pas bloquer, mais les taire laisserait l'application affirmer une conformité qu'elle n'a pas vérifiée |
| `documentData.test.ts` | Le contenu réellement imprimé sur les PDF, mentions comprises |
| `pdf.test.ts` | Le rendu effectif des PDF : quinze documents réellement produits |
| `factures.test.ts` | Refus de la double facturation, refus d'émettre une facture non conforme **avant** toute écriture et toute numérotation, avoirs toujours possibles même sur une facture fautive, statuts, indicateurs |
| `backup.test.ts` | Aller-retour de sauvegarde fidèle, sauvegarde corrompue refusée, et survie du profil de bon instantané — le perdre ferait retomber le chauffeur sur la saisie complète sans le lui dire |
| `geo.test.ts` | L'aide à l'adresse face au réseau : coupé, en panne, réponse illisible — la fonction rend toujours la main. Vérifie aussi l'ordre des coordonnées envoyées à OSRM : inversées, elles ne produisent pas d'erreur mais un point au milieu de l'océan, et une distance absurde |
| `champ-adresse.test.tsx` | Le champ d'adresse : choix d'une proposition, parcours au clavier, et Échap qui referme la liste **sans** fermer la fenêtre qui l'abrite |
| `antedatation.test.ts` | Le réglage qui recule l'heure de réservation du bon instantané. Ce qu'il protège vraiment, c'est la **lecture** du réglage : une sauvegarde restaurée ne passe pas par la fusion des valeurs par défaut, et un réglage absent multiplié par 60 000 vaut `NaN`. Le bon partirait alors daté « NaN-NaN-NaN » — et il **passerait** le contrôle de conformité, qui vérifie que les dates sont renseignées et ordonnées, jamais qu'elles sont des dates |
| `instantane.test.ts` | Le bon instantané : conversion du prix TTC en HT (sans quoi le client paierait la TVA deux fois), repli sur l'adresse du profil quand la position manque, refus d'un profil sans prix (un bon à 0 € est légalement valable — le contrôle de conformité ne peut donc pas l'attraper), et surtout l'absence de brouillon laissé derrière un échec. Vérifie aussi que l'antédatation recule la **réservation seule** : reculer les deux dates les laisserait égales, et le justificatif serait aussi faible qu'avant, simplement daté plus tôt. Le passage de minuit est éprouvé, parce que reculer l'heure sans reculer le jour donnerait un justificatif daté d'un jour trop tard — et que l'horodatage de création, lui, doit rester à l'heure réelle |
| `instantane-ecran.test.tsx` | L'onglet Instantané : profil incomplet annoncé **avant** l'appui, génération en un clic, réserve qui reste affichée, et relecture d'une fiche client enregistrée avant cette fonctionnalité |
| `lienProfond.test.ts` | La traduction d'une adresse `vtcbons://…` vers un onglet — et surtout ses **refus** : un autre schéma, une cible inconnue, une adresse illisible ou absente ne doivent ouvrir **rien**. Un repli sur l'assistant de création ouvrirait le mauvais écran, sans le dire, au moment précis où le chauffeur croit tenir son bon instantané |
| `adresse-instantane.test.tsx` | L'adresse à recopier dans un raccourci, et son bouton de copie — le seul contrôle que le chauffeur touche vraiment ici. Ce qu'il protège tient en une phrase : une copie qui échoue **en silence** lui ferait coller du vide dans l'application Raccourcis, et le raccourci n'ouvrirait rien sans qu'il sache pourquoi. D'où deux chemins éprouvés, et pas seulement écrits : `navigator.clipboard`, absent d'un contexte non sécurisé — c'est le cas sur iPhone, où l'application est servie depuis `capacitor://localhost` — et le repli par sélection, obsolète mais seul à fonctionner dans une WebView. Vérifie aussi que l'adresse du site est **absolue** : un raccourci système ne résout pas `#/instantane`, qui ne désigne quelque chose qu'à l'intérieur d'une page ouverte |
| `app.test.tsx` | Le démarrage réel de l'application : montage, routage, charte, mode contrôle, et le repère de version des Réglages — sans lui, un essai sur le téléphone ne dit pas quelle version a été essayée. Vérifie aussi la saisie des montants : un champ qui réécrit sa valeur à chaque frappe se réécrit sous le doigt, le curseur repart à la fin et un chiffre tapé après la virgule ne change rien — invisible au clavier d'un ordinateur, systématique sur un téléphone. Vérifie enfin l'ouverture **directe** sur un onglet, sans passer par la racine : c'est tout ce que sait faire un raccourci d'écran d'accueil, et la route « * » ramènerait sinon vers l'assistant de création sans le moindre message. Et la réception d'un lien profond : au démarrage, quand l'application est déjà ouverte — et **jamais** dans un navigateur, où aucun lien n'arrive. Vérifie encore l'adresse d'accès direct à l'onglet Instantané : celle du site dans un navigateur, et le lien profond `vtcbons://instantane` dans l'application installée — masquer ce bloc en natif, au motif que l'adresse du site n'y résoudrait nulle part, laissait le raccourci iOS impossible à renseigner. Vérifie enfin que le réglage d'antédatation s'enregistre réellement, en le relisant **depuis la base** |
| `fichiers.test.ts` | Le partage et le téléchargement des PDF et des sauvegardes. Ce fichier existe parce que les deux boutons ne faisaient **rien** sur l'APK, sans le moindre message : toute la stratégie reposait sur `navigator.share` et sur l'attribut `download` d'une ancre, deux mécanismes absents d'une WebView Android — `navigator.share` y est explicitement non implémenté, alors qu'il fonctionne dans celle d'iOS, qui suit Safari. Le test qui manquait place donc le code dans les conditions d'une WebView Android, **sans** `navigator.share`, et exige que les greffons natifs prennent le relais. Vérifie aussi la **fidélité des octets** : un base64 mal formé enverrait un PDF corrompu chez le client, et c'est la seule chose que le chauffeur ne peut pas vérifier avant d'envoyer. Vérifie enfin que le découpage en tranches n'est pas décoratif — un document de 300 000 octets passe, là où `String.fromCharCode(...octets)` déborde la pile d'appels, c'est-à-dire précisément sur les PDF qui comptent |
| `documents-ecran.test.tsx` | L'écran « Documents du chauffeur », où le chauffeur ne lisait que l'**initiale** de chaque libellé sur Android : « P » pour « Permis de conduire catégorie B en cours de validité ». Mesuré dans un moteur réel, le libellé ne disposait plus que de 23 px sur 360, soit quatre caractères sur cinquante et un. Ce test garde la **cause** — le libellé doit pouvoir revenir à la ligne, et la rangée qui le porte doit pouvoir renvoyer le badge dessous — et non l'effet : jsdom ne calcule aucune mise en page, où une mesure de largeur serait verte quoi qu'il arrive. Vérifie aussi que les actions, déplacées sur une seconde rangée, restent nommées pour un lecteur d'écran : sans quoi le remède aurait échangé un défaut de lisibilité contre une perte de fonction |
| `quota.test.ts`, `licence.test.ts`, `offres.test.ts`, `premium-ecran.test.tsx`, `bandeau-licence.test.tsx`, `vente-eteinte.test.tsx` | La version d'essai, la licence qui la lève, et ce qui est vendu. **La vente est éteinte dans l'application livrée**, si bien que les fichiers qui éprouvent le plafond la rallument explicitement, et que `vente-eteinte.test.tsx` éprouve à l'inverse l'état réellement livré : aucun plafond, aucun bandeau, aucune garde — et la page de licence toujours en place, quoique plus atteignable par l'interface. C'est ce partage qui rend le rallumage sûr : le mécanisme reste prouvé pendant qu'il dort, et le jour où on le réveille, seul le fichier qui décrit l'état éteint doit être revu — sciemment. Ce qui est compté — et surtout ce qui ne l'est pas — y est fixé une règle à la fois : un brouillon n'a pas de numéro, un bon **facturé** quitte le statut « émis » (compter par statut permettrait d'émettre sans fin), un avoir corrige une facture (le compter punirait la correction d'une erreur), un client supprimé ne coûte rien. Le total n'est jamais lu dans les compteurs, dont la remise à zéro annuelle est active par défaut. Côté licence, ce qui est éprouvé est l'**ordre** des contrôles — la signature avant la lecture de la charge, l'expiration après — et les refus : une licence absente, illisible, expirée ou signée par une autre clé ne doit **rien** ouvrir, et un jeton refusé ne doit **rien** laisser dans les réglages, sinon le prochain lancement le relirait et le chauffeur croirait avoir débloqué. Une paire de clés est engendrée sur place, jamais celle du dépôt : la clé privée est absente de tout clone. La **grâce** de trois jours après échéance y est mesurée jour par jour, bornes comprises — et un test vérifie que l'écran et le service **s'accordent**, parce que deux lectures d'une même règle finissent toujours par diverger : le pire des cas serait un panneau de refus affiché devant une création qui fonctionne. Les écrans, eux, sont éprouvés sur ce que la route garde et sur ce qu'elle ne garde pas : atteindre un plafond ne doit jamais rendre inaccessible un document déjà émis |
| `format.test.ts`, `validation.test.ts`, `ui.test.tsx` | Dates en heure locale, identifiants administratifs, composants d'interface — dont la saisie d'un montant : champ vide quand le montant est nul, texte conservé tel qu'il est tapé, contenu sélectionné au focus, et saisie illisible gardée à l'écran plutôt que remplacée |
| `navigation-jsdom.test.tsx` | Le comportement de l'environnement de test sur lequel repose la navigation des autres tests — il n'éprouve pas l'application. Il fixe le fait qu'une écriture dans l'adresse est appliquée **tout de suite** mais n'avertit le routeur que **plus tard**, si bien qu'un remplacement d'adresse survenu entre-temps est celui que le routeur suivra. C'est ce qui faisait naviguer un test vers une route et le laissait sur une autre, sans message |

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
    quota.ts               Plafonds de la version d'essai, et ce qui est compté
    vente.ts               L'interrupteur de la vente — éteint, l'application est libre
    licence.ts             Vérification d'une licence signée, et la clé publique embarquée
    acces.ts               Point de passage unique de la décision d'accès, et la grâce
    pdf/
      documentData.ts      Contenu imprimé, construit de façon pure et testable
      moteurPdf.tsx        Le moteur de rendu, chargé à la demande
      generate.ts          Entrée du service PDF
  features/
    bons/                  Bons de commande, bon instantané, contrôle de conformité, mode contrôle
    factures/              Factures, avoirs, indicateurs
    clients/               Clients enregistrés, et leur profil de bon instantané
    premium/               Écrans d'essai et de licence, formules vendues, bandeau d'état
    reglages/              Réglages et sauvegarde
  components/              Interface — dont le champ d'adresse assisté
tests/                     Tests automatisés
scripts/                   Icônes, clés et licences, vérificateurs du dépôt
native/                    Déclarations de raccourci Android et iOS, posées par script
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
  affiché : le démarrage ne pèse que **143 ko compressés** au lieu de 584 ko. Le service
  worker la précache malgré tout, donc elle reste disponible hors connexion.

---

## Distribution

| Cible | Comment |
| --- | --- |
| Navigateur / PWA | GitHub Pages, via le workflow « Publier la version web » |
| Android | `android.yml` produit un APK de test, un APK de production non signé et un App Bundle non signé |
| iOS | `ios-unsigned.yml` produit un IPA non signé, à signer soi-même (eSign, Sideloadly…) |

**Une mise à jour ne se voit pas toute seule.** Un onglet déjà ouvert, comme une
application déjà installée, continuent d'exécuter l'ancien code : le service worker
remplace bien le cache, mais la page en cours garde le JavaScript qu'elle a chargé au
démarrage. Un défaut déjà corrigé a été signalé une seconde fois pour cette raison — le
chauffeur testait une version antérieure sans que rien ne le lui dise.

Les Réglages affichent donc, tout en bas, la version réellement exécutée, sous la forme
« Version du 16/09/2026 (5019bdd) ». C'est le commit qui est gravé dans le bundle à la
compilation, et non la date de compilation : deux constructions du même code restent ainsi
identiques, ce qui permet de comparer le bundle publié avec une construction locale. En
cas de doute sur ce qui est réellement installé, c'est cette ligne qu'il faut lire.

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

### Raccourci d'écran d'accueil

L'application sait ouvrir **directement l'onglet Instantané** à partir d'une adresse
`vtcbons://instantane`. Deux mécanismes distincts l'exploitent, selon le support.

| Support | Ce qui fonctionne |
| --- | --- |
| **Application Android installée** (APK) | **Appui long sur l'icône** propose « Bon instantané » |
| **Application iPhone installée** (IPA) | Un raccourci de l'application **Raccourcis**, posé sur l'écran d'accueil |
| Site ajouté à l'écran d'accueil depuis Chrome Android | Appui long sur l'icône : raccourci du manifeste |
| Chrome et Edge de bureau, 96 et suivants | Raccourci proposé dans le menu de l'application |
| **iPhone et iPad, depuis Safari** | **Rien** : Safari ne connaît pas les raccourcis du manifeste |

**Un raccourci n'émet pas le bon.** Il ne peut qu'ouvrir l'application au bon endroit : le
geste sur le client reste à faire. Ce n'est pas une limite de cette application, mais de la
plateforme. Un widget d'écran d'accueil s'exécute dans un autre processus : il n'a accès ni
au JavaScript de l'application, ni à sa base locale, ni à la position, et il ne peut pas
désigner un client. Le bon ne peut donc pas exister sans le geste du chauffeur — et c'est
préférable, puisqu'un numéro est consommé à chaque émission et que la séquence ne doit pas
comporter de trou.

#### Sur l'application installée

Les deux raccourcis natifs reposent sur le même mécanisme : un **lien profond**, c'est-à-dire
une adresse que le système remet à l'application. Le schéma `vtcbons` est déclaré dans
l'`intent-filter` de `AndroidManifest.xml` et dans `CFBundleURLTypes` de `Info.plist` ; le
raccourci Android lui-même dans `res/xml/raccourcis.xml`.

`android/` et `ios/` n'étant pas versionnés, ces déclarations sont reposées à chaque
compilation. Les fragments XML vivent dans `native/android/`, et
`scripts/declarer-raccourci-android.py` les pose, puis relit ce qu'il a écrit. Il confronte
aussi `android:targetPackage` et `android:targetClass` à l'`applicationId` réellement compilé :
les désaccorder produirait un raccourci qui n'ouvre **rien**, sans la moindre erreur de
compilation.

Sur iPhone, il n'existe pas de raccourci d'écran d'accueil au sens d'Android. Vous créez le
vôtre, une fois : application **Raccourcis**, action « Ouvrir des URL », adresse
`vtcbons://instantane`, puis « Ajouter à l'écran d'accueil ». Cette adresse est rappelée dans
les Réglages, avec un bouton pour la copier — sans quoi il faudrait la retenir de mémoire, ce
qui n'arrive jamais deux fois de la même façon.

#### Dans le navigateur

Le manifeste déclare le même raccourci, que Chrome Android et les navigateurs de bureau
proposent dans le menu de l'application. L'adresse à employer pour un raccourci manuel est
affichée tout en bas des Réglages, sous la version : une application ajoutée à l'écran
d'accueil n'affiche aucune barre d'adresse, et le dièse est précisément la partie qu'on ne
peut pas deviner.

Dans les applications natives, l'adresse affichée est l'autre : `vtcbons://instantane`. C'est
nécessaire, parce que l'origine du site n'y résoudrait nulle part — elle désignerait
`https://localhost` ou `capacitor://localhost`, qui ne s'ouvre que de l'intérieur de
l'application, et un raccourci bâti dessus ne s'ouvrirait pas.

Ce bloc était auparavant **masqué** dans les applications natives, au motif que celles-ci ne
lisent pas le manifeste : il n'y aurait donc rien à y proposer. C'était vrai du manifeste, et
faux du lien profond — la déclaration native existait, mais son adresse n'était écrite nulle
part, si bien que le raccourci iPhone, qui se construit à la main dans l'application Raccourcis,
ne pouvait pas être renseigné. Les deux adresses sont donc affichées, chacune dans son contexte,
avec un bouton pour les copier.

#### Ce qui est vérifié, et ce qui ne peut l'être que sur le téléphone

À la compilation : le raccourci du manifeste est relu dans le fichier **réellement publié**
(`npm run verifier:raccourci`), qui refuse une adresse hors de la portée déclarée, une adresse
sans dièse, ou un onglet absent de `src/App.tsx`. Le même contrôle vérifie que le **schéma
d'adresse s'accorde d'un bout à l'autre** : la constante de l'application, le manifeste Android,
le raccourci Android, la déclaration iOS et le script d'insertion. Ce schéma est écrit en clair à
quatre endroits qui ne se voient pas entre eux, et en changer un seul ne casse rien, ne fait
échouer aucun test et ne se voit pas à l'écran — le système ouvrirait l'application, qui
refuserait l'adresse en silence. Les fragments natifs sont par ailleurs validés comme XML et
confrontés à l'identifiant d'application, et la traduction d'une adresse vers un onglet est
couverte par des tests, refus compris.

Sur le téléphone, en revanche, trois choses ne peuvent être constatées que par vous : que le
raccourci apparaît bien à l'appui long, que l'application s'ouvre sur l'onglet Instantané, et
que le geste se fait d'un seul doigt. Aucune compilation ne les remplace.

Sur le téléphone, en revanche, trois choses ne peuvent être constatées que par vous : que le
raccourci apparaît bien à l'appui long, que l'application s'ouvre sur l'onglet Instantané, et
que le geste se fait d'un seul doigt. Aucune compilation ne les remplace.

---

## Sécurité et dépendances

Le code livré aux utilisateurs ne dépend que de huit bibliothèques :
`react`, `react-dom`, `react-router-dom`, `dexie`, `fflate`, `@react-pdf/renderer`,
`@capacitor/geolocation` et `@capacitor/app`. **Aucune d'elles ne présente de vulnérabilité
connue** :

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
