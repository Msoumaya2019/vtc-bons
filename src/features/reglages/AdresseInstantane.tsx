/**
 * ADRESSE À RECOPIER POUR OUVRIR L'ONGLET INSTANTANÉ DEPUIS L'EXTÉRIEUR.
 *
 * Un raccourci d'écran d'accueil ne peut pas ÉMETTRE un bon : il tourne dans un autre
 * processus, sans accès aux données ni au code de l'application. Tout ce qu'il sait
 * faire, c'est l'ouvrir à un endroit donné — encore faut-il lui donner l'adresse, et le
 * chauffeur ne peut pas la deviner. Une application installée n'affiche aucune barre
 * d'adresse, et le dièse est justement la partie qui ne se déduit pas.
 *
 * DEUX ADRESSES, PARCE QUE DEUX MONDES. Dans le navigateur, l'adresse est celle du site
 * suivie de « #/instantane » : c'est celle du manifeste, et celle qu'un raccourci système
 * peut viser. Dans l'application installée, l'origine n'est plus celle du site mais celle
 * de la fenêtre interne — « https://localhost » sur Android, « capacitor://localhost »
 * sur iOS — et la même adresse n'y résoudrait nulle part. C'est le lien profond
 * « vtcbons://instantane » qui prend le relais.
 *
 * CE BLOC ÉTAIT MASQUÉ DANS L'APPLICATION NATIVE, au motif qu'il n'y avait rien à y
 * proposer. C'était vrai du manifeste, et faux du lien profond : la déclaration native
 * existait déjà de son côté, mais son adresse n'était écrite nulle part dans
 * l'application — si bien que le raccourci iOS, qui se construit à la main dans
 * l'application Raccourcis, ne pouvait pas être renseigné. Une fonctionnalité qu'on ne
 * peut pas renseigner est une fonctionnalité absente.
 */

import { useEffect, useRef, useState } from 'react';
import { Bouton } from '../../components/ui/Bouton';
import { IconeCheck, IconeCopier } from '../../components/icons';
import { ADRESSE_INSTANTANE } from '../../lib/lienProfond';
import { estApplicationNative } from '../../lib/native';

/**
 * Écrit dans le presse-papiers, et dit si elle a réussi.
 *
 * Deux chemins, et le second n'est pas décoratif : `navigator.clipboard` n'existe que
 * dans un contexte sécurisé, ce que n'est pas « capacitor://localhost » sur iOS. Le
 * bouton serait donc inerte sur le téléphone, c'est-à-dire exactement là où il sert.
 * Le repli par sélection est l'ancienne méthode, obsolète mais toujours la seule à
 * fonctionner dans une WebView.
 */
async function copierDansPressePapiers(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // Permission refusée, contexte non sécurisé : on tente le repli plutôt que d'échouer.
  }

  try {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.top = '0';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(zone);
    return ok;
  } catch {
    return false;
  }
}

export function AdresseInstantane() {
  const natif = estApplicationNative();
  const adresse = natif ? ADRESSE_INSTANTANE : adresseDuSite();
  const [etat, setEtat] = useState<'repos' | 'copiee' | 'echec'>('repos');
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  const copier = async () => {
    const ok = await copierDansPressePapiers(adresse);
    setEtat(ok ? 'copiee' : 'echec');
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEtat('repos'), 3000);
  };

  return (
    <div className="pt-2">
      <p className="texte-muet">
        {natif
          ? 'Adresse à recopier dans un raccourci d’écran d’accueil'
          : 'Adresse directe de l’onglet Instantané'}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <code
          className="texte-muet select-all break-all rounded-md bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800"
          data-testid="adresse-raccourci"
        >
          {adresse}
        </code>
        <Bouton
          petit
          onClick={() => void copier()}
          icone={etat === 'copiee' ? <IconeCheck className="h-4 w-4" /> : <IconeCopier className="h-4 w-4" />}
          data-testid="copier-adresse"
        >
          {etat === 'copiee' ? 'Copiée' : 'Copier'}
        </Bouton>
      </div>

      {etat === 'echec' ? (
        <p className="texte-muet mt-2">
          La copie n’a pas fonctionné. Maintenez le doigt sur l’adresse pour la sélectionner,
          puis choisissez « Copier ».
        </p>
      ) : null}

      <p className="texte-muet mt-2">
        {natif
          ? 'Sur iPhone, ouvrez l’application Raccourcis, créez un raccourci avec l’action « Ouvrir des URL », et collez cette adresse. Sur Android, un appui long sur l’icône de l’application propose déjà « Bon instantané ».'
          : 'Sur iPhone, cette adresse est le seul recours : Safari ne connaît pas les raccourcis déclarés dans le manifeste. Ajoutez-la à l’écran d’accueil depuis le menu de partage.'}
      </p>
    </div>
  );
}

/**
 * L'adresse de l'onglet, telle qu'elle s'écrit dans un navigateur.
 *
 * Construite à partir de l'adresse réelle de la page, et non écrite en dur :
 * l'application est publiée dans un sous-répertoire (`/vtc-bons/`), qui changerait si le
 * dépôt était renommé. Seul l'onglet est fixe — et c'est aussi la seule partie que le
 * serveur ne voit pas, puisqu'elle suit le dièse.
 */
function adresseDuSite(): string {
  return `${window.location.origin}${window.location.pathname}#/instantane`;
}
