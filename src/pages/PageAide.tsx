import { Link } from 'react-router-dom';
import { Bandeau, Carte } from '../components/ui/Carte';
import {
  AVERTISSEMENT_JURIDIQUE,
  DOCUMENTS_CONTROLE,
  MENTIONS_ARRETE_2025,
  MENTIONS_OBLIGATOIRES_FACTURE,
} from '../lib/mentions';

export function PageAide() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Aide et conformité</h1>
        <p className="texte-muet">
          Ce que cette application garantit, et ce qu’elle ne garantit pas.
        </p>
      </header>

      <Bandeau ton="attention" titre="À lire">
        {AVERTISSEMENT_JURIDIQUE}
      </Bandeau>

      <Carte className="space-y-3">
        <h2 className="section-titre">Pourquoi le bon de commande est un document important</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Un chauffeur VTC n’a pas le droit de prendre en charge un client sans réservation
          préalable : c’est ce qui distingue le VTC de la maraude. En cas de contrôle, ce n’est pas
          à l’agent de prouver que vous étiez en attente de clients — c’est à vous de montrer que
          la course était bien réservée. Le bon de commande est ce que vous montrez.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Un document incomplet est donc pire qu’un oubli : il remplit mal la fonction pour
          laquelle vous le présentez. L’application refuse d’émettre un bon s’il manque une mention
          obligatoire.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          L’arrêté prévoit un support <strong>papier ou électronique</strong> : un document
          affiché sur votre téléphone vaut le document imprimé, à condition qu’il porte les sept
          mentions.
        </p>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">
          Les 7 mentions du justificatif de réservation
        </h2>
        <p className="texte-muet">
          Arrêté du 6 août 2025, en vigueur depuis le 29 octobre 2025 — article L. 3120-2 du Code
          des transports.
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {MENTIONS_ARRETE_2025.map((mention) => (
            <li key={mention}>{mention}</li>
          ))}
        </ol>
        <p className="aide-champ">
          Ces mentions sont un minimum, pas un maximum. Y ajouter le prix, la destination ou le nom
          du conducteur est autorisé : c’est l’absence d’une mention exigée qui fait défaut.
        </p>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">TVA applicable au transport de personnes</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Le transport de personnes par VTC relève du taux réduit de <strong>10 %</strong>{' '}
          (article 279 du CGI). Les services annexes — attente supplémentaire, supplément bagages,
          frais d’approche, prise en charge, mise à disposition — suivent le sort de la prestation
          principale : ils sont donc eux aussi à 10 %, et non à 20 %.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Les péages et parkings refacturés sont intégrés à la base taxable par défaut. L’option
          « débours » les exclut de la base, à condition qu’ils soient refacturés à l’identique,
          sans marge.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          En <strong>franchise en base</strong>, aucune TVA n’est facturée et vos documents portent
          la mention « TVA non applicable, article 293 B du CGI ». Aucun numéro de TVA
          intracommunautaire ne doit alors y figurer.
        </p>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Mentions obligatoires d’une facture</h2>
        <p className="texte-muet">
          Code de commerce et Code général des impôts. La signature n’en fait pas partie : elle est
          inutile sur une facture en France.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {MENTIONS_OBLIGATOIRES_FACTURE.map((mention) => (
            <li key={mention}>{mention}</li>
          ))}
        </ul>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Documents à pouvoir présenter en contrôle</h2>
        <p className="texte-muet">
          Liste indicative, à vérifier auprès de l’autorité compétente. Suivez leurs dates
          d’expiration dans{' '}
          <Link to="/reglages" className="lien-accent">
            Réglages
          </Link>
          .
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {DOCUMENTS_CONTROLE.map((document) => (
            <li key={document}>{document}</li>
          ))}
        </ul>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Vos données</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Cette application ne dispose d’aucun serveur. Vos réglages, vos clients, vos bons, vos
          factures et vos PDF restent <strong>sur cet appareil</strong>, dans le stockage local du
          navigateur. Aucune donnée n’est transmise, aucun compte n’est créé, aucune statistique
          n’est collectée, et l’application fonctionne en mode avion.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          La contrepartie est nette : <strong>une sauvegarde régulière est indispensable</strong>.
          Sur iPhone, un site peu utilisé peut voir son stockage purgé par le système. Exportez un
          ZIP depuis les Réglages et conservez-le ailleurs que sur le téléphone.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Les pièces comptables se conservent <strong>10 ans</strong>. L’application ne supprime
          donc jamais automatiquement un bon ou une facture : la suppression les place en
          corbeille, où ils restent restaurables.
        </p>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Facturation électronique : ce qui arrive</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Depuis le 1<sup>er</sup> septembre 2026, toutes les entreprises assujetties à la TVA
          doivent pouvoir <strong>recevoir</strong> des factures électroniques via une plateforme
          agréée. L’obligation d’<strong>émettre</strong> au format structuré (Factur-X, UBL, CII),
          ainsi que la transmission des données de vos ventes aux particuliers, s’appliquent aux
          TPE et micro-entreprises au 1<sup>er</sup> septembre 2027.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Cette application produit des PDF et un export JSON complet de vos données : elle vous
          permettra de basculer plus tard vers une plateforme agréée sans rien perdre. Elle ne
          remplace ni un expert-comptable, ni une plateforme agréée.
        </p>
      </Carte>
    </div>
  );
}
