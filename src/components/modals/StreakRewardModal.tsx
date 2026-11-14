import React, { useEffect } from 'react';
import { X, Crown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../../i18n/LanguageContext';

interface StreakRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StreakRewardModal: React.FC<StreakRewardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-amber-300 dark:border-amber-700/70 overflow-hidden ${isRTL ? 'text-right' : 'text-left'} p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 relative transition-colors`}>
        <button
          onClick={onClose}
          className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center absolute top-4 ${isRTL ? 'left-4' : 'right-4'} transition-colors cursor-pointer`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-4 ring-8 ring-amber-100 dark:ring-amber-900/40 animate-bounce">
            <Crown className="w-10 h-10 fill-slate-950" />
          </div>

          <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-black px-3 py-1 rounded-full mb-2">
            {isRTL ? 'مكافأة الولاء الكبرى 30 يوماً متواصلاً 🔥' : '30-Day Consecutive Loyalty Reward 🔥'}
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">
            {isRTL ? 'مبروك! 🎉' : 'Congratulations! 🎉'}
          </h3>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/50 dark:via-yellow-950/40 dark:to-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold leading-relaxed mb-6">
            {isRTL ? (
              <>
                لأنك استخدمت <strong className="text-blue-700 dark:text-blue-400">Meta.Ny</strong> كل يوم لمدة شهر كامل، حصلت على <strong className="text-amber-700 dark:text-amber-300">أسبوع كامل مجاني بدون إعلانات!</strong> استمتع بجميع المميزات بدون قيود لمدة 7 أيام.
              </>
            ) : (
              <>
                Because you used <strong className="text-blue-700 dark:text-blue-400">Meta.Ny</strong> every day for a full month, you earned a <strong className="text-amber-700 dark:text-amber-300">full free ad-free week!</strong> Enjoy unlimited VIP features for 7 days.
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
          >
            {isRTL ? 'استمتع بمميزات VIP الآن ✨' : 'Enjoy VIP Features Now ✨'}
          </button>
        </div>
      </div>
    </div>
  );
};
