import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LanguageSwitcherProps {
  variant?: 'segmented' | 'button' | 'settings';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'segmented',
  className = '',
}) => {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const isArabic = language === 'ar';

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        data-testid="language-switcher"
        aria-label={t.toggleLangTooltip}
        title={t.toggleLangTooltip}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer ${className}`}
      >
        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>{isArabic ? 'English' : 'العربية'}</span>
      </button>
    );
  }

  if (variant === 'settings') {
    return (
      <div
        data-testid="language-switcher-settings"
        role="group"
        aria-label={t.appLanguageLabel}
        className={`grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
      >
        <button
          type="button"
          onClick={() => setLanguage('ar')}
          aria-pressed={isArabic}
          data-testid="lang-ar-settings"
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            isArabic
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>العربية (Arabic)</span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          aria-pressed={!isArabic && language === 'en'}
          data-testid="lang-en-settings"
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            language === 'en'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>English (الإنجليزية)</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="language-switcher"
      role="group"
      aria-label={t.toggleLangTooltip}
      title={t.toggleLangTooltip}
      className={`inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800 shadow-2xs ${className}`}
    >
      <span className="px-1.5 text-blue-600 dark:text-blue-400 flex items-center" aria-hidden="true">
        <Globe className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        onClick={() => setLanguage('ar')}
        data-testid="lang-ar"
        aria-pressed={isArabic}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isArabic
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        العربية
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        data-testid="lang-en"
        aria-pressed={language === 'en'}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
};
