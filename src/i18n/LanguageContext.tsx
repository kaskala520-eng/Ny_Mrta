import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, Translations, translations } from './translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: Translations;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: translations.ar,
  isRTL: true,
});

// Intelligent language detection based on user country, timezone, and device locale
function detectUserCountryLanguage(): SupportedLanguage {
  try {
    // 1. Check if user already explicitly chose a language previously
    const saved = localStorage.getItem('metany_lang') as SupportedLanguage;
    const validLanguages: SupportedLanguage[] = ['ar', 'en', 'ku', 'fr', 'es', 'tr', 'de', 'fa'];
    if (saved && validLanguages.includes(saved)) {
      return saved;
    }

    // 2. Detect user's country from Timezone (Intl API)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzLower = timeZone.toLowerCase();

    // Arab World timezones -> Arabic
    if (
      tzLower.includes('baghdad') ||
      tzLower.includes('riyadh') ||
      tzLower.includes('cairo') ||
      tzLower.includes('dubai') ||
      tzLower.includes('damascus') ||
      tzLower.includes('beirut') ||
      tzLower.includes('amman') ||
      tzLower.includes('kuwait') ||
      tzLower.includes('qatar') ||
      tzLower.includes('bahrain') ||
      tzLower.includes('muscat') ||
      tzLower.includes('aden') ||
      tzLower.includes('khartoum') ||
      tzLower.includes('tripoli') ||
      tzLower.includes('tunis') ||
      tzLower.includes('algiers') ||
      tzLower.includes('casablanca')
    ) {
      // Check Kurdish regions inside Iraq/region
      if (tzLower.includes('erbil') || tzLower.includes('sulaymaniyah')) {
        return 'ku';
      }
      return 'ar';
    }

    // Iran / Afghanistan -> Persian
    if (tzLower.includes('tehran') || tzLower.includes('kabul')) {
      return 'fa';
    }

    // Turkey -> Turkish
    if (tzLower.includes('istanbul')) {
      return 'tr';
    }

    // France / French speaking regions -> French
    if (tzLower.includes('paris') || tzLower.includes('brussels') || tzLower.includes('monaco')) {
      return 'fr';
    }

    // Germany / Austria / Switzerland -> German
    if (tzLower.includes('berlin') || tzLower.includes('vienna') || tzLower.includes('zurich')) {
      return 'de';
    }

    // Spain / Latin America -> Spanish
    if (
      tzLower.includes('madrid') ||
      tzLower.includes('mexico') ||
      tzLower.includes('buenos_aires') ||
      tzLower.includes('bogota') ||
      tzLower.includes('santiago') ||
      tzLower.includes('lima')
    ) {
      return 'es';
    }

    // 3. Fallback to Browser Navigator Language & Locale
    const navLangs = navigator.languages || [navigator.language || ''];
    for (const rawLang of navLangs) {
      const l = rawLang.toLowerCase();
      if (l.startsWith('ar')) return 'ar';
      if (l.startsWith('ku')) return 'ku';
      if (l.startsWith('fa')) return 'fa';
      if (l.startsWith('tr')) return 'tr';
      if (l.startsWith('fr')) return 'fr';
      if (l.startsWith('es')) return 'es';
      if (l.startsWith('de')) return 'de';
      if (l.startsWith('en')) return 'en';
    }
  } catch (err) {
    console.warn('Geo-language detection error:', err);
  }

  // Universal Default
  return 'ar';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => detectUserCountryLanguage());

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('metany_lang', lang);
    } catch {
      // ignore storage quota errors
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    const active = translations[language] || translations.ar;
    document.documentElement.dir = active.dir;
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'metany_lang' && e.newValue && e.newValue in translations) {
        setLanguageState(e.newValue as SupportedLanguage);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const activeTranslations = translations[language] || translations.ar;

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t: activeTranslations,
    isRTL: activeTranslations.dir === 'rtl',
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  return useContext(LanguageContext);
}
