import React, { useState } from 'react';
import { DownloadCloud, Smartphone, X, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../i18n/LanguageContext';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar' }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { t, isRTL } = useLanguage();

  // If already running standalone, hide button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      // Show guided instructions popup for iOS or general browsers
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'topbar' && (
        <button
          onClick={handleClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all hover:scale-102 cursor-pointer"
          title={t.installAppTitle}
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span>{t.installApp}</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          onClick={handleClick}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-900/30 transition-all cursor-pointer mt-2"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-sky-300" />
            <span>{t.installPwaSidebar}</span>
          </div>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">PWA</span>
        </button>
      )}

      {/* Guided Modal for iOS / Browser Instructions */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-slate-800 ${isRTL ? 'text-right' : 'text-left'} space-y-4 animate-in fade-in zoom-in-95`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>{t.installGuideTitle}</span>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.installGuideDesc}
            </p>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 font-bold">
                  1
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  <span>{t.installStep1}</span>
                  <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400 inline" />
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 font-bold">
                  2
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  <PlusSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 inline" />
                  <span>{t.installStep2}</span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 font-bold">
                  3
                </span>
                <span>{t.installStep3}</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {t.gotItBtn}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
