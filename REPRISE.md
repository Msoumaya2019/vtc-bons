# Reprendre le projet

**État au 18 septembre 2026, commit `2f5e926`.** Ce document vieillit : en cas de doute, le code,
le [README](README.md) et l'historique Git font foi.

Il est écrit pour être **collé tel quel dans un assistant** (ChatGPT ou autre) qui n'a rien vu de
ce dépôt. La première lecture utile reste le [README](README.md) — il décrit ce que fait
l'application, la conformité réglementaire et l'installation ; [SETUP.md](SETUP.md) décrit la mise
en place pas à pas. **Ce document ne les recopie pas** : il ajoute ce qu'ils ne disent pas, et qui
se perd si on ne l'écrit pas.

---

## Le projet en une phrase

Une application de **bons de commande et de factures pour un chauffeur VTC** français, qui tourne
entièrement sur le téléphone (PWA + Android + iOS), sans compte ni serveur, en mode avion, y
compris lors d'un contrôle.

Dépôt : <https://github.com/Msoumaya2019/vtc-bons> — public, branche `main`.
Site publié : <https://msoumaya2019.github.io/vtc-bons/>

**Un seul appel réseau existe** : l'aide à la saisie d'adresse (Photon et OSRM), facultative et
désactivable dans les Réglages. Toute donnée sortante nouvelle doit rester derrière ce réglage,
sinon la promesse « aucune donnée ne quitte l'appareil » devient fausse.

## Ce qu'il faut lire avant de toucher au code

Le dépôt n'est pas commenté pour décrire ce que le code fait, mais **pourquoi il le fait**. Les
en-têtes de fichier portent les décisions et les pièges déjà rencontrés. En particulier :

| Fichier | Ce qu'il faut y lire avant d'y toucher |
| --- | --- |
| `src/lib/quota.ts` | Les trois règles de comptage de la version d'essai, et pourquoi un plafond n'est pas une serrure |
| `src/lib/licence.ts` | L'ordre des contrôles : la signature **avant** la lecture de la charge, l'expiration **après** |
| `src/lib/acces.ts` | Le point de passage **unique** de la décision d'accès, et la grâce après échéance |
| `src/lib/tva.ts` | Le moteur fiscal : TVA par taux sur la base HT, jamais ligne à ligne |
| `src/lib/numbering.ts` | La séquence légale : un document supprimé ne libère **jamais** son numéro |
| `src/lib/backup.ts` | La restauration écrit l'archive **telle quelle**, sans fusion avec les valeurs par défaut |
| `src/features/premium/offres.ts` | Les tarifs, cuits dans le binaire, et pourquoi la durée du jeton est distincte de la période facturée |
| `README.md` | Ce que fait l'application, les mentions réglementaires, la distribution |

## Conventions de travail

- **Tout en français** : identifiants, fichiers, commits, commentaires.
- **Les commentaires expliquent *pourquoi*, jamais *quoi*.** Un commentaire qui redit le code est
  du bruit ; un commentaire qui dit ce qui a été essayé et pourquoi ça a échoué vaut de l'or.
- **Montants en centimes entiers.** Aucun calcul monétaire en flottant.
- **Aucune dépendance ajoutée sans nécessité démontrée.** Deux exemples de ce que cela a évité :
  la vérification de licence utilise Web Crypto (déjà dans la WebView), et l'ouverture d'un lien
  de paiement utilise un `<a href>` ordinaire — vérifié dans le code natif de Capacitor installé,
  où `target="_blank"` emprunte un chemin inutile à éprouver.
- **Tout en local, aucun secret dans le dépôt.** La seule exception est la clé **publique** de
  licence, qui est faite pour être publiée.
- **Prouver par la mesure, jamais par la supposition** : lire le paquet installé plutôt que
  supposer son comportement, et **falsifier un contrôle avant de s'y fier** — le casser
  délibérément et constater qu'il rougit, puis restaurer et comparer les empreintes SHA-256.
- **Signaler les risques, pas rassurer.** Si quelque chose n'est pas prouvé, l'écrire.

## Règles de domaine à ne pas défaire

Elles ont toutes coûté une erreur, et plusieurs sont contre-intuitives.

