# vtc-bons

Bons de commande et factures pour chauffeur VTC.

L'application tourne **entièrement sur le téléphone** : pas de compte, pas de serveur, pas
de connexion Internet. Elle fonctionne en mode avion, y compris lors d'un contrôle.

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
locale du navigateur (IndexedDB). Aucune donnée n'est envoyée à un serveur, aucun compte
n'est créé, aucune statistique n'est collectée.

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
| `npm run cap:android` | Ouvre le projet Android dans Android Studio |
| `npm run cap:ios` | Ouvre le projet iOS dans Xcode |

---

## Ce que les tests vérifient

288 tests, répartis en douze fichiers. Ils ne mesurent pas la quantité de code, mais les
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
    pdf/
      documentData.ts      Contenu imprimé, construit de façon pure et testable
      moteurPdf.tsx        Le moteur de rendu, chargé à la demande
      generate.ts          Entrée du service PDF
  features/
    bons/                  Bons de commande, contrôle de conformité, mode contrôle
    factures/              Factures, avoirs, indicateurs
    clients/               Clients enregistrés
    reglages/              Réglages et sauvegarde
  components/              Interface
tests/                     Tests automatisés
scripts/                   Génération des icônes
.github/workflows/         Compilation et publication automatiques
```

Deux principes structurent le code :

- **Tout montant est un entier de centimes.** Aucun calcul monétaire n'est fait en nombre
  flottant d'euros. Les seules opérations flottantes autorisées sont les multiplications
  par un taux, immédiatement suivies d'un arrondi.
- **Les documents émis sont figés.** À l'émission, les coordonnées de l'exploitant et du
  client sont recopiées dans le document. Modifier ses réglages plus tard ne change jamais
  un PDF déjà émis.
- **Le moteur PDF n'est pas chargé au démarrage.** La bibliothèque de mise en page est
  isolée dans son propre morceau et n'est téléchargée qu'au premier document généré ou
  affiché : le démarrage ne pèse que **133 ko compressés** au lieu de 575 ko. Le service
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

---

## Sécurité et dépendances

Le code livré aux utilisateurs ne dépend que de six bibliothèques :
`react`, `react-dom`, `react-router-dom`, `dexie`, `fflate` et `@react-pdf/renderer`.
**Aucune d'elles ne présente de vulnérabilité connue** :

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
- Aucune donnée ne quitte l'appareil : il n'y a ni serveur, ni compte, ni télémétrie, donc
  ni fuite possible côté serveur.

---

## Avertissement

Cette application produit des documents conformes aux textes cités, mais elle ne constitue
ni un conseil juridique ni un conseil fiscal. Les mentions réglementaires évoluent :
vérifiez-les auprès des textes en vigueur ou de votre expert-comptable.

Les seuils et taux sont modifiables dans les Réglages précisément parce qu'ils changent.

---

## Licence

MIT — voir [LICENSE](LICENSE).
