import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HeroBanner } from './components/HeroBanner';
import { ServiceCards } from './components/ServiceCards';
import { UploadSection } from './components/UploadSection';
import { TranslationBox } from './components/TranslationBox';
import { BottomNotificationBar } from './components/BottomNotificationBar';
import { OfflineBanner } from './components/OfflineBanner';
import { GlobalAnnouncementBar } from './components/GlobalAnnouncementBar';
import {
  AdPlatformManager,
  AdBannerSlot,
  AdPlatformRuntimeConfig,
  trackLocalAdEvent,
} from './components/AdPlatformManager';
import { saveOfflineFile, purgeOldCorruptedQuestionsStorage } from './utils/offlineDb';
import { useLanguage } from './i18n/LanguageContext';
import { ServiceType, User, CommandAuditMeta } from './types';
import {
  LOCAL_USER_STORAGE_KEY as TRACKING_USER_KEY,
  syncUserToRegistry,
  logClientCommand,
  ADMIN_NOTIFICATIONS_EVENT,
  fetchAdminNotificationsMerged,
  StoredAdminNotification,
} from './utils/adminTracking';
import {
  UploadedServerFile,
  uploadFileToCloudOrServer,
  persistOrderToServerAndCloud,
  getCachedUploadedFile,
  fetchRetentionDaysSetting,
  runClientAndServerAutoDeleteSweep,
  getUserExpiringTomorrowFiles,
  getRetentionDaysSettingSync,
  DAY_MS,
} from './utils/cloudStorage';

// Modals
import { ResearchModal } from './components/modals/ResearchModal';
import { SolveModal } from './components/modals/SolveModal';
import { QuestionsModal } from './components/modals/QuestionsModal';
import { TranslateModal } from './components/modals/TranslateModal';
import { ConvertModal } from './components/modals/ConvertModal';
import { VoiceModal } from './components/modals/VoiceModal';
import { ImageModal } from './components/modals/ImageModal';
import { AdModal } from './components/modals/AdModal';
import { StreakRewardModal } from './components/modals/StreakRewardModal';
import { WhatsAppChatModal } from './components/modals/WhatsAppChatModal';
import { AdminDashboardModal } from './components/modals/AdminDashboardModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { SubscriptionsModal } from './components/modals/SubscriptionsModal';
import { MyFilesModal } from './components/modals/MyFilesModal';
import { AuthModal } from './components/modals/AuthModal';

export const LOCAL_USER_STORAGE_KEY = TRACKING_USER_KEY;
export const LOCAL_PAGES_STORAGE_KEY = 'metany_local_pages';
export const LOCAL_PAGES_UPDATED_EVENT = 'metany:pages-updated';
export const USERS_UPDATED_EVENT = 'metany:users-updated';

function checkSecretAdminParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('admin') === 'meta-ny-secret';
}