**Comptage de l'essai** — trois plafonds séparés (bons, factures, clients), jamais un compteur
commun : un compteur commun empêcherait de facturer des bons déjà émis, ce qui n'est plus une
limite commerciale mais un problème légal. Est compté **un bon portant un numéro** (jamais un
brouillon : il n'en a pas par construction, donc un document abandonné ne laisse pas de trou dans
la séquence). Le total n'est **jamais** lu dans `db.compteurs`, dont la remise à zéro annuelle est
active par défaut — l'essai serait éternel.

**Ce qui reste gratuit pour toujours** — consulter, imprimer en PDF, corriger un document émis,
exporter et sauvegarder. L'application détient la **seule copie** des factures : `pdfBlob` vit dans
IndexedDB, pas dans les fichiers du téléphone. Un verrou qui les rendrait inaccessibles ne dirait
pas « vous ne pouvez plus créer », il dirait « vous avez perdu vos factures ».

**Le contrôle d'accès passe AVANT toute écriture.** Un refus ne doit consommer aucun numéro et ne
laisser aucun brouillon orphelin, sinon le chauffeur repart avec deux documents.

**Le bon instantané est le justificatif le plus faible possible.** Réservation et prise en charge
portent la même heure ; `antedatationReservationMinutes` recule la **réservation seule** — reculer
les deux les laisserait égales, et le document serait aussi faible qu'avant, simplement daté plus
tôt.

**Profil de bon instantané sur la fiche client**, pas dans les Réglages. Prix saisi en **TTC**,
converti en HT à la génération.

**Un champ ajouté à `Client`** → à compléter dans `normaliserClient()`. **Un champ ajouté à
`Settings`** → à lire **défensivement** : une sauvegarde restaurée peut ne pas le contenir, et
`undefined × 60 000` vaut `NaN`, ce qu'une date invalide (« NaN-NaN-NaN ») **passe** le contrôle de
conformité, qui ne juge pas la forme des dates.

**Un champ de montant non contrôlé** : un champ qui reformate à chaque frappe se réécrit sous le
doigt — invisible au clavier d'un ordinateur, systématique sur un téléphone.

**Barres fixes du bas** : la hauteur de la barre d'onglets est **posée une fois** dans `:root` et
**lue** par ce qui s'y adosse. Un décalage en dur laisse la barre recouvrir ce qu'elle porte.

## Version d'essai, licence et abonnement

C'est la partie la plus récente, et la plus subtile.

- Le plafond d'essai est **10 bons / 10 factures / 10 clients**. Un code de licence signé
  (**ECDSA P-256**, vérifié par Web Crypto) le lève. La **clé publique** est dans
  `src/lib/licence.ts` ; la **clé privée** est dans `scripts/cle-licence-privee.jwk.json`, écartée
  du dépôt. **Elle n'est donc dans aucune sauvegarde GitHub, et c'est voulu : c'est le seul secret
  du projet.** Perdue, plus aucune licence ne peut être signée.
- Deux formules sont vendues : **3,99 € par mois** (jeton de 31 jours) et **29,99 € par an**
  (366 jours), dans `src/features/premium/offres.ts`. **Les deux liens de paiement Stripe sont
  encore vides** : tant qu'ils le sont, la carte d'achat ne s'affiche pas à l'écran — un bouton qui
  ne mène nulle part est pire qu'un bouton absent.
- Un abonnement échu laisse **trois jours** de fonctionnement normal, tous plafonds levés : un
  paiement met un à trois jours ouvrés à apparaître. La grâce est lue par le service **et** par
  l'écran, et un test vérifie qu'ils s'accordent.
- `--formule` de `scripts/delivrer-licence.mjs` lit la durée dans `offres.ts` : ne jamais la
  recopier sur la ligne de commande.

## Ce qui reste à faire

1. **Coller les deux liens de paiement Stripe** dans `src/features/premium/offres.ts` (constantes
   `LIEN_MENSUEL` et `LIEN_ANNUEL`). Rien d'autre à faire : la carte apparaît d'elle-même, et le
   test qui fixe son absence tant que les liens sont vides est dans `tests/premium-ecran.test.tsx`.
