import React from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface HeroBannerProps {
  user: User | null;
  onOpenVIP: () => void;
  welcomeText?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  user,
  onOpenVIP,
  welcomeText,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d2a6b] via-[#12429e] to-[#1d58c9] text-white p-5 sm:p-7 shadow-xl shadow-blue-900/20 border border-blue-400/20 my-6">
      {/* Decorative ambient glowing auras */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-60 h-60 bg-blue-400/30 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Left Side: EXACT ORIGINAL 3D AI Robot holding glowing digital document */}
        <div className="flex flex-col sm:flex-row items-center gap-5 shrink-0 text-center sm:text-start">
          <div className="relative group shrink-0">
            {/* The exact original robot image from the user's attachment */}
            <div className="relative w-40 h-28 sm:w-56 sm:h-36 md:w-64 md:h-40 rounded-2xl overflow-hidden border-2 border-cyan-400/40 shadow-2xl shadow-cyan-500/30 bg-slate-950/40 group-hover:scale-102 transition-transform duration-300">
              <img
                src="/robot_original.png"
                alt="Meta.Ny AI Robot"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-950/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Sparkle badge */}
            <span className="absolute -top-2 -left-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-20">
              <Sparkles className="w-2.5 h-2.5" /> Meta.Ny AI
            </span>
          </div>

          {/* Titles - Localized */}
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
              {t.welcomeTitle}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-blue-100 font-medium max-w-xl leading-relaxed">
              {welcomeText || t.welcomeSubtitle}
            </p>
          </div>
        </div>

        {/* Right Side: VIP Box - Exactly as in the design image */}
        <div 
          onClick={onOpenVIP}
          className="bg-slate-950/70 hover:bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 sm:px-6 sm:py-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 hover:border-amber-400 shadow-xl shadow-black/30 shrink-0 group min-w-[170px]"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-1 group-hover:scale-110 transition-transform">
            <Crown className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-amber-300">
            {t.vipStatus}
          </span>
          <span className="text-[11px] text-slate-300 font-mono mt-0.5">
            {t.activeUntil}
          </span>
        </div>

      </div>
    </div>
  );
};