export default function App() {
  const { t, isRTL } = useLanguage();
  const isSecretAdminParam = checkSecretAdminParam();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Admin privilege comes EITHER from the secret URL flag OR authenticated hashed admin email login
  const hasAdminPrivilege = Boolean(isSecretAdminParam || currentUser?.isAdmin);

  // Active files and document state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileServerMeta, setSelectedFileServerMeta] = useState<UploadedServerFile | null>(null);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [translatedResult, setTranslatedResult] = useState<string>('');

  // Modals state
  const [activeModal, setActiveModal] = useState<
    ServiceType | 'profile' | 'admin' | 'my-files' | 'subscriptions' | 'chat' | 'auth' | null
  >(null);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [translationOptions, setTranslationOptions] = useState<{
    text: string;
    targetLang: string;
    mode: 'single' | 'dual';
  } | null>(null);

  // Dynamic texts stored locally
  const [heroText, setHeroText] = useState<string | null>(null);
  const [bottomNotice, setBottomNotice] = useState<string | null>(null);
  const [adConfig, setAdConfig] = useState<AdPlatformRuntimeConfig | null>(null);

  // Admin controls & simulation ONLY exist when admin privilege is verified
  const [isTrialSimulation, setIsTrialSimulation] = useState<boolean>(() => {
    if (!checkSecretAdminParam()) return false;
    return localStorage.getItem('metany_admin_trial_mode') === 'true';
  });

  const [trialUsageCount, setTrialUsageCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('metany_trial_usage_count') || '0', 10);
  });

  const [trialToast, setTrialToast] = useState<string | null>(null);
  const [expiringTomorrowFilesCount, setExpiringTomorrowFilesCount] = useState(0);
  const [expiringBannerDismissed, setExpiringBannerDismissed] = useState(false);
  const [unreadAdminNotifs, setUnreadAdminNotifs] = useState(0);
  const [liveAdminToast, setLiveAdminToast] = useState<StoredAdminNotification | null>(null);

  const providerDisplayName =
    adConfig?.provider === 'hilltopads'
      ? 'HilltopAds'
      : adConfig?.provider === 'admaven'
      ? 'AdMaven'
      : adConfig?.provider === 'popads'
      ? 'PopAds'
      : adConfig?.provider === 'aads'
      ? 'A-ADS'
      : adConfig?.provider === 'adsterra_direct'
      ? 'Adsterra'
      : 'Partner Ads';

  const effectiveUser: User | null = currentUser
    ? hasAdminPrivilege && isTrialSimulation
      ? {
          ...currentUser,
          isAdmin: false,
          isVIP: false,
          hideAds: false,
          usageCount: trialUsageCount,
          dailyStreak: currentUser.dailyStreak || 7,
        }
      : {
          ...currentUser,
          isAdmin: hasAdminPrivilege,
        }
    : null;

  const isBannedUser = Boolean(effectiveUser?.isBanned && !hasAdminPrivilege);

  const handleToggleTrialSimulation = () => {
    if (!hasAdminPrivilege) return;
    setIsTrialSimulation((prev) => {
      const next = !prev;
      localStorage.setItem('metany_admin_trial_mode', next ? 'true' : 'false');
      if (next) {
        setTrialToast(
          '🎮 تم تفعيل وضع تجربة المستخدم! أنت الآن تختبر الموقع تماماً كما يظهر للمستخدم في فترة التجربة.'
        );
      } else {
        setTrialToast('🛡️ تم إيقاف وضع التجربة والعودة للوضع الرئيسي.');
      }
      setTimeout(() => setTrialToast(null), 5000);
      return next;
    });
  };

  const handleResetTrial = (targetCount: number = 0) => {
    if (!hasAdminPrivilege) return;
    setTrialUsageCount(targetCount);
    localStorage.setItem('metany_trial_usage_count', String(targetCount));
    setTrialToast(
      targetCount === 0
        ? '🔄 تم تصفير عداد التجربة إلى (0)!'
        : '📺 تم ضبط العداد إلى (1) لاختبار نافذة الإعلان.'
    );
    setTimeout(() => setTrialToast(null), 4000);
  };

  // Initialize local client-side user, track visit count, & sync dynamic page overrides
  useEffect(() => {
    void purgeOldCorruptedQuestionsStorage();
    const today = new Date().toISOString().split('T')[0];

    try {
      const rawUser = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      let loadedUser: User | null = rawUser ? JSON.parse(rawUser) : null;

      if (!loadedUser) {
        loadedUser = {
          id: isSecretAdminParam ? 'local_secret_admin' : 'local_user',
          name: isSecretAdminParam
            ? isRTL
              ? 'مشرف النظام'
              : 'System Admin'
            : isRTL
            ? 'مستخدم Meta.Ny'
            : 'Meta.Ny User',
          email: '',
          isAdmin: isSecretAdminParam,
          isVIP: isSecretAdminParam,
          hideAds: isSecretAdminParam,
          isBanned: false,
          usageCount: 0,
          visitCount: 1,
          dailyStreak: 1,
          lastLoginDate: today,
          createdAt: today,
        };
      } else {
        const lastDate = new Date(loadedUser.lastLoginDate || today);
        const currDate = new Date(today);
        const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
        let nextStreak = loadedUser.dailyStreak || 1;
        if (diffDays === 1) nextStreak += 1;
        else if (diffDays > 1) nextStreak = 1;

        const sessionAdmin = Boolean(
          isSecretAdminParam || (loadedUser.id === 'local_secret_admin' && loadedUser.isAdmin)
        );

        loadedUser = {
          ...loadedUser,
          email: sessionAdmin ? '' : loadedUser.email || '',
          isAdmin: sessionAdmin,
          visitCount: (loadedUser.visitCount || 0) + 1,
          dailyStreak: nextStreak,
          lastLoginDate: today,
        };
      }

      const synced = syncUserToRegistry(loadedUser);
      localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(synced));
      setCurrentUser(synced);
    } catch {
      const fallbackUser: User = {
        id: isSecretAdminParam ? 'local_secret_admin' : 'local_user',
        name: isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User',
        email: '',
        isAdmin: isSecretAdminParam,
        isVIP: isSecretAdminParam,
        hideAds: isSecretAdminParam,
        isBanned: false,
        usageCount: 0,
        visitCount: 1,
        dailyStreak: 1,
        lastLoginDate: today,
        createdAt: today,
      };
      setCurrentUser(fallbackUser);
    }

    const handleUsersSync = () => {
      try {
        const raw = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
        if (raw) {
          setCurrentUser(JSON.parse(raw));
        }
      } catch {
        // ignore
      }
    };

    const loadDynamicPages = () => {
      try {
        const rawPages = localStorage.getItem(LOCAL_PAGES_STORAGE_KEY);
        if (!rawPages) {
          setHeroText(null);
          setBottomNotice(null);
          return;
        }
        const pages = JSON.parse(rawPages);
        if (Array.isArray(pages)) {
          const hero = pages.find((p: any) => p.key === 'hero_welcome');
          const notice = pages.find((p: any) => p.key === 'bottom_notice');
          const defaultHero =
            'مرحباً بك في Meta.Ny - مساحتك الذكية للمستندات والترجمة والأسئلة والصوت والبحوث.';
          const defaultNotice =
            'يمكنك الآن استخدام التطبيق مجاناً مرّة واحدة، وبعد ذلك يمكنك مشاهدة 3 إعلانات أو الاشتراك في أحد الباقات.';
          setHeroText(hero?.content && hero.content !== defaultHero ? hero.content : null);
          setBottomNotice(notice?.content && notice.content !== defaultNotice ? notice.content : null);
        }
      } catch {
        // Ignore malformed local storage
      }
    };

    loadDynamicPages();
    window.addEventListener(LOCAL_PAGES_UPDATED_EVENT, loadDynamicPages);
    window.addEventListener(USERS_UPDATED_EVENT, handleUsersSync);

    // Initialize file retention setting, run expired file cleanup sweep, & check expiring-tomorrow files
    const checkLifecycleAndExpiry = async () => {
      await fetchRetentionDaysSetting();
      await runClientAndServerAutoDeleteSweep(isSecretAdminParam);
      const expiring = await getUserExpiringTomorrowFiles('local_user');
      setExpiringTomorrowFilesCount(expiring.length);
    };
    void checkLifecycleAndExpiry();
    const expiryInterval = setInterval(() => {
      void checkLifecycleAndExpiry();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener(LOCAL_PAGES_UPDATED_EVENT, loadDynamicPages);
      window.removeEventListener(USERS_UPDATED_EVENT, handleUsersSync);
      clearInterval(expiryInterval);
    };
  }, [isSecretAdminParam, isRTL]);

  // Listen for instant admin notifications ONLY when admin privilege is verified
  useEffect(() => {
    if (!hasAdminPrivilege || isTrialSimulation) {
      setUnreadAdminNotifs(0);
      setLiveAdminToast(null);
      return;
    }

    const syncAdminNotifs = async () => {
      const all = await fetchAdminNotificationsMerged();
      setUnreadAdminNotifs(all.filter((n) => !n.read).length);
    };
    void syncAdminNotifs();

    const onNewAdminNotif = (ev: Event) => {
      const detail = (ev as CustomEvent<StoredAdminNotification>)?.detail;
      if (detail) {
        setLiveAdminToast(detail);
        setTimeout(() => {
          setLiveAdminToast((prev) => (prev?.id === detail.id ? null : prev));
        }, 6500);
      }
      void syncAdminNotifs();
    };

    window.addEventListener(ADMIN_NOTIFICATIONS_EVENT, onNewAdminNotif);
    return () => {
      window.removeEventListener(ADMIN_NOTIFICATIONS_EVENT, onNewAdminNotif);
    };
  }, [hasAdminPrivilege, isTrialSimulation]);

  // Role switch inside admin bar only
  const handleSwitchRole = (role: 'admin' | 'regular') => {
    if (!hasAdminPrivilege || !currentUser) return;
    const nextUser: User = {
      ...currentUser,
      isAdmin: role === 'admin',
      isVIP: role === 'admin',
      hideAds: role === 'admin',
    };
    const synced = syncUserToRegistry(nextUser);
    setCurrentUser(synced);
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(synced));
  };

  // Client-side execution gate: enforces ban check, trial simulation (when admin tests it), and usage + command tracking
  const checkAdOrVIP = async (): Promise<boolean> => {
    if (!currentUser) return true;

    const toolCmd = activeModal ? String(activeModal) : 'workspace_tool';

    if (currentUser.isBanned && !hasAdminPrivilege) {
      logClientCommand({
        userId: currentUser.id,
        userName: currentUser.name,
        command: toolCmd,
        details: isRTL ? 'محاولة تشغيل أداة لحساب محظور' : 'Blocked tool execution for banned profile',
        status: 'blocked',
      });
      setTrialToast(
        isRTL
          ? '🚫 عذراً، هذا الحساب محظور حالياً من استخدام الأدوات. تواصل عبر نافذة التواصل للمراجعة.'
          : '🚫 This profile is currently restricted from running tools. Please contact support.'
      );
      setTimeout(() => setTrialToast(null), 5000);
      return false;
    }

    logClientCommand({
      userId: currentUser.id,
      userName: currentUser.name,
      command: toolCmd,
      details: isRTL ? `بدء تنفيذ أداة (${toolCmd})` : `Started tool (${toolCmd})`,
      status: 'started',
    });

    if (hasAdminPrivilege && isTrialSimulation) {
      if (trialUsageCount === 0) {
        const newCount = 1;
        setTrialUsageCount(newCount);
        localStorage.setItem('metany_trial_usage_count', String(newCount));
        setTrialToast('🎉 فترة التجربة: الاستخدام الأول مجاني بالكامل! الاستخدام التالي سيتطلب إعلاناً.');
        setTimeout(() => setTrialToast(null), 6000);
        return true;
      } else {
        const newCount = trialUsageCount + 1;
        setTrialUsageCount(newCount);
        localStorage.setItem('metany_trial_usage_count', String(newCount));
        return new Promise<boolean>((resolve) => {
          setPendingAction(() => () => resolve(true));
          setShowAdModal(true);
        });
      }
    }

    const updatedUser: User = {
      ...currentUser,
      usageCount: (currentUser.usageCount || 0) + 1,
    };
    const synced = syncUserToRegistry(updatedUser);
    setCurrentUser(synced);
    try {
      localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(synced));
    } catch {
      // Ignore quota issues
    }

    return true;
  };

  const handleAdCompleted = () => {
    setShowAdModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleSaveFile = async (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: {
      blob: Blob;
      fileName: string;
      mimeType?: string;
      originalFile?: File | null;
    },
    targetLang?: string
  ) => {
    const orderId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const userId = currentUser?.id || 'local_user';
    const userName = currentUser?.name || (isRTL ? 'مستخدم محلي' : 'Local User');
    const resolvedTargetLang = targetLang || audit?.targetLang;

    const activeOrigFile = resultFile?.originalFile || selectedFile;
    let origMeta: UploadedServerFile | null = audit?.originalFileUrl
      ? {
          url: audit.originalFileUrl,
          storagePath: audit.originalFileStoragePath || '',
          fileName: audit.attachedFileName || activeOrigFile?.name || 'file',
          fileType: audit.attachedFileType || activeOrigFile?.type || 'application/octet-stream',
          fileSize: audit.attachedFileSize || activeOrigFile?.size || 0,
        }
      : activeOrigFile
      ? getCachedUploadedFile(activeOrigFile) ||
        (selectedFile && activeOrigFile === selectedFile ? selectedFileServerMeta : null)
      : null;

    if (!origMeta && activeOrigFile) {
      origMeta = await uploadFileToCloudOrServer(
        activeOrigFile,
        activeOrigFile.name,
        activeOrigFile.type || 'application/octet-stream',
        'original',
        userId
      );
    }

    const fallbackSafeTitle =
      title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'MetaNy_Result';
    const resBlob =
      resultFile?.blob ||
      new Blob([content || title], { type: 'text/plain;charset=utf-8' });
    const resFileName = resultFile?.fileName || `${fallbackSafeTitle}.txt`;
    const resMime = resultFile?.mimeType || resBlob.type || 'text/plain;charset=utf-8';

    const uploadedResult = await uploadFileToCloudOrServer(
      resBlob,
      resFileName,
      resMime,
      'result',
      userId
    );

    const activeRetentionDays =
      audit?.retentionDays || origMeta?.retentionDays || uploadedResult?.retentionDays || getRetentionDaysSettingSync();
    const createdIso = new Date().toISOString();
    const computedExpiresIso =
      audit?.expiresAt ||
      origMeta?.expiresAt ||
      uploadedResult?.expiresAt ||
      new Date(Date.now() + activeRetentionDays * DAY_MS).toISOString();

    const fileRecord = {
      id: `file_${Date.now()}`,
      userId,
      fileName: origMeta?.fileName || audit?.attachedFileName || selectedFile?.name || `${title}.txt`,
      fileSize: origMeta?.fileSize || audit?.attachedFileSize || selectedFile?.size || 1024,
      fileType: origMeta?.fileType || audit?.attachedFileType || selectedFile?.type || 'text/plain',
      serviceUsed: format as any,
      title,
      resultContent: content,
      ...(resolvedTargetLang ? { metadata: { targetLang: resolvedTargetLang } } : {}),
      createdAt: createdIso,
      retentionDays: activeRetentionDays,
      expiresAt: computedExpiresIso,
      autoDeleted: false,
      orderId,
      originalFileUrl: origMeta?.url || audit?.originalFileUrl,
      resultFileUrl: uploadedResult?.url || audit?.resultFileUrl,
    };

    const orderEntry = {
      id: orderId,
      userId,
      userName,
      command: format,
      details: title,
      status: 'success' as const,
      timestamp: createdIso,
      audit: {
        queryText: audit?.queryText || title,
        inputPreview:
          audit?.inputPreview || (extractedContent ? extractedContent.slice(0, 1200) : undefined),
        outputPreview: audit?.outputPreview || content.slice(0, 2200),
        attachedFileName: origMeta?.fileName || audit?.attachedFileName || selectedFile?.name,
        attachedFileSize: origMeta?.fileSize || audit?.attachedFileSize || selectedFile?.size,
        attachedFileType: origMeta?.fileType || audit?.attachedFileType || selectedFile?.type,
        targetLang: resolvedTargetLang,
        originalFileUrl: origMeta?.url || audit?.originalFileUrl,
        originalFileStoragePath: origMeta?.storagePath || audit?.originalFileStoragePath,
        resultFileUrl: uploadedResult?.url || audit?.resultFileUrl,
        resultFileStoragePath: uploadedResult?.storagePath || audit?.resultFileStoragePath,
        resultFileName: uploadedResult?.fileName || audit?.resultFileName || resFileName,
        resultFileType: uploadedResult?.fileType || audit?.resultFileType || resMime,
        retentionDays: activeRetentionDays,
        expiresAt: computedExpiresIso,
        autoDeleted: false,
      },
    };

    await persistOrderToServerAndCloud(orderEntry);

    try {
      await saveOfflineFile(fileRecord);
      const expiring = await getUserExpiringTomorrowFiles(userId);
      setExpiringTomorrowFilesCount(expiring.length);
    } catch (err) {
      console.warn('Offline cache failed:', err);
    }
  };

  const handleTranslateBox = (opts: {
    text: string;
    targetLang: string;
    mode: 'single' | 'dual';
  }) => {
    setTranslationOptions(opts);
    setActiveModal('translate');
  };

  const handleUpgradeVIP = () => {
    if (currentUser) {
      const updated: User = {
        ...currentUser,
        isVIP: true,
        hideAds: true,
        vipExpiresAt: '2026-12-31',
      };
      const synced = syncUserToRegistry(updated);
      setCurrentUser(synced);
      try {
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(synced));
      } catch {
        // Ignore quota errors
      }
    }
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#f1f5f9] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row font-['Cairo',sans-serif] antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200"
    >
      {/* Sidebar - Desktop and Mobile Drawer */}
      <div
        className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-40 transform transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen
            ? 'translate-x-0'
            : isRTL
            ? 'translate-x-full md:translate-x-0'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          user={effectiveUser}
          isSecretAdmin={hasAdminPrivilege && !isTrialSimulation}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSidebarOpen(false);
            if (tab === 'profile') setActiveModal('profile');
            if ((tab === 'admin' || tab === 'users') && hasAdminPrivilege && !isTrialSimulation) {
              setActiveModal('admin');
            }
            if (tab === 'my-files') setActiveModal('my-files');
            if (tab === 'subscriptions') setActiveModal('subscriptions');
            if (tab === 'settings') setActiveModal('profile');
          }}
          onLogout={() => {
            setActiveModal('auth');
          }}
          onOpenVIP={() => setActiveModal('subscriptions')}
        />
      </div>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Offline State Banner */}
        <OfflineBanner onOpenMyFiles={() => setActiveModal('my-files')} />

        {/* Sticky Top Stack: Global Announcement Alert Bar + TopBar + Trial Bar */}
        <div className="sticky top-0 z-30 flex flex-col">
          <GlobalAnnouncementBar />

          <TopBar
            user={effectiveUser}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onOpenChat={() => setActiveModal('chat')}
            onOpenAuth={() => setActiveModal('auth')}
            onOpenAdmin={() => hasAdminPrivilege && setActiveModal('admin')}
            onSwitchRole={handleSwitchRole}
            onOpenStreakModal={() => setShowStreakModal(true)}
            isRealAdmin={hasAdminPrivilege}
            isTrialSimulation={isTrialSimulation}
            onToggleTrialSimulation={handleToggleTrialSimulation}
            trialUsageCount={trialUsageCount}
            adminNotificationBadgeCount={hasAdminPrivilege && !isTrialSimulation ? unreadAdminNotifs : 0}
          />

          {/* Trial Simulation Bar - STRICTLY hidden unless admin privilege is verified */}
          {hasAdminPrivilege && isTrialSimulation && (
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs z-25">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span className="font-bold">🎮 {t.trialBarTitle}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-md font-mono font-bold">
                  {t.trialUsagePrefix} {trialUsageCount}{' '}
                  {trialUsageCount === 0 ? t.trialFirstFree : t.trialAdRequired}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleResetTrial(0)}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold transition-colors cursor-pointer"
                >
                  🔄 {t.trialResetFreeBtn}
                </button>
                <button
                  onClick={() => handleResetTrial(1)}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold transition-colors cursor-pointer"
                >
                  📺 {t.trialTestAdBtn}
                </button>
                <button
                  onClick={() => setShowStreakModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-800/60 hover:bg-amber-800 text-white font-bold transition-colors cursor-pointer"
                >
                  🎁 {t.trialStreakBtn}
                </button>
                <button
                  onClick={() => setActiveModal('subscriptions')}
                  className="px-2.5 py-1 rounded-lg bg-amber-800/60 hover:bg-amber-800 text-white font-bold transition-colors cursor-pointer"
                >
                  👑 {t.trialVipScreenBtn}
                </button>
                <button
                  onClick={handleToggleTrialSimulation}
                  className="px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white font-bold transition-colors cursor-pointer border border-white/20"
                >
                  ✕ {t.trialExitBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instant Admin Live Alert Toast - STRICTLY hidden from regular users */}
        {hasAdminPrivilege && effectiveUser?.isAdmin && !isTrialSimulation && liveAdminToast && (
          <div className="fixed bottom-20 left-6 z-50 max-w-sm p-3.5 rounded-2xl bg-slate-950 text-white text-xs shadow-2xl border-2 border-indigo-500 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                <span>
                  {liveAdminToast.type === 'banned_attempt'
                    ? '🚫'
                    : liveAdminToast.type === 'auto_delete'
                    ? '🗑️'
                    : '🔔'}
                </span>
                <span>{liveAdminToast.title}</span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">{liveAdminToast.message}</p>
              <button
                type="button"
                onClick={() => {
                  setLiveAdminToast(null);
                  setActiveModal('admin');
                }}
                className="mt-1 text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                {isRTL ? 'فتح لوحة الإدارة ←' : 'Open Admin Center →'}
              </button>
            </div>
            <button
              onClick={() => setLiveAdminToast(null)}
              className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Toast Notification */}
        {trialToast && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-slate-900/95 text-white text-xs font-bold shadow-2xl border border-amber-400 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span>{trialToast}</span>
            <button
              onClick={() => setTrialToast(null)}
              className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Inner Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Expiring Tomorrow User Warning Banner (when user has site open 1 day before auto-delete) */}
          {expiringTomorrowFilesCount > 0 && !expiringBannerDismissed && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <span>
                ⏳ سيتم حذف ملفك غدا، حمله الان اذا تحتاجه ({expiringTomorrowFilesCount})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('my-files')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  {isRTL ? 'فتح ملفاتي للتحميل' : 'Open My Files'}
                </button>
                <button
                  type="button"
                  onClick={() => setExpiringBannerDismissed(true)}
                  className="px-2 py-1 text-xs text-amber-700 dark:text-amber-300 hover:opacity-75 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Banned Account Notice */}
          {isBannedUser && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
              <span>
                {isRTL
                  ? '🚫 تم تعليق صلاحية استخدام الأدوات لهذا الحساب. يمكنك التواصل عبر نافذة التواصل للمراجعة.'
                  : '🚫 Tool access for this profile is suspended. Please reach out via Contact Desk for review.'}
              </span>
              <button
                onClick={() => setActiveModal('chat')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                {isRTL ? 'تواصل معنا' : 'Contact Us'}
              </button>
            </div>
          )}

          {/* Ad Platform Runtime Manager */}
          <AdPlatformManager effectiveUser={effectiveUser} onConfigLoaded={setAdConfig} />

          {/* Top Ad placement (when configured and non-VIP) */}
          {!effectiveUser?.isVIP && !effectiveUser?.isAdmin && !effectiveUser?.hideAds && adConfig?.enabled && (
            <div className="mb-4 py-2 px-4 rounded-xl bg-slate-200/60 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700/80 text-center text-[11px] text-slate-600 dark:text-slate-300 flex flex-col gap-2">
              {adConfig.bannerTop?.enabled &&
              (adConfig.bannerTop.key || adConfig.bannerTop.invokeUrl) ? (
                <AdBannerSlot banner={adConfig.bannerTop} />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                {adConfig.directLinkUrl ? (
                  <a
                    href={adConfig.directLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackLocalAdEvent('direct_link_click')}
                    className="font-semibold hover:underline"
                  >
                    {isRTL
                      ? `عرض ممول عبر ${providerDisplayName} · استكشف الآن`
                      : `${providerDisplayName} Sponsored Offer · Explore Now`}
                  </a>
                ) : (
                  <span className="font-mono">
                    {isRTL
                      ? `${providerDisplayName} · مساحة إعلانية نشطة`
                      : `${providerDisplayName} · Active Ad Space`}
                  </span>
                )}
                <button
                  onClick={() => setActiveModal('subscriptions')}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  {t.removeAdsVipBtn}
                </button>
              </div>
            </div>
          )}

          {/* Hero Welcome Banner with 3D Robot */}
          <HeroBanner
            user={effectiveUser}
            onOpenVIP={() => setActiveModal('subscriptions')}
            welcomeText={heroText || undefined}
          />

          {/* 6 Main Service Cards */}
          <ServiceCards
            onSelectService={(service) => setActiveModal(service)}
            activeService={activeModal as ServiceType}
          />

          {/* Middle Two-Column Grid: Upload Dropzone + Translation Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 flex flex-col">
              <UploadSection
                onFileSelected={(file, content, uploadedServerFile) => {
                  setSelectedFile(file);
                  setSelectedFileServerMeta(uploadedServerFile || null);
                  if (content) setExtractedContent(content);
                  const orderEntry = {
                    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    userId: currentUser?.id || 'local_user',
                    userName: currentUser?.name || (isRTL ? 'مستخدم Meta.Ny' : 'Meta.Ny User'),
                    command: 'file_upload',
                    details: isRTL ? `إرفاق ملف: ${file.name}` : `Attached file: ${file.name}`,
                    status: 'success' as const,
                    timestamp: new Date().toISOString(),
                    audit: {
                      attachedFileName: file.name,
                      attachedFileSize: file.size,
                      attachedFileType: file.type,
                      inputPreview: content?.slice(0, 1200),
                      originalFileUrl: uploadedServerFile?.url,
                      originalFileStoragePath: uploadedServerFile?.storagePath,
                    },
                  };
                  void persistOrderToServerAndCloud(orderEntry);
                }}
                selectedFile={selectedFile}
                onClearFile={() => {
                  setSelectedFile(null);
                  setSelectedFileServerMeta(null);
                  setExtractedContent('');
                  setTranslatedResult('');
                }}
                onQuickAction={(action) => setActiveModal(action)}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <TranslationBox
                initialText={extractedContent}
                fileName={selectedFile?.name}
                selectedFile={selectedFile}
                translatedText={translatedResult}
                onTranslateResult={(res) => setTranslatedResult(res)}
                onTranslate={handleTranslateBox}
                checkAdOrVIP={checkAdOrVIP}
                onSaveFile={handleSaveFile}
              />
            </div>
          </div>

          {/* Bottom Notification Strip */}
          <BottomNotificationBar
            noticeText={bottomNotice || undefined}
            onOpenPlans={() => setActiveModal('subscriptions')}
          />

          {/* Bottom Ad placement (when configured and non-VIP) */}
          {!effectiveUser?.isVIP && !effectiveUser?.isAdmin && !effectiveUser?.hideAds && adConfig?.enabled && (
            <div className="py-2.5 px-4 rounded-xl bg-slate-200/60 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700/80 text-center text-[11px] text-slate-500 dark:text-slate-400 font-mono space-y-2">
              {(adConfig.nativeContainerId && adConfig.nativeScriptUrl) ||
              (adConfig.bannerBottom?.enabled &&
                (adConfig.bannerBottom.key || adConfig.bannerBottom.invokeUrl)) ? (
                <AdBannerSlot
                  banner={adConfig.bannerBottom}
                  nativeConfig={
                    adConfig.nativeContainerId && adConfig.nativeScriptUrl
                      ? {
                          containerId: adConfig.nativeContainerId,
                          scriptUrl: adConfig.nativeScriptUrl,
                        }
                      : undefined
                  }
                />
              ) : adConfig.directLinkUrl ? (
                <a
                  href={adConfig.directLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackLocalAdEvent('direct_link_click')}
                  className="hover:underline font-semibold"
                >
                  {isRTL
                    ? `${providerDisplayName} · مساحة رعاية معتمدة`
                    : `${providerDisplayName} · Sponsored Space`}
                </a>
              ) : (
                isRTL
                  ? `${providerDisplayName} · مساحة رعاية معتمدة`
                  : `${providerDisplayName} · Sponsored Space`
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals & Workspaces */}
      <ResearchModal
        isOpen={activeModal === 'research'}
        onClose={() => setActiveModal(null)}
        sourceContent={extractedContent}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      <SolveModal
        isOpen={activeModal === 'solve'}
        onClose={() => setActiveModal(null)}
        documentContext={extractedContent}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      <QuestionsModal
        isOpen={activeModal === 'questions'}
        onClose={() => setActiveModal(null)}
        documentContent={extractedContent}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      <TranslateModal
        isOpen={activeModal === 'translate'}
        onClose={() => setActiveModal(null)}
        documentContent={extractedContent}
        fileName={selectedFile?.name}
        uploadedFile={selectedFile}
        onSaveFile={handleSaveFile}
        onTranslateComplete={(res) => setTranslatedResult(res)}
        checkAdOrVIP={checkAdOrVIP}
        initialOptions={translationOptions || undefined}
      />

      <ConvertModal
        isOpen={activeModal === 'convert'}
        onClose={() => setActiveModal(null)}
        documentContent={extractedContent}
        fileName={selectedFile?.name}
        selectedFile={selectedFile}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      <VoiceModal
        isOpen={activeModal === 'voice'}
        onClose={() => setActiveModal(null)}
        documentContent={extractedContent}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      <ImageModal
        isOpen={activeModal === 'image'}
        onClose={() => setActiveModal(null)}
        onSaveFile={handleSaveFile}
        checkAdOrVIP={checkAdOrVIP}
      />

      {/* System & Support Modals */}
      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdCompleted={handleAdCompleted}
        onOpenVIP={() => {
          setShowAdModal(false);
          setActiveModal('subscriptions');
        }}
        adPlatformEnabled={Boolean(adConfig?.enabled)}
        providerLabel={providerDisplayName}
        directLinkUrl={adConfig?.enabled ? adConfig.directLinkUrl : undefined}
      />

      <StreakRewardModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
      />

      <WhatsAppChatModal
        isOpen={activeModal === 'chat'}
        onClose={() => setActiveModal(null)}
        currentUser={effectiveUser}
      />

      {hasAdminPrivilege && (
        <AdminDashboardModal
          isOpen={activeModal === 'admin' && hasAdminPrivilege && !isTrialSimulation}
          onClose={() => setActiveModal(null)}
          currentUser={currentUser}
          isAuthorizedAdmin={hasAdminPrivilege}
          onOpenChat={() => setActiveModal('chat')}
          isTrialSimulation={isTrialSimulation}
          onToggleTrialSimulation={handleToggleTrialSimulation}
          trialUsageCount={trialUsageCount}
          onResetTrial={handleResetTrial}
        />
      )}

      <UserProfileModal
        isOpen={activeModal === 'profile'}
        onClose={() => setActiveModal(null)}
        currentUser={effectiveUser}
        onOpenAuth={() => setActiveModal('auth')}
        onUpdateUser={(updated) => {
          const synced = syncUserToRegistry(updated);
          setCurrentUser(synced);
          try {
            localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(synced));
          } catch {
            // Ignore quota issues
          }
        }}
      />

      <SubscriptionsModal
        isOpen={activeModal === 'subscriptions'}
        onClose={() => setActiveModal(null)}
        currentUser={effectiveUser}
        onUpgradeVIP={handleUpgradeVIP}
      />

      <MyFilesModal
        isOpen={activeModal === 'my-files'}
        onClose={() => setActiveModal(null)}
        currentUser={effectiveUser}
      />

      <AuthModal
        isOpen={activeModal === 'auth'}
        onClose={() => setActiveModal(null)}
        isSecretAdmin={isSecretAdminParam}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          try {
            localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(user));
          } catch {
            // Ignore quota issues
          }
          if (!user.isAdmin && !isSecretAdminParam) {
            setIsTrialSimulation(false);
            localStorage.setItem('metany_admin_trial_mode', 'false');
          }
        }}
      />
    </div>
  );
}
