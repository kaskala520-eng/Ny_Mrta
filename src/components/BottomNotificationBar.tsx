import React from 'react';
import { Star, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface BottomNotificationBarProps {
  noticeText?: string;
  onOpenPlans: () => void;
}

export const BottomNotificationBar: React.FC<BottomNotificationBarProps> = ({
  noticeText,
  onOpenPlans,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <div 
      onClick={onOpenPlans}
      className="rounded-2xl bg-gradient-to-r from-sky-100/90 via-blue-100/90 to-sky-100/90 dark:from-sky-950/60 dark:via-blue-950/60 dark:to-indigo-950/60 border border-blue-200/80 dark:border-blue-800/60 p-3.5 sm:p-4 my-6 flex items-center justify-between shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group text-start"
    >
      <div className="flex items-center gap-3">
        {/* Star Icon in yellow circle - Matches reference image */}
        <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shrink-0 shadow-xs group-hover:rotate-12 transition-transform">
          <Star className="w-4 h-4 fill-slate-900" />
        </div>

        <p className="text-xs sm:text-sm font-semibold text-blue-950 dark:text-blue-100 leading-relaxed">
          {noticeText || t.bottomNoticeText}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 group-hover:translate-x-1 transition-transform shrink-0">
        <span>{t.viewPlansBtn}</span>
        {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
      </div>
    </div>
  );
};
