import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  QrCode, 
  Terminal, 
  CheckCircle2, 
  Copy, 
  ShieldCheck, 
  Info, 
  Cpu, 
  FolderGit2,
  FileCheck,
  Package,
  HardDrive,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ApkDownloadModalProps {
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'APK' | 'PWA' | 'LOCAL' | 'GITHUB' | 'GUIDE'>('APK');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pwaInstallFeedback, setPwaInstallFeedback] = useState<string | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://tsrtransport.bf';

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallPwaClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setPwaInstallFeedback("Application installée avec succès sur votre appareil !");
      }
      setDeferredPrompt(null);
    } else {
      setPwaInstallFeedback(
        "Pour installer directement sur Android : ouvrez le menu de Chrome (les 3 points en haut à droite) puis sélectionnez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'. Ou téléchargez directement le fichier APK ci-dessus."
      );
    }
  };

  const handleDownloadApkClick = () => {
    setDownloadTriggered(true);
    const link = document.createElement('a');
    link.href = '/downloads/tsr-transport-v1.0.apk';
    link.download = 'tsr-transport-v1.0.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadTriggered(false), 5000);
  };

  const handleDownloadSourceClick = () => {
    const link = document.createElement('a');
    link.href = '/downloads/tsr-transport-android-source.zip';
    link.download = 'tsr-transport-android-source.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const bashScript = `#!/usr/bin/env bash
# ==============================================================================
# Script de Compilation & Génération APK TSR Transport (Burkina Faso)
# ==============================================================================

set -e
echo "🚀 [1/3] Compilation des assets web..."
npm run build

echo "📲 [2/3] Synchronisation Capacitor Android..."
npx cap sync android

echo "⚙️  [3/3] Génération du binaire APK..."
npm run build:apk

echo ""
echo "✅ APK disponible dans public/downloads/tsr-transport-v1.0.apk"
`;

  return (
    <div className="space-y-5 text-slate-100 max-h-[82vh] overflow-y-auto pr-1">
      {/* Bannière principale de téléchargement */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-amber-950 border border-emerald-500/40 rounded-2xl p-5 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#008751] to-[#00a865] border-2 border-[#fcd116] flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
              TSR
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-white">TSR Transport Android (APK)</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#fcd116] text-black">
                  v1.0.0 Production
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Prêt au téléchargement
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Application officielle pour Voyageurs, Guichets & Agents Contrôleurs (Burkina Faso)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Bouton de Téléchargement Direct APK */}
            <a
              href="/downloads/tsr-transport-v1.0.apk"
              download="tsr-transport-v1.0.apk"
              onClick={() => setDownloadTriggered(true)}
              className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-[#008751] hover:bg-[#007043] active:scale-95 text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer border border-[#fcd116]/40"
            >
              <Download className="w-4 h-4 text-[#fcd116]" />
              <span>Télécharger l'APK (448 Ko)</span>
            </a>

            {/* Bouton Code Source Zip */}
            <button
              onClick={handleDownloadSourceClick}
              className="px-3 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Télécharger le code source du projet Android"
            >
              <Package className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Source .zip</span>
            </button>
          </div>
        </div>

        {downloadTriggered && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Le téléchargement du fichier <strong>tsr-transport-v1.0.apk</strong> a débuté ! Vérifiez le dossier Téléchargements de votre appareil.
            </span>
          </div>
        )}
      </div>

      {/* Barre de navigation entre les modes */}
      <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('APK')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'APK'
              ? 'bg-[#008751] text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#fcd116]" />
          <span>Fichier APK Direct</span>
        </button>

        <button
          onClick={() => setActiveTab('PWA')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'PWA'
              ? 'bg-[#008751] text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Installation Web (PWA)</span>
        </button>

        <button
          onClick={() => setActiveTab('LOCAL')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'LOCAL'
              ? 'bg-[#008751] text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Compiler / Gradle CLI</span>
        </button>

        <button
          onClick={() => setActiveTab('GITHUB')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'GITHUB'
              ? 'bg-[#008751] text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>CI/CD Automatisé</span>
        </button>

        <button
          onClick={() => setActiveTab('GUIDE')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'GUIDE'
              ? 'bg-[#008751] text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>Guide Déploiement</span>
        </button>
      </div>

      {/* Onglet 1 : FICHIER APK DIRECT (DÉTAILS ET GUIDE D'INSTALLATION ANDROID) */}
      {activeTab === 'APK' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Fiche technique du binaire APK */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                  <FileCheck className="w-4 h-4" />
                  <span>Fichier Binaire Android Disponible</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Package prêt à installer sur smartphones, tablettes et terminaux de contrôle TSR.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/downloads/tsr-transport-v1.0.apk"
                  download="tsr-transport-v1.0.apk"
                  onClick={() => setDownloadTriggered(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4 text-[#fcd116]" />
                  <span>Télécharger .APK</span>
                </a>
              </div>
            </div>

            {/* Caractéristiques techniques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nom du Fichier</span>
                <span className="text-xs font-mono font-bold text-slate-200 truncate block mt-0.5">
                  tsr-transport-v1.0.apk
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Taille</span>
                <span className="text-xs font-mono font-bold text-emerald-400 block mt-0.5">
                  448 Ko (Optimisé)
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Identifiant Android</span>
                <span className="text-xs font-mono font-bold text-[#fcd116] truncate block mt-0.5">
                  bf.tsrtransport.app
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Compatibilité</span>
                <span className="text-xs font-mono font-bold text-slate-200 block mt-0.5">
                  Android 5.0 à 15 (API 21-34+)
                </span>
              </div>
            </div>

            {/* Checksum SHA256 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">Signature & Empreinte SHA-256 :</span>
                <code className="text-[11px] font-mono text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                  4ecbc6856d13fe2fe86228ba6eb5f0959b3c0172...
                </code>
              </div>
              <button
                onClick={() => copyToClipboard('4ecbc6856d13fe2fe86228ba6eb5f0959b3c01727575c5ca36276f1e0f0caa3a', 10)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedIndex === 10 ? 'Copié !' : 'Copier SHA256'}</span>
              </button>
            </div>
          </div>

          {/* Guide d'installation pas à pas sur smartphone Android */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#fcd116]" />
              <span>Comment installer le fichier APK sur votre téléphone Android ?</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="w-6 h-6 rounded-lg bg-[#008751] text-white font-black flex items-center justify-center text-xs">
                  1
                </div>
                <span className="font-bold text-white block">Télécharger l'APK</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Cliquez sur le bouton vert ci-dessus. Le fichier se télécharge directement dans le dossier "Téléchargements".
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="w-6 h-6 rounded-lg bg-[#008751] text-white font-black flex items-center justify-center text-xs">
                  2
                </div>
                <span className="font-bold text-white block">Ouvrir le fichier</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Appuyez sur la notification de fin de téléchargement ou ouvrez le gestionnaire de fichiers de votre téléphone.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="w-6 h-6 rounded-lg bg-[#008751] text-white font-black flex items-center justify-center text-xs">
                  3
                </div>
                <span className="font-bold text-white block">Autoriser l'installation</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Si Android affiche un avertissement, choisissez <em>"Paramètres"</em> puis cochez <em>"Autoriser cette source"</em> (Sources inconnues).
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="w-6 h-6 rounded-lg bg-[#008751] text-white font-black flex items-center justify-center text-xs">
                  4
                </div>
                <span className="font-bold text-white block">Appuyer sur Installer</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Confirmez l'installation. L'icône officielle <strong>TSR Transport</strong> apparaît sur votre écran d'accueil !
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 2 : INSTALLATION DIRECTE PWA (WEBAPK) */}
      {activeTab === 'PWA' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* QR Code */}
            <div className="flex flex-col items-center text-center p-3.5 bg-white rounded-2xl shadow-md">
              <QRCodeSVG 
                value={currentUrl} 
                size={160}
                level="M"
                includeMargin={false}
              />
              <span className="text-[11px] font-bold text-slate-800 mt-2">
                Scanner avec un smartphone
              </span>
            </div>

            {/* Explications */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Installation WebAPK Instantanée</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sans même télécharger le binaire manuellement, vous pouvez installer l'application 
                directement via votre navigateur mobile :
              </p>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Icône native installée sur l'écran d'accueil et le tiroir d'applications</li>
                <li>Lancement plein écran sans barre d'adresse de navigateur</li>
                <li>Accès à la <strong>caméra</strong> pour le scanner QR des agents TSR</li>
                <li>Fonctionnement <strong>hors ligne</strong> pour valider les billets sans connexion</li>
                <li>Mises à jour automatiques et instantanées en temps réel</li>
              </ul>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleInstallPwaClick}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>{isInstalled ? 'Application Déjà Installée' : 'Installer sur cet appareil'}</span>
                </button>
                <button
                  onClick={() => copyToClipboard(currentUrl, 0)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedIndex === 0 ? 'Lien copié !' : 'Copier l\'URL d\'accès'}</span>
                </button>
              </div>

              {pwaInstallFeedback && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                  {pwaInstallFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglet 3 : COMPILATION GRADLE & PROJET ANDROID SOURCE */}
      {activeTab === 'LOCAL' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Cpu className="w-4 h-4" />
                <span>Compiler ou Modifier le Projet Android</span>
              </div>
              <button
                onClick={handleDownloadSourceClick}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Projet Android (.zip)</span>
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Le projet Android Capacitor est déjà prêt et synchronisé dans le répertoire <code>android/</code>. Vous pouvez exécuter la génération locale avec la commande suivante :
            </p>

            {/* Commandes CLI */}
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-semibold text-emerald-400">Commande 1 : Générer l'APK directement (Script automatisé)</span>
                  <button
                    onClick={() => copyToClipboard('npm run build:apk', 1)}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedIndex === 1 ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-2.5 rounded-lg overflow-x-auto">
                  npm run build:apk
                </pre>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-semibold text-emerald-400">Commande 2 : Ouvrir dans Android Studio</span>
                  <button
                    onClick={() => copyToClipboard('npx cap open android', 2)}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedIndex === 2 ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-2.5 rounded-lg overflow-x-auto">
                  npx cap open android
                </pre>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="font-semibold text-emerald-400">Commande 3 : Compiler via Gradle Wrapper</span>
                  <button
                    onClick={() => copyToClipboard('cd android && ./gradlew assembleDebug', 3)}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedIndex === 3 ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
                <pre className="text-xs font-mono text-amber-300 bg-slate-950 p-2.5 rounded-lg overflow-x-auto">
                  cd android && ./gradlew assembleDebug
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 4 : GITHUB ACTIONS CI/CD */}
      {activeTab === 'GITHUB' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <FolderGit2 className="w-4 h-4" />
              <span>Compilation Automatisée dans le Cloud (GitHub Actions)</span>
            </div>

            <p className="text-xs text-slate-300">
              Un workflow CI/CD complet est configuré dans <code>.github/workflows/build-apk.yml</code>.
              Chaque push sur GitHub déclenche la génération automatique de l'APK disponible dans l'onglet <strong>Actions &gt; Artifacts</strong>.
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Workflow CI/CD actif et configuré</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">.github/workflows/build-apk.yml</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Utilise Ubuntu, Java 21 Temurin et Android SDK pour compiler et livrer le package <code>TSR-Transport-debug-apk.zip</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 5 : GUIDE TERRAIN BURKINA FASO */}
      {activeTab === 'GUIDE' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Guide de Déploiement Terrain (Gares & Agents TSR)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <span className="font-bold text-[#fcd116]">1. Autorisation de la Caméra</span>
                <p className="text-slate-400">
                  Pour l'application <strong>Agent Scanner</strong>, autorisez l'accès à l'appareil photo lors du premier scan afin de contrôler instantanément les billets QR Code lors de la montée dans les cars.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <span className="font-bold text-[#fcd116]">2. Mode Hors-Ligne & Zones Blanches</span>
                <p className="text-slate-400">
                  Sur les axes routiers sans réseau 4G (ex: Boromo, Pô, Fada), les manifestes passagers restent sauvegardés localement et synchronisés automatiquement dès le retour du signal.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <span className="font-bold text-[#fcd116]">3. Paiement Mobile Money</span>
                <p className="text-slate-400">
                  Paiements sécurisés par <strong>Orange Money</strong>, <strong>Moov Money</strong>, <strong>Telecel</strong> ou <strong>Wave</strong> intégrés directement dans l'application.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <span className="font-bold text-[#fcd116]">4. Recommandation Matériel</span>
                <p className="text-slate-400">
                  Compatible avec tous les smartphones Android, tablettes de bord et terminaux industriels durcis avec lecteur optique.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pied de page modal */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
        <span className="text-[11px] text-slate-400">
          ID Application : <code className="text-emerald-400 font-mono">bf.tsrtransport.app</code> • Version 1.0.0
        </span>
        <div className="flex items-center gap-2">
          <a
            href="/downloads/tsr-transport-v1.0.apk"
            download="tsr-transport-v1.0.apk"
            className="px-4 py-2 bg-[#008751] hover:bg-[#007043] text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#fcd116]" />
            <span>Télécharger l'APK</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
