import React, { useState, useEffect } from 'react';
import { WifiOff, FolderOpen } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useLanguage } from '../i18n/LanguageContext';

interface OfflineBannerProps {
  onOpenMyFiles: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenMyFiles }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className={`bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 ${isRTL ? 'text-right' : 'text-left'} z-50 sticky top-0 animate-in slide-in-from-top duration-200`}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4 text-white animate-pulse" />
        </div>
        <span className="text-xs sm:text-sm font-bold">
          {t.offlineBannerText}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMyFiles}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 shadow-xs transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
          <span>{t.offlineSavedFilesBtn}</span>
        </button>

        <PWAInstallButton variant="topbar" />
      </div>
    </div>
  );
};
