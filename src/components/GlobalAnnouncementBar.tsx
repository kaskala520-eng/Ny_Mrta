import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Megaphone,
  X,
} from 'lucide-react';
import { AnnouncementSeverity, GlobalAnnouncement } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

const DISMISSED_STORAGE_KEY = 'metany_dismissed_announcements';
export const LOCAL_ANNOUNCEMENTS_KEY = 'metany_local_announcements';
export const LOCAL_ANNOUNCEMENTS_EVENT = 'metany:announcements-updated';

function readDismissedKeys(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readActiveLocalAnnouncement(): GlobalAnnouncement | null {
  try {
    const raw = localStorage.getItem(LOCAL_ANNOUNCEMENTS_KEY);
    if (!raw) return null;
    const list: GlobalAnnouncement[] = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const now = Date.now();
    const active = list.find((item) => {
      if (!item || !item.isActive) return false;
      if (item.expiresAt) {
        const exp = Date.parse(item.expiresAt);
        if (!Number.isNaN(exp) && exp <= now) return false;
      }
      return true;
    });
    return active || null;
  } catch {
    return null;
  }
}

function getAnnouncementVersionKey(announcement: GlobalAnnouncement): string {
  return `${announcement.id}:${announcement.updatedAt}`;
}

export interface GlobalAnnouncementBarProps {
  previewAnnouncement?: GlobalAnnouncement | null;
  onDismissPreview?: () => void;
}

const SEVERITY_CONFIG: Record<
  AnnouncementSeverity,
  {
    container: string;
    iconWrap: string;
    button: string;
    dismissBtn: string;
    Icon: React.ComponentType<{ className?: string }>;
    labelAr: string;
    labelEn: string;
  }
> = {
  info: {
    container:
      'bg-sky-50 dark:bg-slate-900 text-slate-900 dark:text-sky-100 border-b border-sky-200 dark:border-sky-800/80',
    iconWrap: 'text-sky-700 dark:text-sky-400',
    button:
      'bg-sky-700 hover:bg-sky-800 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950',
    dismissBtn:
      'text-slate-600 hover:text-slate-900 hover:bg-sky-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800',
    Icon: Megaphone,
    labelAr: 'إعلان',
    labelEn: 'Notice',
  },
  success: {
    container:
      'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100 border-b border-emerald-200 dark:border-emerald-800/80',
    iconWrap: 'text-emerald-700 dark:text-emerald-400',
    button:
      'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950',
    dismissBtn:
      'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:text-white dark:hover:bg-emerald-900/70',
    Icon: CheckCircle2,
    labelAr: 'تحديث',
    labelEn: 'Update',
  },
  warning: {
    container:
      'bg-amber-50 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100 border-b border-amber-200 dark:border-amber-800/80',
    iconWrap: 'text-amber-700 dark:text-amber-400',
    button:
      'bg-amber-700 hover:bg-amber-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950',
    dismissBtn:
      'text-amber-800 hover:text-amber-950 hover:bg-amber-100 dark:text-amber-200 dark:hover:text-white dark:hover:bg-amber-900/70',
    Icon: AlertTriangle,
    labelAr: 'تنبيه',
    labelEn: 'Notice',
  },
  urgent: {
    container:
      'bg-rose-50 dark:bg-rose-950/95 text-rose-950 dark:text-rose-100 border-b border-rose-200 dark:border-rose-800/80',
    iconWrap: 'text-rose-700 dark:text-rose-400',
    button:
      'bg-rose-700 hover:bg-rose-800 dark:bg-rose-500 dark:hover:bg-rose-400 text-white dark:text-slate-950',
    dismissBtn:
      'text-rose-800 hover:text-rose-950 hover:bg-rose-100 dark:text-rose-200 dark:hover:text-white dark:hover:bg-rose-900/70',
    Icon: AlertOctagon,
    labelAr: 'عاجل',
    labelEn: 'Important',
  },
};

export const GlobalAnnouncementBar: React.FC<GlobalAnnouncementBarProps> = ({
  previewAnnouncement,
  onDismissPreview,
}) => {
  const { isRTL } = useLanguage();
  const isPreview = previewAnnouncement !== undefined;
  const [liveAnnouncement, setLiveAnnouncement] = useState<GlobalAnnouncement | null>(() =>
    isPreview ? null : readActiveLocalAnnouncement()
  );
  const [dismissedKeys, setDismissedKeys] = useState<string[]>(() => readDismissedKeys());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (isPreview) return;

    const refresh = () => {
      setLiveAnnouncement(readActiveLocalAnnouncement());
      setDismissedKeys(readDismissedKeys());
      setNowMs(Date.now());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === DISMISSED_STORAGE_KEY || e.key === LOCAL_ANNOUNCEMENTS_KEY) {
        refresh();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_ANNOUNCEMENTS_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_ANNOUNCEMENTS_EVENT, refresh);
    };
  }, [isPreview]);

  const activeAnnouncement = isPreview ? previewAnnouncement : liveAnnouncement;

  useEffect(() => {
    if (isPreview || !activeAnnouncement?.expiresAt) return;
    const expMs = Date.parse(activeAnnouncement.expiresAt);
    if (Number.isNaN(expMs)) return;
    const delay = expMs - Date.now();
    if (delay <= 0) {
      setNowMs(Date.now());
      return;
    }
    const timer = setTimeout(() => setNowMs(Date.now()), Math.min(delay + 100, 2147483647));
    return () => clearTimeout(timer);
  }, [isPreview, activeAnnouncement]);

  const isVisible = useMemo(() => {
    if (!activeAnnouncement || !activeAnnouncement.isActive) return false;
    if (!isPreview && activeAnnouncement.expiresAt) {
      const expMs = Date.parse(activeAnnouncement.expiresAt);
      if (!Number.isNaN(expMs) && expMs <= nowMs) return false;
    }
    if (!isPreview) {
      const versionKey = getAnnouncementVersionKey(activeAnnouncement);
      if (dismissedKeys.includes(versionKey)) return false;
    }
    return true;
  }, [activeAnnouncement, dismissedKeys, isPreview, nowMs]);

  if (!isVisible || !activeAnnouncement) return null;

  const style = SEVERITY_CONFIG[activeAnnouncement.severity] || SEVERITY_CONFIG.info;
  const Icon = style.Icon;

  const handleDismiss = () => {
    if (isPreview) {
      onDismissPreview?.();
      return;
    }
    const versionKey = getAnnouncementVersionKey(activeAnnouncement);
    const next = Array.from(new Set([...dismissedKeys, versionKey])).slice(-40);
    setDismissedKeys(next);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={isPreview ? 'announcement-preview-bar' : 'global-announcement-bar'}
      className={`${style.container} px-4 md:px-8 py-2 transition-colors duration-200`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Icon className={`w-4 h-4 shrink-0 ${style.iconWrap}`} aria-hidden="true" />
          <div className="text-xs sm:text-sm leading-snug min-w-0 flex-1">
            <span className="font-bold whitespace-nowrap">
              {activeAnnouncement.title?.trim() || (isRTL ? style.labelAr : style.labelEn)}
            </span>
            <span className="mx-2 opacity-40" aria-hidden="true">
              ·
            </span>
            <span className="font-medium break-words">{activeAnnouncement.message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeAnnouncement.actionLabel && activeAnnouncement.actionUrl && (
            <a
              href={activeAnnouncement.actionUrl}
              target={activeAnnouncement.actionUrl.startsWith('/') ? undefined : '_blank'}
              rel={activeAnnouncement.actionUrl.startsWith('/') ? undefined : 'noopener noreferrer'}
              className={`${style.button} inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`}
            >
              <span>{activeAnnouncement.actionLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            data-testid={isPreview ? 'dismiss-preview-announcement' : 'dismiss-global-announcement'}
            aria-label={isRTL ? 'إغلاق الإشعار العام' : 'Dismiss announcement'}
            title={isRTL ? 'إغلاق الإشعار' : 'Dismiss'}
            className={`${style.dismissBtn} w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
