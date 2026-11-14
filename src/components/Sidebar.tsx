import React from 'react';
import {
  Home,
  User as UserIcon,
  ShieldCheck,
  CreditCard,
  Settings,
  LogOut,
  Crown,
  FileText,
} from 'lucide-react';
import { User } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useLanguage } from '../i18n/LanguageContext';

interface SidebarProps {
  user: User | null;
  isSecretAdmin?: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onOpenVIP: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  isSecretAdmin = false,
  activeTab,
  setActiveTab,
  onLogout,
  onOpenVIP,
}) => {
  const { t, isRTL } = useLanguage();

  const showAdminEntry = Boolean(isSecretAdmin && user?.isAdmin);

  const navItems = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'profile', label: t.profile, icon: UserIcon },
    { id: 'my-files', label: t.myFiles, icon: FileText },
    { id: 'subscriptions', label: t.subscriptions, icon: CreditCard },
    { id: 'settings', label: t.settings, icon: Settings },
    ...(showAdminEntry
      ? [{ id: 'admin', label: t.adminManagement, icon: ShieldCheck, badge: t.adminBadge }]
      : []),
  ];

  const defaultDisplayName = isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User';
  const defaultWorkspaceLabel = isRTL ? 'وضع التصفح المحلي 100%' : '100% Client-Side Mode';

  return (
    <aside
      className={`w-64 bg-[#0a1120] text-slate-200 flex flex-col justify-between shrink-0 min-h-screen ${
        isRTL ? 'border-l' : 'border-r'
      } border-slate-800/80 p-4 transition-all`}
    >
      <div>
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-extrabold text-xl tracking-tighter">
            M
          </div>
          <span className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
            Meta.Ny
          </span>
        </div>

        {/* User Profile Snippet */}
        <div
          onClick={() => setActiveTab('profile')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-3 mb-6 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className={`truncate ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="text-xs font-semibold text-white truncate">
                {user?.name || defaultDisplayName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.email ? user.email : defaultWorkspaceLabel}
              </div>
            </div>
          </div>
          {showAdminEntry ? (
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm shrink-0">
              {t.adminBadge} 🛡️
            </span>
          ) : user?.isVIP ? (
            <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm shrink-0">
              {t.vipBadge}
            </span>
          ) : (
            <span className="bg-slate-800 text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 border border-slate-700">
              {t.memberBadge}
            </span>
          )}
        </div>

        {/* Navigation items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all mt-4 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.logout}</span>
          </button>
        </nav>
      </div>

      <div>
        {/* PWA Install Button */}
        <div className="mt-4">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Bottom Gold VIP Box */}
        <div
          onClick={onOpenVIP}
          className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-[#18233c] to-[#0f172a] border border-amber-500/40 shadow-lg shadow-amber-500/5 cursor-pointer hover:border-amber-400 transition-all group text-center"
        >
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Crown className="w-5 h-5" />
            </div>
          </div>
          <h4 className="text-amber-400 font-bold text-sm mb-1">{t.vipUser}</h4>
          <p className="text-[11px] text-slate-300 leading-relaxed">{t.vipPerks}</p>
        </div>
      </div>
    </aside>
  );
};
