import React, { useState, useEffect } from 'react';
import { Crown, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { trackLocalAdEvent } from '../AdPlatformManager';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
  onOpenVIP: () => void;
  adPlatformEnabled?: boolean;
  providerLabel?: string;
  directLinkUrl?: string;
}

export const AdModal: React.FC<AdModalProps> = ({
  isOpen,
  onAdCompleted,
  onOpenVIP,
  adPlatformEnabled = false,
  providerLabel,
  directLinkUrl,
}) => {
  const { isRTL } = useLanguage();
  const [currentAdIndex, setCurrentAdIndex] = useState(1);
  const [timer, setTimer] = useState(3);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentAdIndex(1);
      setTimer(3);
      setCanSkip(false);
      return;
    }

    setTimer(3);
    setCanSkip(false);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, currentAdIndex]);

  if (!isOpen) return null;

  const handleNextAd = () => {
    if (currentAdIndex < 3) {
      setCurrentAdIndex((prev) => prev + 1);
    } else {
      onAdCompleted();
    }
  };

  const adBanners = isRTL
    ? [
        {
          sponsor: 'أكاديمية المعرفة الذكية',
          tagline: 'منصة الدورات الأكاديمية الأولى للطلاب في العراق والوطن العربي',
          cta: 'سجل مجاناً الآن',
          bgColor: 'from-blue-600 via-indigo-600 to-blue-800',
        },
        {
          sponsor: 'سحابة المستندات الآمنة',
          tagline: 'مساحة تخزين سحابية سريعة ومحمية لرسائل الماجستير وأبحاث التخرج',
          cta: 'احصل على 50GB مجاناً',
          bgColor: 'from-emerald-600 via-teal-600 to-emerald-800',
        },
        {
          sponsor: 'مكتبة المصادر والبحوث العالمية',
          tagline: 'تصفح أكثر من 10 ملايين بحث أكاديمي ومصدر موثق للجامعات',
          cta: 'استكشف المصادر',
          bgColor: 'from-amber-600 via-orange-600 to-amber-800',
        },
      ]
    : [
        {
          sponsor: 'Smart Knowledge Academy',
          tagline: 'Leading online academic courses platform for university students',
          cta: 'Join Free Now',
          bgColor: 'from-blue-600 via-indigo-600 to-blue-800',
        },
        {
          sponsor: 'Secure Document Cloud',
          tagline: 'Fast, encrypted cloud storage tailored for theses and graduation research',
          cta: 'Claim 50GB Free',
          bgColor: 'from-emerald-600 via-teal-600 to-emerald-800',
        },
        {
          sponsor: 'Global Research & Citations Library',
          tagline: 'Explore 10M+ peer-reviewed academic papers and university references',
          cta: 'Explore Sources',
          bgColor: 'from-amber-600 via-orange-600 to-amber-800',
        },
      ];

  const currentBanner = adBanners[currentAdIndex - 1];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isRTL ? 'text-right' : 'text-left'} animate-in fade-in zoom-in-95 duration-200 transition-colors`}>
        {/* Header Notice */}
        <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono tabular-nums">
              {adPlatformEnabled && providerLabel
                ? isRTL
                  ? `إعلان ${providerLabel} (${currentAdIndex}/3)`
                  : `${providerLabel} Sponsored (${currentAdIndex}/3)`
                : isRTL
                  ? `إعلان ممول (${currentAdIndex}/3)`
                  : `Sponsored Ad (${currentAdIndex}/3)`}
            </span>
          </div>

          <button
            onClick={onOpenVIP}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-extrabold hover:brightness-110 shadow-xs cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 fill-slate-950" />
            <span>{isRTL ? 'تخطي بالإشتراك VIP' : 'Skip with VIP'}</span>
          </button>
        </div>

        {/* Ad Body */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
              {isRTL
                ? 'شاهد 3 إعلانات للمتابعة مجاناً بدون اشتراك'
                : 'Watch 3 short ads to continue for free'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL
                ? 'أول استخدام كان مجانياً تماماً، كل استخدام لاحق يتطلب مشاهدة 3 إعلانات أو الترقية لـ VIP'
                : 'Your first use was completely free. Each subsequent action requires 3 ads or a VIP plan.'}
            </p>
          </div>

          {/* Ad Progress Bar */}
          <div className="flex items-center justify-center gap-2 my-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded-full transition-all ${
                  step < currentAdIndex
                    ? 'bg-emerald-500'
                    : step === currentAdIndex
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Ad Banner Box */}
          <div className={`p-6 rounded-2xl bg-gradient-to-br ${currentBanner.bgColor} text-white shadow-lg text-center space-y-3 relative overflow-hidden`}>
            <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-[10px] bg-black/40 px-2 py-0.5 rounded text-white/80 font-mono`}>
              {isRTL ? 'إعلان رسمي' : 'Sponsored Ad'}
            </div>

            <div className="w-12 h-12 mx-auto rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>

            <h4 className="text-base font-extrabold">{currentBanner.sponsor}</h4>
            <p className="text-xs text-white/90 leading-relaxed max-w-xs mx-auto">
              {currentBanner.tagline}
            </p>

            {directLinkUrl ? (
              <a
                href={directLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLocalAdEvent('direct_link_click')}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-md hover:bg-slate-100 transition-colors"
              >
                <span>{currentBanner.cta}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={canSkip ? handleNextAd : undefined}
                className="px-5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {currentBanner.cta}
              </button>
            )}
          </div>

          {/* Next Button / Countdown */}
          <div className="pt-2">
            {canSkip ? (
              <button
                onClick={handleNextAd}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {currentAdIndex < 3
                    ? isRTL
                      ? `متابعة إلى الإعلان (${currentAdIndex + 1}/3)`
                      : `Continue to Ad (${currentAdIndex + 1}/3)`
                    : isRTL
                    ? 'اكتملت الإعلانات! تنفيذ العملية الآن'
                    : 'Ads Complete! Run Action Now'}
                </span>
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
                <span>
                  {isRTL
                    ? `يمكنك المتابعة بعد ${timer} ثوانٍ...`
                    : `You can continue in ${timer}s...`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
