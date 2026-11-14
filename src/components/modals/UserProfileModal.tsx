import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Crown, Check, Sun, Moon } from 'lucide-react';
import { User } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpdateUser: (user: User) => void;
  onOpenAuth?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onOpenAuth,
}) => {
  const [name, setName] = useState(currentUser?.name || '');
  const [success, setSuccess] = useState(false);
  const { isDark, setTheme } = useTheme();
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      setName(currentUser?.name || (isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User'));
      setSuccess(false);
    }
  }, [isOpen, currentUser, isRTL]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const updated: User = {
      ...currentUser,
      name: name.trim() || (isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User'),
    };
    onUpdateUser(updated);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.profileModalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.profileModalSubtitle}
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
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                {t.accountStatusLabel}
              </span>
              <div className="mt-1">
                {currentUser?.isVIP ? (
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-transparent dark:border-amber-800/60 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 fill-amber-600 dark:fill-amber-400" />{' '}
                    {t.vipMemberLabel}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-md inline-block">
                    {t.freeMemberLabel}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                {t.streakDaysLabel}
              </span>
              <div className="mt-1 text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                {currentUser?.dailyStreak || 1} {t.dayStreakSuffix} 🔥
              </div>
            </div>
          </div>

          {/* Language Preference Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.appLanguageLabel}
            </label>
            <LanguageSwitcher variant="settings" />
          </div>

          {/* Theme Preference Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.appThemeLabel}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isDark
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.lightMode}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 text-amber-300 shadow-xs border border-slate-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.darkMode}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t.fullNameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {success && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800/70">
              <Check className="w-4 h-4" /> {t.profileSavedMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            {t.saveChangesBtn}
          </button>

          {onOpenAuth && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              {isRTL ? 'تسجيل الدخول / تبديل الحساب بالبريد الإلكتروني' : 'Sign In / Switch Account by Email'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
