import React, { useState } from 'react';
import {
  Bell,
  MessageCircle,
  Menu,
  ShieldCheck,
  UserCheck,
  Sparkles,
  CheckCircle2,
  Sun,
  Moon,
  LogIn,
} from 'lucide-react';
import { User } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface TopBarProps {
  user: User | null;
  onToggleSidebar?: () => void;
  onOpenChat: () => void;
  onOpenAuth?: () => void;
  onOpenAdmin?: () => void;
  onSwitchRole: (role: 'admin' | 'regular') => void;
  onOpenStreakModal: () => void;
  isTrialSimulation?: boolean;
  onToggleTrialSimulation?: () => void;
  trialUsageCount?: number;
  isRealAdmin?: boolean;
  adminNotificationBadgeCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  onToggleSidebar,
  onOpenChat,
  onOpenAuth,
  onOpenAdmin,
  onSwitchRole,
  onOpenStreakModal,
  isTrialSimulation = false,
  onToggleTrialSimulation,
  trialUsageCount = 0,
  isRealAdmin = false,
  adminNotificationBadgeCount = 0,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const { t, isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-900/95 dark:backdrop-blur-md text-slate-800 dark:text-slate-100 border-b border-slate-200/90 dark:border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors duration-200">
      {/* Zone 1: Language switcher & mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label={t.sidebarMenuLabel}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Full Language Switcher */}
        <LanguageSwitcher variant="segmented" />

        {/* Secret Admin controls - strictly invisible unless ?admin=meta-ny-secret */}
        {isRealAdmin && onToggleTrialSimulation && (
          <button
            onClick={onToggleTrialSimulation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isTrialSimulation
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white ring-2 ring-amber-300 dark:ring-amber-500/40 shadow-amber-500/30'
                : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-700/60 text-indigo-700 dark:text-indigo-300'
            }`}
            title={t.trialBarTitle}
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isTrialSimulation ? 'animate-spin' : 'text-indigo-600 dark:text-indigo-400'
              }`}
            />
            <span>
              {isTrialSimulation
                ? `⚡ ${t.trialSimBtnActive} (${trialUsageCount || 0})`
                : `🎮 ${t.trialSimBtnInactive}`}
            </span>
          </button>
        )}

        {isRealAdmin && (
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => onSwitchRole('admin')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                user?.isAdmin && !isTrialSimulation
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.adminRole}</span>
            </button>
            <button
              onClick={() => onSwitchRole('regular')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                !user?.isAdmin || isTrialSimulation
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{t.userRole}</span>
            </button>
          </div>
        )}

        {/* Streak badge for regular users */}
        {!user?.isAdmin && (
          <button
            onClick={onOpenStreakModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shadow-2xs cursor-pointer"
            title={isRTL ? 'مكافأة 30 يوماً متواصلاً' : '30-day loyalty reward'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>
              {t.streakBadge}: {user?.dailyStreak || 1} 🔥
            </span>
          </button>
        )}
      </div>

      {/* Zone 2: Install App, Dark Mode Toggle, Contact Button, Notifications & Brand Logo */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="hidden sm:block">
          <PWAInstallButton variant="topbar" />
        </div>

        {/* Dark / Light Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          data-testid="theme-toggle"
          aria-pressed={isDark}
          aria-label={isDark ? t.lightMode : t.darkMode}
          title={isDark ? t.lightMode : t.darkMode}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-amber-300 transition-all cursor-pointer shadow-2xs"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-300 transition-transform duration-200 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
          )}
        </button>

        {/* Protected Admin Dashboard shortcut - strictly invisible unless verified admin */}
        {isRealAdmin && user?.isAdmin && !isTrialSimulation && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            data-testid="topbar-admin-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer relative"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.adminManagement}</span>
            {adminNotificationBadgeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono leading-none">
                {adminNotificationBadgeCount > 99 ? '99+' : adminNotificationBadgeCount}
              </span>
            )}
          </button>
        )}

        {/* Email Sign-In / Account Switch Button */}
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            data-testid="topbar-signin-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title={isRTL ? 'تسجيل الدخول بالبريد الإلكتروني' : 'Sign in with email'}
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </span>
          </button>
        )}

        {/* Contact Button (no email exposed) */}
        <button
          onClick={onOpenChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          title={t.supportChatTooltip}
        >
          <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden md:inline">{t.adminSupport}</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 relative transition-colors cursor-pointer"
            aria-label={t.notificationsAria}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
              2
            </span>
          </button>

          {showNotifications && (
            <div
              className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 z-50 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {t.notificationsTitle}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md font-semibold">
                  {t.newBadge}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-800/50">
                  <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{t.notif1Title}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    {t.notif1Text}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100/60 dark:border-amber-800/50">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t.notif2Title}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    {t.notif2Text}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Brand Logo in TopBar */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif]">
            Meta.Ny
          </span>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg tracking-tighter">
            M
          </div>
        </div>
      </div>
    </header>
  );
};