2. **Automatiser la signature des renouvellements** — aujourd'hui manuelle, environ une minute par
   client et par mois. Le point délicat n'est pas d'encaisser, c'est de **signer**. Le mécanisme de
   lien profond existe déjà (`src/lib/lienProfond.ts`, `CIBLES`, `src/components/EcouteLienProfond.tsx`)
   et n'attend qu'une cible `licence` : le jeton doit être **vérifié avant d'être enregistré**,
   jamais écrit d'abord.
3. **Les obligations de vente** : conditions générales, droit de rétractation de 14 jours,
   médiateur de la consommation, politique de confidentialité.
4. **La distribution iOS** : un IPA non signé ne s'installe pas chez un client. Il faut un compte
   Apple Developer (TestFlight ou App Store) — et l'App Store impose son propre paiement pour un
   contenu numérique, ce qui réintroduit une commission de 15 à 30 %.
5. **L'activité déclarée** : le SIRET est celui d'un VTC. Vendre un abonnement logiciel suppose que
   cette activité soit couverte — question à poser au guichet unique, pas à un assistant.

Dettes connues, sans urgence : **36 fichiers** ne respectent pas la mise en forme Prettier
(mesuré le 18 septembre 2026 — écarts antérieurs, jamais corrigés en bloc pour ne pas noyer les
diffs) ; le groupe Dependabot `outillage` réunit `typescript` et `@typescript-eslint/*`, liés par
une contrainte de pair, et il est donc rouge par construction à chaque saut majeur.

## Vérifier, toujours dans cet ordre

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build          # renommer dist/ hors du projet AVANT : Vite le vide, ce qui déclenche
                       # le garde-fou de suppression en masse et fait échouer le build
npm run verifier:binaires
npm run verifier:raccourci   # lit dist/manifest.webmanifest : compiler d'abord
npm run verifier:flux
```

Aucune de ces étapes ne doit être sautée avant de considérer une version bonne, et **l'ordre
compte** : `verifier:raccourci` échoue sur un manifeste introuvable si l'on n'a pas compilé.

Ce que ces étapes ne prouvent pas, et qu'il faut dire au lieu de le laisser croire : le rendu réel
sur un téléphone, l'acceptation d'une licence par l'application installée, et le comportement des
gestes natifs. Un flux vert dit que la compilation a fini, **pas** que le binaire contient le
changement — pour cela, ouvrir l'archive et y chercher le sha du commit (`__COMMIT__` est injecté
par `vite.config.ts` et affiché en Réglages).

## Pièges de l'environnement (Windows, Git Bash)

- **`npm` n'est pas dans les `node_modules` du projet.** Il est à côté du Node géré. Utiliser les
  chemins absolus, et `export VAR=… && commande` — jamais `env VAR=… commande`, qui avale la
  sortie (zéro octet, code 0 : un rouge déguisé en vert). **Mesurer la taille d'un journal avant
  de le lire.**
- **`git push` pend** si `credential.helper` ouvre une fenêtre invisible. Le dépôt local est
  configuré avec `!gh auth git-credential`, et `GIT_TERMINAL_PROMPT=0`.
- **`sed` et `grep` ne manipulent pas fiablement le non-ASCII** : passer par Python, et confirmer
  avec Python.
- **Les chemins `/tmp/x`** sont lus comme `C:\tmp\x` par Node et Python ; Git Bash les traduit
  ailleurs.
- **`gh run view --json artifacts` n'existe pas** : utiliser `gh api …/actions/runs/<id>/artifacts`.
  Et `gh workflow run` par **nom** échoue sur les accents et les tirets longs : déclencher par
  l'identifiant numérique.

## Ce qu'il ne faut jamais faire

- **Publier la clé privée de licence**, ni la clé de signature Android, ni aucun secret. Le dépôt
  est public.
- **Changer l'`appId` Capacitor** (`fr.vtcbons.app`) : cela ferait perdre les données locales des
  utilisateurs déjà installés.
- **Livrer `app-release-unsigned.apk`** : aucun bloc de signature, Android le refuse. Livrer
  `app-debug.apk`, et vérifier la présence de la magie `APK Sig Block 42`.
- **Rendre l'accès tolérant hors fournisseur** pour faire passer un test : un fournisseur manquant
  passerait alors inaperçu et le plafond ne serait plus jamais jugé, en silence. Compléter le
  harnais, jamais retirer le contrôle.
- **Écrire un jeton de licence avant de l'avoir vérifié.**
