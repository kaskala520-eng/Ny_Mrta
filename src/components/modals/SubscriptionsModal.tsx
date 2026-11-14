import React, { useState } from 'react';
import { X, Crown, Check } from 'lucide-react';
import { User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface SubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpgradeVIP: () => void;
}

export const SubscriptionsModal: React.FC<SubscriptionsModalProps> = ({
  isOpen,
  onClose,
  onUpgradeVIP,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [processing, setProcessing] = useState(false);
  const { t, isRTL } = useLanguage();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onUpgradeVIP();
      onClose();
    }, 1200);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 font-['Cairo',sans-serif]">
                {t.subModalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.subModalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Plan Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly VIP */}
            <div
              onClick={() => setSelectedPlan('monthly')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'monthly'
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 shadow-md ring-2 ring-blue-600/20 dark:ring-blue-500/30'
                  : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{t.subMonthlyTitle}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.subMonthlyDesc}</p>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono mb-4">
                $9.99 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t.subPerMonth}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{isRTL ? 'بدون إعلانات نهائياً (0 إعلانات)' : 'Zero ads across all services'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{isRTL ? 'استخدام غير محدود لجميع الخدمات' : 'Unlimited usage on all tools'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{isRTL ? 'أولوية قصوى بالحل والترجمة' : 'Priority speed for AI & translation'}</span>
                </li>
              </ul>
            </div>

            {/* Annual VIP - Best Value */}
            <div
              onClick={() => setSelectedPlan('yearly')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-gradient-to-b from-amber-50/30 to-white dark:from-amber-950/30 dark:to-slate-900 ${
                selectedPlan === 'yearly'
                  ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20 dark:ring-amber-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className={`absolute -top-3 ${isRTL ? 'left-4' : 'right-4'} bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs`}>
                {t.subBestValue}
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                <span>{t.subYearlyTitle}</span>
                <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.subYearlyDesc}</p>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mb-4">
                $79.99 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t.subPerYear}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{isRTL ? 'استخدام غير محدود وبدون أي إعلانات' : 'Unlimited ad-free access all year'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{isRTL ? 'دعم فني خاص مباشر عبر واتساب' : 'Direct priority WhatsApp support'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{isRTL ? 'توليد بحوث وتقارير أكاديمية حتى 50 صفحة' : 'Generate academic papers up to 50 pages'}</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={processing}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {processing ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Crown className="w-4 h-4 fill-slate-950" />
            )}
            <span>{processing ? t.subActivatingBtn : t.subActivateBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
