import React, { useState } from 'react';
import { X, Check, Mail, User as UserIcon, LogOut } from 'lucide-react';
import { User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getRegisteredUsers,
  isAuthorizedAdminEmail,
  syncUserToRegistry,
} from '../../utils/adminTracking';
import { signInWithGoogleAccount } from '../../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSecretAdmin?: boolean;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  isSecretAdmin = false,
  onLoginSuccess,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { isRTL } = useLanguage();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg(
        isRTL
          ? 'يرجى إدخال بريد إلكتروني صحيح للمتابعة.'
          : 'Please enter a valid email address to continue.'
      );
      return;
    }

    setSubmitting(true);
    const today = new Date().toISOString().split('T')[0];

    const matchedAdminEmail = await isAuthorizedAdminEmail(trimmedEmail);
    const grantAdmin = Boolean(isSecretAdmin || matchedAdminEmail);

    const derivedName =
      name.trim() ||
      trimmedEmail.split('@')[0] ||
      (isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User');

    const normalizedEmail = trimmedEmail.toLowerCase();
    const existingUsers = getRegisteredUsers();
    const existingNonAdmin = !grantAdmin
      ? existingUsers.find((u) => !u.isAdmin && u.email?.toLowerCase() === normalizedEmail)
      : undefined;

    const localUser: User = existingNonAdmin
      ? {
          ...existingNonAdmin,
          name: name.trim() || existingNonAdmin.name || derivedName,
          visitCount: (existingNonAdmin.visitCount || 0) + 1,
          lastLoginDate: today,
        }
      : {
          id: grantAdmin ? 'local_secret_admin' : `user_${Date.now()}`,
          name: derivedName,
          // Never store or expose authorized admin email addresses in plaintext
          email: grantAdmin ? '' : trimmedEmail,
          isAdmin: grantAdmin,
          isVIP: grantAdmin,
          hideAds: grantAdmin,
          isBanned: false,
          usageCount: 0,
          visitCount: 1,
          dailyStreak: 1,
          lastLoginDate: today,
          createdAt: today,
        };

    const synced = syncUserToRegistry(localUser);

    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      setSubmitting(false);
      setEmail('');
      setName('');
      onLoginSuccess(synced);
      onClose();
    }, 350);
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const fbAccount = await signInWithGoogleAccount();
      const today = new Date().toISOString().split('T')[0];
      const grantAdmin = Boolean(isSecretAdmin || fbAccount.isAdmin);
      const userObj: User = {
        id: grantAdmin ? 'local_secret_admin' : fbAccount.uid,
        name: fbAccount.displayName,
        email: grantAdmin ? '' : fbAccount.email,
        isAdmin: grantAdmin,
        isVIP: grantAdmin,
        hideAds: grantAdmin,
        isBanned: false,
        usageCount: 0,
        visitCount: 1,
        dailyStreak: 1,
        lastLoginDate: today,
        createdAt: today,
      };
      const synced = syncUserToRegistry(userObj);
      setSavedBanner(true);
      setTimeout(() => {
        setSavedBanner(false);
        setSubmitting(false);
        onLoginSuccess(synced);
        onClose();
      }, 300);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(
        err?.message ||
          (isRTL
            ? 'تعذر إتمام تسجيل الدخول عبر Google. يمكنك التسجيل بالبريد الإلكتروني أدناه.'
            : 'Google Sign-In failed. You can sign in using email below.')
      );
    }
  };

  const handleGuestMode = () => {
    const today = new Date().toISOString().split('T')[0];
    const guestUser: User = {
      id: 'local_user',
      name: isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User',
      email: '',
      isAdmin: isSecretAdmin,
      isVIP: isSecretAdmin,
      hideAds: isSecretAdmin,
      isBanned: false,
      usageCount: 0,
      visitCount: 1,
      dailyStreak: 1,
      lastLoginDate: today,
      createdAt: today,
    };
    const synced = syncUserToRegistry(guestUser);
    onLoginSuccess(synced);
    onClose();
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        } p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 transition-colors`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-['Cairo',sans-serif]">
              {isRTL ? 'تسجيل الدخول بالبريد الإلكتروني' : 'Sign In with Email'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {isRTL
              ? 'أدخل بريدك الإلكتروني واسم العرض لتسجيل الدخول إلى مساحتك الشخصية ومزامنة صلاحيات حسابك تلقائياً:'
              : 'Enter your email address and display name to sign in and sync your account permissions automatically:'}
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute top-3 left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-blue-500 text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'اسم العرض (اختياري)' : 'Display Name (optional)'}
            </label>
            <div className="relative">
              <UserIcon className={`w-4 h-4 text-slate-400 absolute top-3 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isRTL ? 'أحمد المحمدي' : 'John Doe'}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl ${
                  isRTL ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
                } py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-blue-500`}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/70">
              {errorMsg}
            </div>
          )}

          {savedBanner && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800/70">
              <Check className="w-4 h-4" />{' '}
              {isRTL ? 'تم تسجيل الدخول وتحديث الحساب بنجاح' : 'Signed in successfully'}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/25 transition-all cursor-pointer"
          >
            {isRTL ? 'تسجيل الدخول بالبريد الإلكتروني' : 'Sign In with Email'}
          </button>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="font-black text-blue-600">G</span>
            <span>{isRTL ? 'تسجيل الدخول بحساب Google (Firebase)' : 'Sign in with Google (Firebase)'}</span>
          </button>

          <button
            type="button"
            onClick={handleGuestMode}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تسجيل الخروج / المتابعة كزائر' : 'Continue as Guest User'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
