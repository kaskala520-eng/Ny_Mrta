import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  EyeOff,
  Eye,
  Crown,
  Trash2,
  BarChart3,
  Edit3,
  Save,
  Check,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Github,
  Megaphone,
  Globe,
  Ban,
  Terminal,
  Send,
  Search,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  Volume2,
  Play,
  Loader2,
  ExternalLink,
  Bell,
  Clock,
  Calendar,
  CheckCheck,
} from 'lucide-react';
import { AdminStats, ChatMessage, CommandLogEntry, DynamicPageContent, User } from '../../types';
import { AdminGitHubSyncPanel } from './AdminGitHubSyncPanel';
import { AdminAnnouncementsPanel } from './AdminAnnouncementsPanel';
import { AdminAdsPanel } from './AdminAdsPanel';
import { useLanguage } from '../../i18n/LanguageContext';
import { getOfflineFiles } from '../../utils/offlineDb';
import {
  LOCAL_PAGES_STORAGE_KEY,
  LOCAL_PAGES_UPDATED_EVENT,
  LOCAL_USER_STORAGE_KEY,
  USERS_UPDATED_EVENT,
} from '../../App';
import {
  ADMIN_NOTIFICATIONS_EVENT,
  COMMANDS_UPDATED_EVENT,
  CONTACT_MESSAGES_STORAGE_KEY,
  StoredAdminNotification,
  clearAdminNotifications,
  clearClientCommandLogs,
  fetchAdminNotificationsMerged,
  getRegisteredUsers,
  markAllAdminNotificationsRead,
  saveAllRegisteredUsers,
} from '../../utils/adminTracking';
import {
  AllowedRetentionDays,
  computeExpiryMeta,
  fetchAllOrdersMerged,
  fetchRetentionDaysSetting,
  formatDateDDMMYYYY,
  getRetentionDaysSettingSync,
  permanentlyDeleteOrderFilesFromServer,
  runClientAndServerAutoDeleteSweep,
  saveRetentionDaysSetting,
  triggerRealServerFileDownload,
} from '../../utils/cloudStorage';
import {
  AD_PLATFORM_STORAGE_KEY,
  AD_PLATFORM_UPDATED_EVENT,
  readLocalAdConfig,
} from '../AdPlatformManager';
import { CONTACT_UPDATED_EVENT } from './WhatsAppChatModal';

type PreviewKind = 'pdf' | 'image' | 'audio' | 'text' | 'word' | 'other';

function detectPreviewKind(fileName?: string, mimeType?: string): PreviewKind {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (
    /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(name) ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (
    /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/.test(name) ||
    mime.startsWith('audio/')
  ) {
    return 'audio';
  }
  if (
    /\.(docx?)$/.test(name) ||
    mime.includes('msword') ||
    mime.includes('wordprocessingml')
  ) {
    return 'word';
  }
  if (
    /\.(txt|md|csv|json|log|rtf)$/.test(name) ||
    mime.startsWith('text/')
  ) {
    return 'text';
  }
  return 'other';
}

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isAuthorizedAdmin?: boolean;
  onOpenChat: () => void;
  isTrialSimulation?: boolean;
  onToggleTrialSimulation?: () => void;
  trialUsageCount?: number;
  onResetTrial?: (count: number) => void;
}

const DEFAULT_PAGES: DynamicPageContent[] = [
  {
    id: 'page_welcome',
    key: 'hero_welcome',
    title: 'بانر الترحيب الرئيسي',
    content: 'مرحباً بك في Meta.Ny - مساحتك الذكية للمستندات والترجمة والأسئلة والصوت والبحوث.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_notice',
    key: 'bottom_notice',
    title: 'شريط التنبيه السفلي',
    content:
      'يمكنك الآن استخدام التطبيق مجاناً مرّة واحدة، وبعد ذلك يمكنك مشاهدة 3 إعلانات أو الاشتراك في أحد الباقات.',
    updatedAt: new Date().toISOString(),
  },
];

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isAuthorizedAdmin = false,
  onOpenChat,
  isTrialSimulation = false,
  onToggleTrialSimulation,
  trialUsageCount = 0,
  onResetTrial,
}) => {
  const { isRTL } = useLanguage();
  const [stats, setStats] = useState<
    (AdminStats & {
      totalVisits: number;
      totalCommands: number;
      bannedUsers: number;
      adImpressions: number;
      adClicks: number;
    }) | null
  >(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [commandLogs, setCommandLogs] = useState<CommandLogEntry[]>([]);
  const [commandFilter, setCommandFilter] = useState('');
  const [commandStatusFilter, setCommandStatusFilter] = useState<'all' | CommandLogEntry['status']>('all');
  const [commandCategoryFilter, setCommandCategoryFilter] = useState<string>('all');
  const [expandedCommandId, setExpandedCommandId] = useState<string | null>(null);
  const [contactMessages, setContactMessages] = useState<ChatMessage[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('all');
  const [adminReplyText, setAdminReplyText] = useState('');
  const [globalAdsEnabled, setGlobalAdsEnabled] = useState<boolean>(true);
  const [pagesList, setPagesList] = useState<DynamicPageContent[]>([]);
  const [activeTab, setActiveTab] = useState<
    'stats' | 'notifications' | 'users' | 'commands' | 'messages' | 'pages' | 'announcements' | 'ads' | 'github'
  >('stats');
  const [editingPage, setEditingPage] = useState<DynamicPageContent | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Admin Real-Time Notifications & Auto-Delete Retention Settings
  const [adminNotifications, setAdminNotifications] = useState<StoredAdminNotification[]>([]);
  const [notifTypeFilter, setNotifTypeFilter] = useState<'all' | 'new_order' | 'banned_attempt' | 'auto_delete'>('all');
  const [liveAdminBanner, setLiveAdminBanner] = useState<StoredAdminNotification | null>(null);
  const [retentionDays, setRetentionDays] = useState<AllowedRetentionDays>(() => getRetentionDaysSettingSync());
  const [savingRetention, setSavingRetention] = useState(false);

  // Manual VIP activation form state
  const [vipTargetUserId, setVipTargetUserId] = useState<string>('');
  const [vipExpiryDate, setVipExpiryDate] = useState<string>('2026-12-31');
  const [adminActionToast, setAdminActionToast] = useState<string | null>(null);

  // Admin Orders Preview / Download / Permanent Delete state
  const [previewState, setPreviewState] = useState<{
    order: CommandLogEntry;
    target: 'original' | 'result';
    textContent: string;
    loadingText: boolean;
    error: string | null;
  } | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);

  const hasPermission = Boolean(isAuthorizedAdmin || currentUser?.isAdmin);

  const showActionBanner = (msg: string) => {
    setAdminActionToast(msg);
    setTimeout(() => setAdminActionToast(null), 4000);
  };

  const loadLocalAdminData = useCallback(async () => {
    if (!hasPermission) return;
    try {
      // Automatic cleanup sweep whenever Admin opens dashboard
      const sweep = await runClientAndServerAutoDeleteSweep(hasPermission);
      if (sweep.deletedCount > 0) {
        setAdminActionToast(
          isRTL
            ? `تم تنفيذ الحذف التلقائي لـ ${sweep.deletedCount} ملف منتهي الصلاحية من السيرفر والتخزين`
            : `Auto-deleted ${sweep.deletedCount} expired file(s)`
        );
      }

      const [retDays, files] = await Promise.all([
        fetchRetentionDaysSetting(),
        getOfflineFiles(),
      ]);
      setRetentionDays(retDays);

      let users = getRegisteredUsers();
      if (!Array.isArray(users) || users.length === 0) {
        const localCurrentRaw = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
        const localCurrent: User = localCurrentRaw
          ? JSON.parse(localCurrentRaw)
          : {
              id: 'local_user',
              name: isRTL ? 'مستخدم محلي' : 'Local User',
              email: '',
              isAdmin: false,
              isVIP: false,
              hideAds: false,
              isBanned: false,
              usageCount: 0,
              visitCount: 1,
              dailyStreak: 1,
              lastLoginDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
            };
        users = [localCurrent];
        saveAllRegisteredUsers(users);
      }
      setUsersList(users);
      if (users.length > 0 && !vipTargetUserId) {
        setVipTargetUserId(users[0].id);
      }

      const [logs, notifs] = await Promise.all([
        fetchAllOrdersMerged(hasPermission),
        fetchAdminNotificationsMerged(),
      ]);
      setCommandLogs(logs);
      setAdminNotifications(notifs);

      try {
        const rawMsgs = localStorage.getItem(CONTACT_MESSAGES_STORAGE_KEY);
        const parsedMsgs = rawMsgs ? JSON.parse(rawMsgs) : [];
        setContactMessages(Array.isArray(parsedMsgs) ? parsedMsgs : []);
      } catch {
        setContactMessages([]);
      }

      const adCfg = readLocalAdConfig();
      setGlobalAdsEnabled(Boolean(adCfg?.enabled));

      const rawPages = localStorage.getItem(LOCAL_PAGES_STORAGE_KEY);
      let pages: DynamicPageContent[] = rawPages ? JSON.parse(rawPages) : DEFAULT_PAGES;
      if (!Array.isArray(pages) || pages.length === 0) {
        pages = DEFAULT_PAGES;
        localStorage.setItem(LOCAL_PAGES_STORAGE_KEY, JSON.stringify(pages));
      }
      setPagesList(pages);

      const totalUsage = users.reduce((sum, u) => sum + (u.usageCount || 0), 0) + files.length;
      const totalVisits = users.reduce((sum, u) => sum + (u.visitCount || 1), 0);
      const vipCount = users.filter((u) => u.isVIP).length;
      const bannedCount = users.filter((u) => u.isBanned).length;
      const countsByService: Record<string, number> = {};
      files.forEach((f) => {
        countsByService[f.serviceUsed] = (countsByService[f.serviceUsed] || 0) + 1;
      });
      logs.forEach((l) => {
        if (l.status === 'success') {
          countsByService[l.command] = (countsByService[l.command] || 0) + 1;
        }
      });
      const totalActivity = Math.max(
        Object.values(countsByService).reduce((a, b) => a + b, 0),
        1
      );

      setStats({
        totalUsers: users.length,
        totalVisits,
        totalCommands: logs.length,
        bannedUsers: bannedCount,
        adImpressions: adCfg?.stats?.impressions || 0,
        adClicks: adCfg?.stats?.directLinkClicks || 0,
        dailyUsage: totalUsage,
        weeklyUsage: totalUsage,
        monthlyUsage: totalUsage,
        vipSubscribers: vipCount,
        estimatedAdRevenue: 0,
        topServices: [
          {
            name: isRTL ? 'ترجمة المستندات والصور' : 'Document & Image Translation',
            count: countsByService.translate || 0,
            percentage: Math.round(((countsByService.translate || 0) / totalActivity) * 100),
          },
          {
            name: isRTL ? 'توليد الأسئلة والأجوبة' : 'Questions & Answers',
            count: countsByService.questions || 0,
            percentage: Math.round(((countsByService.questions || 0) / totalActivity) * 100),
          },
          {
            name: isRTL ? 'كتابة البحوث والتقارير' : 'Academic Research',
            count: countsByService.research || 0,
            percentage: Math.round(((countsByService.research || 0) / totalActivity) * 100),
          },
          {
            name: isRTL ? 'تحويل الملفات والصوت والـ PDF الصوتي' : 'Converter, Voice & Audio PDF',
            count: (countsByService.convert || 0) + (countsByService.voice || 0),
            percentage: Math.round(
              (((countsByService.convert || 0) + (countsByService.voice || 0)) / totalActivity) * 100
            ),
          },
        ],
      });
    } catch (err) {
      console.error(err);
    }
  }, [hasPermission, isRTL, vipTargetUserId]);

  useEffect(() => {
    if (!isOpen || !hasPermission) return;
    loadLocalAdminData();

    const syncMsgs = () => {
      try {
        const rawMsgs = localStorage.getItem(CONTACT_MESSAGES_STORAGE_KEY);
        const parsed = rawMsgs ? JSON.parse(rawMsgs) : [];
        setContactMessages(Array.isArray(parsed) ? parsed : []);
      } catch {
        // ignore
      }
    };
    const syncCommands = () => {
      fetchAllOrdersMerged(hasPermission).then(setCommandLogs).catch(() => {});
    };
    const syncNotifications = (ev: Event) => {
      const customEv = ev as CustomEvent<StoredAdminNotification | undefined>;
      if (customEv?.detail) {
        setLiveAdminBanner(customEv.detail);
        setTimeout(() => {
          setLiveAdminBanner((curr) => (curr?.id === customEv.detail?.id ? null : curr));
        }, 6500);
      }
      fetchAdminNotificationsMerged().then(setAdminNotifications).catch(() => {});
    };
    window.addEventListener(CONTACT_UPDATED_EVENT, syncMsgs);
    window.addEventListener(COMMANDS_UPDATED_EVENT, syncCommands);
    window.addEventListener(ADMIN_NOTIFICATIONS_EVENT, syncNotifications);
    return () => {
      window.removeEventListener(CONTACT_UPDATED_EVENT, syncMsgs);
      window.removeEventListener(COMMANDS_UPDATED_EVENT, syncCommands);
      window.removeEventListener(ADMIN_NOTIFICATIONS_EVENT, syncNotifications);
    };
  }, [isOpen, hasPermission, loadLocalAdminData]);

  // Strict authorization guard: NEVER render anything unless user is verified Admin
  if (!isOpen || !hasPermission) return null;

  const persistUsers = (updated: User[]) => {
    setUsersList(updated);
    saveAllRegisteredUsers(updated);
    window.dispatchEvent(new Event(USERS_UPDATED_EVENT));
    loadLocalAdminData();
  };

  const handleToggleHideAds = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    const updated = usersList.map((u) =>
      u.id === userId ? { ...u, hideAds: !u.hideAds } : u
    );
    persistUsers(updated);
    showActionBanner(
      target?.hideAds
        ? isRTL
          ? `تم إظهار الإعلانات للمستخدم ${target.name}`
          : `Ads enabled for ${target.name}`
        : isRTL
        ? `تم إخفاء الإعلانات للمستخدم ${target?.name || ''}`
        : `Ads hidden for ${target?.name || ''}`
    );
  };

  const handleToggleVIP = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    const nextVip = !target?.isVIP;
    const updated = usersList.map((u) =>
      u.id === userId
        ? {
            ...u,
            isVIP: nextVip,
            hideAds: nextVip ? true : u.hideAds,
            vipExpiresAt: nextVip ? vipExpiryDate || '2026-12-31' : undefined,
          }
        : u
    );
    persistUsers(updated);
    showActionBanner(
      nextVip
        ? isRTL
          ? `👑 تم تفعيل VIP يدوياً للمستخدم ${target?.name || ''}`
          : `VIP activated for ${target?.name || ''}`
        : isRTL
        ? `تم إلغاء VIP عن ${target?.name || ''}`
        : `VIP deactivated for ${target?.name || ''}`
    );
  };

  const handleManualActivateVIP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipTargetUserId) return;
    const target = usersList.find((u) => u.id === vipTargetUserId);
    if (!target) return;

    const updated = usersList.map((u) =>
      u.id === vipTargetUserId
        ? {
            ...u,
            isVIP: true,
            hideAds: true,
            vipExpiresAt: vipExpiryDate || '2026-12-31',
          }
        : u
    );
    persistUsers(updated);
    showActionBanner(
      isRTL
        ? `✅ تم تفعيل اشتراك VIP يدوياً لـ "${target.name}" حتى ${vipExpiryDate}`
        : `✅ VIP manually activated for "${target.name}" until ${vipExpiryDate}`
    );
  };

  const handleToggleBan = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (target?.isAdmin) {
      showActionBanner(isRTL ? 'لا يمكن حظر حساب إدارة موثق.' : 'Cannot ban an admin account.');
      return;
    }
    const nextBan = !target?.isBanned;
    const updated = usersList.map((u) =>
      u.id === userId ? { ...u, isBanned: nextBan } : u
    );
    persistUsers(updated);
    showActionBanner(
      nextBan
        ? isRTL
          ? `🚫 تم حظر المستخدم "${target?.name || ''}" ومنع وصوله للأدوات`
          : `🚫 User "${target?.name || ''}" banned`
        : isRTL
        ? `✅ تم رفع الحظر عن "${target?.name || ''}"`
        : `✅ User "${target?.name || ''}" unbanned`
    );
  };

  const handleDeleteUser = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (target?.isAdmin && target.id === currentUser?.id) {
      showActionBanner(isRTL ? 'لا يمكنك حذف الجلسة الحالية.' : 'Cannot delete active session.');
      return;
    }
    const updated = usersList.filter((u) => u.id !== userId);
    persistUsers(updated);
  };

  const handleToggleGlobalAds = () => {
    try {
      const cfg = readLocalAdConfig() || { enabled: false, provider: 'hilltopads' as const };
      const nextEnabled = !cfg.enabled;
      const nextCfg = {
        ...cfg,
        enabled: nextEnabled,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(AD_PLATFORM_STORAGE_KEY, JSON.stringify(nextCfg));
      window.dispatchEvent(new Event(AD_PLATFORM_UPDATED_EVENT));
      setGlobalAdsEnabled(nextEnabled);
      showActionBanner(
        nextEnabled
          ? isRTL
            ? '👁️ تم إظهار الإعلانات في الموقع بنجاح'
            : 'Site-wide ads enabled'
          : isRTL
          ? '🙈 تم إخفاء الإعلانات من الموقع بالكامل'
          : 'Site-wide ads hidden'
      );
    } catch {
      // ignore
    }
  };

  const handleChangeRetentionDays = async (days: AllowedRetentionDays) => {
    if (!hasPermission) return;
    setSavingRetention(true);
    try {
      const saved = await saveRetentionDaysSetting(days);
      setRetentionDays(saved);
      showActionBanner(
        isRTL
          ? `✅ تم ضبط مدة الحذف التلقائي على ${saved} أيام (تطبق على الملفات الجديدة فقط)`
          : `✅ Retention updated to ${saved} days (applies to new files only)`
      );
    } finally {
      setSavingRetention(false);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    await markAllAdminNotificationsRead();
    setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showActionBanner(isRTL ? 'تم تحديد جميع الإشعارات كمقروءة' : 'All notifications marked as read');
  };

  const handleClearNotifs = async () => {
    await clearAdminNotifications();
    setAdminNotifications([]);
    showActionBanner(isRTL ? 'تم مسح سجل إشعارات الإدارة' : 'Admin notifications cleared');
  };

  const handleClearCommandLogs = () => {
    clearClientCommandLogs();
    setCommandLogs([]);
    loadLocalAdminData();
  };

  const LEGACY_MISSING_MSG =
    'هذا الملف قديم وغير محفوظ على السيرفر، لا يمكن فتحه، اطلب من المستخدم اعادة رفعه';

  const loadTextForPreview = async (
    order: CommandLogEntry,
    target: 'original' | 'result'
  ) => {
    const fileUrl =
      target === 'original' ? order.audit?.originalFileUrl : order.audit?.resultFileUrl;
    const fileName =
      target === 'original'
        ? order.audit?.attachedFileName || 'file'
        : order.audit?.resultFileName || 'result';
    const fileType =
      target === 'original'
        ? order.audit?.attachedFileType || ''
        : order.audit?.resultFileType || '';
    const kind = detectPreviewKind(fileName, fileType);

    if (kind !== 'text' || !fileUrl) {
      setPreviewState({
        order,
        target,
        textContent: '',
        loadingText: false,
        error: null,
      });
      return;
    }

    setPreviewState({
      order,
      target,
      textContent: '',
      loadingText: true,
      error: null,
    });
    try {
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      setPreviewState((prev) =>
        prev && prev.order.id === order.id && prev.target === target
          ? { ...prev, textContent: text, loadingText: false }
          : prev
      );
    } catch {
      setPreviewState((prev) =>
        prev && prev.order.id === order.id && prev.target === target
          ? {
              ...prev,
              loadingText: false,
              textContent:
                (target === 'original'
                  ? order.audit?.inputPreview
                  : order.audit?.outputPreview) || '',
              error: isRTL ? 'تعذر جلب نص الملف الكامل من السيرفر.' : 'Could not fetch full text.',
            }
          : prev
      );
    }
  };

  const handleAdminOpenPreview = async (log: CommandLogEntry) => {
    if (!hasPermission) return;
    if (log.audit?.filesDeletedFromServer) {
      showActionBanner(
        isRTL
          ? 'تم حذف ملفات هذا الطلب نهائياً من السيرفر مسبقاً.'
          : 'Files for this order were permanently deleted from the server.'
      );
      return;
    }
    const hasOriginal = Boolean(log.audit?.originalFileUrl);
    const hasResult = Boolean(log.audit?.resultFileUrl);
    if (!hasOriginal && !hasResult) {
      showActionBanner(LEGACY_MISSING_MSG);
      return;
    }
    const target: 'original' | 'result' = hasOriginal ? 'original' : 'result';
    await loadTextForPreview(log, target);
  };

  const handleAdminDownloadOriginal = async (log: CommandLogEntry) => {
    if (!hasPermission) return;
    if (log.audit?.filesDeletedFromServer) {
      showActionBanner(
        isRTL ? 'تم حذف الملف نهائياً من السيرفر.' : 'File was permanently deleted from server.'
      );
      return;
    }
    const url = log.audit?.originalFileUrl;
    if (!url) {
      showActionBanner(LEGACY_MISSING_MSG);
      return;
    }
    const key = `${log.id}_orig`;
    setDownloadingKey(key);
    try {
      await triggerRealServerFileDownload(
        url,
        log.audit?.attachedFileName || `order_${log.id}_original`
      );
      showActionBanner(isRTL ? 'تم تنزيل الملف الأصلي من السيرفر بنجاح' : 'Original file downloaded');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleAdminDownloadResult = async (log: CommandLogEntry) => {
    if (!hasPermission) return;
    if (log.audit?.filesDeletedFromServer) {
      showActionBanner(
        isRTL ? 'تم حذف الملف نهائياً من السيرفر.' : 'Result file was permanently deleted.'
      );
      return;
    }
    const url = log.audit?.resultFileUrl;
    if (!url) {
      showActionBanner(LEGACY_MISSING_MSG);
      return;
    }
    const key = `${log.id}_res`;
    setDownloadingKey(key);
    try {
      await triggerRealServerFileDownload(
        url,
        log.audit?.resultFileName || `order_${log.id}_result`
      );
      showActionBanner(isRTL ? 'تم تنزيل ملف النتيجة من السيرفر بنجاح' : 'Result file downloaded');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleAdminDeleteOrderFiles = async (log: CommandLogEntry) => {
    if (!hasPermission) return;
    setDeletingOrderId(log.id);
    try {
      await permanentlyDeleteOrderFilesFromServer(log);
      setCommandLogs((prev) =>
        prev.map((item) =>
          item.id === log.id
            ? {
                ...item,
                audit: {
                  ...(item.audit || {}),
                  originalFileUrl: '',
                  originalFileStoragePath: '',
                  resultFileUrl: '',
                  resultFileStoragePath: '',
                  filesDeletedFromServer: true,
                },
              }
            : item
        )
      );
      if (previewState?.order.id === log.id) {
        setPreviewState(null);
      }
      showActionBanner(
        isRTL
          ? '🗑️ تم حذف الملفات المرتبطة بهذا الطلب نهائياً من السيرفر'
          : '🗑️ Files permanently deleted from server'
      );
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleSendAdminReply = (e: React.FormEvent) => {
    e.preventDefault();
    const text = adminReplyText.trim();
    if (!text) return;

    const nowTime = new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const reply: ChatMessage = {
      id: `admin_reply_${Date.now()}`,
      senderId: currentUser?.id || 'local_secret_admin',
      senderName: isRTL ? 'الإدارة · Meta.Ny' : 'Meta.Ny Admin',
      senderRole: 'admin',
      recipientId: selectedRecipientId || 'all',
      content: text,
      timestamp: nowTime,
      read: true,
    };

    const next = [...contactMessages, reply].slice(-80);
    setContactMessages(next);
    setAdminReplyText('');
    try {
      localStorage.setItem(CONTACT_MESSAGES_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CONTACT_UPDATED_EVENT));
      showActionBanner(isRTL ? '✉️ تم إرسال رسالة الإدارة مباشرة للمستخدم' : 'Admin message sent');
    } catch {
      // ignore
    }
  };

  const handleSavePage = () => {
    if (!editingPage) return;
    const nextItem: DynamicPageContent = {
      ...editingPage,
      updatedAt: new Date().toISOString(),
    };
    const idx = pagesList.findIndex((p) => p.key === nextItem.key);
    const updated =
      idx >= 0
        ? pagesList.map((p, i) => (i === idx ? nextItem : p))
        : [...pagesList, nextItem];
    setPagesList(updated);
    localStorage.setItem(LOCAL_PAGES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(LOCAL_PAGES_UPDATED_EVENT));
    setEditingPage(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const filteredUsers = userSearch.trim()
    ? usersList.filter(
        (u) =>
          u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.id.toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : usersList;

  const filteredCommands = commandLogs.filter((c) => {
    const matchesStatus = commandStatusFilter === 'all' || c.status === commandStatusFilter;
    const matchesCat =
      commandCategoryFilter === 'all' ||
      c.command.toLowerCase() === commandCategoryFilter ||
      (commandCategoryFilter === 'files' &&
        (c.command === 'file_upload' || Boolean(c.audit?.attachedFileName)));
    const q = commandFilter.trim().toLowerCase();
    const matchesQuery =
      !q ||
      c.command.toLowerCase().includes(q) ||
      c.details.toLowerCase().includes(q) ||
      c.userName.toLowerCase().includes(q) ||
      (c.audit?.queryText && c.audit.queryText.toLowerCase().includes(q)) ||
      (c.audit?.attachedFileName && c.audit.attachedFileName.toLowerCase().includes(q)) ||
      (c.audit?.inputPreview && c.audit.inputPreview.toLowerCase().includes(q)) ||
      (c.audit?.outputPreview && c.audit.outputPreview.toLowerCase().includes(q));
    return matchesStatus && matchesCat && matchesQuery;
  });

  const unreadUserMsgsCount = contactMessages.filter((m) => m.senderRole === 'user' && !m.read).length;
  const unreadNotifsCount = adminNotifications.filter((n) => !n.read).length;
  const filteredNotifications =
    notifTypeFilter === 'all'
      ? adminNotifications
      : adminNotifications.filter((n) => n.type === notifTypeFilter);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        } transition-colors`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  {isRTL ? 'لوحة تحكم الإدارة الكاملة' : 'Admin Control Center'}
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  {isRTL ? 'حساب مشرف موثق' : 'Verified Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {isRTL
                  ? 'إحصائيات المستخدمين والزيارات، إخفاء/إظهار الإعلانات، تتبع الأوامر، الحظر، تفعيل VIP يدوياً، والتواصل المباشر'
                  : 'User stats, ad visibility toggle, executed command log, user bans, manual VIP activation & direct chat'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live real-time alert banner inside admin modal */}
        {liveAdminBanner && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 text-white ${
              liveAdminBanner.type === 'banned_attempt'
                ? 'bg-rose-600'
                : liveAdminBanner.type === 'auto_delete'
                ? 'bg-amber-600'
                : 'bg-indigo-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>
                <strong>{liveAdminBanner.title}:</strong> {liveAdminBanner.message}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('notifications');
                  setLiveAdminBanner(null);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] cursor-pointer"
              >
                {isRTL ? 'عرض الإشعارات' : 'View'}
              </button>
              <button
                type="button"
                onClick={() => setLiveAdminBanner(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Action confirmation toast */}
        {adminActionToast && (
          <div className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {adminActionToast}
            </span>
            <button onClick={() => setAdminActionToast(null)} className="text-white/80 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-3 bg-slate-50 dark:bg-slate-800/60 gap-2">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('stats')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'stats'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {isRTL ? 'الإحصائيات والزيارات' : 'Stats & Visits'}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              data-testid="admin-tab-notifications"
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'notifications'
                  ? 'border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isRTL ? 'التنبيهات الفورية' : 'Live Alerts'}</span>
              {unreadNotifsCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 rounded-full font-mono">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'users'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {isRTL ? `المستخدمون والحظر و VIP (${usersList.length})` : `Users, Ban & VIP (${usersList.length})`}
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'commands'
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{isRTL ? `تتبع الأوامر (${commandLogs.length})` : `Commands (${commandLogs.length})`}</span>
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'messages'
                  ? 'border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isRTL ? 'التواصل المباشر' : 'Direct Chat'}</span>
              {unreadUserMsgsCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 rounded-full font-mono">
                  {unreadUserMsgsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'pages'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {isRTL ? 'النصوص' : 'Content'}
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              data-testid="admin-tab-announcements"
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'announcements'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{isRTL ? 'الإعلانات العامة' : 'Announcements'}</span>
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              data-testid="admin-tab-ads"
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'ads'
                  ? 'border-emerald-600 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isRTL ? 'الإعلانات' : 'Ads'}</span>
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'github'
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>{isRTL ? 'ZIP' : 'ZIP'}</span>
            </button>
          </div>

          <button
            onClick={handleToggleGlobalAds}
            data-testid="global-ads-toggle-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors mb-2 cursor-pointer ${
              globalAdsEnabled
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {globalAdsEnabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>
              {globalAdsEnabled
                ? isRTL
                  ? 'إخفاء كل الإعلانات'
                  : 'Hide All Ads'
                : isRTL
                ? 'إظهار الإعلانات'
                : 'Show All Ads'}
            </span>
          </button>
        </div>

        {/* Tab 1: Stats & Visits */}
        {activeTab === 'stats' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/30 p-5 rounded-3xl border-2 border-amber-300 dark:border-amber-700/70 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {isRTL
                        ? 'معاينة تجربة المستخدم العادي (Preview Mode)'
                        : 'User Trial Simulation Preview'}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {isRTL
                        ? 'اختبار واجهة الموقع تماماً كما يراها الزائر العادي'
                        : 'Preview the site exactly as a public visitor experiences it'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onToggleTrialSimulation}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                    isTrialSimulation
                      ? 'bg-amber-600 text-white ring-2 ring-amber-300 dark:ring-amber-500/60'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {isTrialSimulation ? '⚡ وضع المعاينة نَشِط' : '🎮 تفعيل معاينة المستخدم'}
                </button>
              </div>

              {isTrialSimulation && (
                <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                    الاستخدام الحالي:{' '}
                    <span className="font-bold font-mono px-2 py-0.5 bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 rounded-md">
                      {trialUsageCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onResetTrial?.(0)}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>تصفير (0)</span>
                    </button>
                    <button
                      onClick={() => onResetTrial?.(1)}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                    >
                      ضبط على (1)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'المستخدمون' : 'Total Users'}
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
                  {stats?.totalUsers || 1}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'زيارات الموقع' : 'Site Visits'}
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {stats?.totalVisits || 1}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'الأوامر المنفذة' : 'Commands'}
                </span>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  {Math.max(stats?.dailyUsage || 0, stats?.totalCommands || 0)}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'حسابات VIP' : 'VIP Accounts'}
                </span>
                <div className="text-2xl font-black text-amber-500 dark:text-amber-400 mt-1 font-mono">
                  {stats?.vipSubscribers || 0}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'المحظورون' : 'Banned'}
                </span>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                  {stats?.bannedUsers || 0}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {isRTL ? 'مشاهدات الإعلانات' : 'Ad Views'}
                </span>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                  {stats?.adImpressions || 0}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isRTL ? 'توزيع استخدام الأدوات الفعلي' : 'Live Tool Usage Breakdown'}</span>
              </h4>

              <div className="space-y-3">
                {stats?.topServices?.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                      <span>{item.name}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin-Only Automatic File Deletion Settings */}
            <div className="bg-slate-50 dark:bg-slate-800/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {isRTL ? 'إعدادات الحذف التلقائي للملفات' : 'Automatic File Deletion Policy'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isRTL
                        ? 'تحديد مدة بقاء الملفات المرفوعة والنتائج في السيرفر قبل الحذف التلقائي (تطبق على الملفات الجديدة فقط)'
                        : 'Select file retention period before automatic deletion (applies to new files only)'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {isRTL ? 'تطبق على الملفات الجديدة فقط' : 'Applies to new files only'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {([
                  { days: 3 as AllowedRetentionDays, label: '3 ايام', enLabel: '3 Days' },
                  { days: 7 as AllowedRetentionDays, label: '7 ايام (افتراضي)', enLabel: '7 Days (Default)' },
                  { days: 14 as AllowedRetentionDays, label: '14 يوم', enLabel: '14 Days' },
                  { days: 30 as AllowedRetentionDays, label: '30 يوم', enLabel: '30 Days' },
                ]).map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    disabled={savingRetention}
                    onClick={() => handleChangeRetentionDays(opt.days)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      retentionDays === opt.days
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {isRTL ? opt.label : opt.enLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Real-Time Admin Notifications */}
        {activeTab === 'notifications' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: isRTL ? `الكل (${adminNotifications.length})` : `All (${adminNotifications.length})` },
                  { id: 'new_order', label: isRTL ? 'طلبات جديدة' : 'New Orders' },
                  { id: 'banned_attempt', label: isRTL ? 'محاولات المحظورين' : 'Banned Attempts' },
                  { id: 'auto_delete', label: isRTL ? 'الحذف التلقائي' : 'Auto-Deleted' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setNotifTypeFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      notifTypeFilter === f.id
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllNotifsRead}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'تحديد الكل كمقروء' : 'Mark All Read'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearNotifs}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'مسح السجل' : 'Clear Alerts'}</span>
                </button>
              </div>
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'لا توجد إشعارات حالياً. سيصلك تنبيه فوري عند تنفيذ أي طلب جديد أو محاولة مستخدم محظور الوصول لأي أداة أو عند الحذف التلقائي.'
                  : 'No notifications yet.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-2xl border transition-colors flex flex-wrap items-start justify-between gap-3 ${
                      notif.type === 'banned_attempt'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/80'
                        : notif.type === 'auto_delete'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80'
                        : 'bg-blue-50/50 dark:bg-slate-800/70 border-blue-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                        )}
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${
                            notif.type === 'banned_attempt'
                              ? 'bg-rose-600 text-white'
                              : notif.type === 'auto_delete'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {notif.type === 'banned_attempt'
                            ? isRTL
                              ? 'محاولة محظور 🚫'
                              : 'Banned Attempt'
                            : notif.type === 'auto_delete'
                            ? isRTL
                              ? 'حذف تلقائي 🗑️'
                              : 'Auto Deleted'
                            : isRTL
                            ? 'طلب جديد ⚡'
                            : 'New Order'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {notif.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {new Date(notif.timestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                      </span>
                      {notif.orderId && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('commands')}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                        >
                          {isRTL ? 'عرض في الأوامر' : 'View Order'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Users, Manual VIP Activation, Ban & Ad Controls */}
        {activeTab === 'users' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Manual VIP Activation Card */}
            <form
              onSubmit={handleManualActivateVIP}
              className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'تفعيل ميزة الـ VIP يدوياً لمستخدم محدد' : 'Manually Activate VIP for User'}</span>
                </label>
                <select
                  value={vipTargetUserId}
                  onChange={(e) => setVipTargetUserId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email || u.id}) {u.isVIP ? '— VIP ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                  {isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}
                </label>
                <input
                  type="date"
                  value={vipExpiryDate}
                  onChange={(e) => setVipExpiryDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'تفعيل VIP الآن' : 'Activate VIP'}</span>
              </button>
            </form>

            {/* Search & Global Ads Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`w-4 h-4 text-slate-400 absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={isRTL ? 'ابحث عن مستخدم بالاسم أو المعرّف أو البريد...' : 'Search user...'}
                  className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${
                    isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  } py-2 text-xs text-slate-800 dark:text-slate-100`}
                />
              </div>

              <button
                onClick={handleToggleGlobalAds}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  globalAdsEnabled
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {globalAdsEnabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>
                  {globalAdsEnabled
                    ? isRTL
                      ? 'إخفاء الإعلانات عن الموقع بالكامل'
                      : 'Hide Site-Wide Ads'
                    : isRTL
                    ? 'إظهار الإعلانات بالموقع'
                    : 'Show Site-Wide Ads'}
                </span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">{isRTL ? 'المستخدم' : 'User'}</th>
                    <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3">{isRTL ? 'الزيارات' : 'Visits'}</th>
                    <th className="p-3">{isRTL ? 'الأوامر' : 'Uses'}</th>
                    <th className="p-3">{isRTL ? 'الإعلانات' : 'Ads'}</th>
                    <th className="p-3 text-center">{isRTL ? 'تحكم الإدارة' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors ${
                        u.isBanned ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                          {u.email ? `${u.email} · ` : ''}
                          {u.id}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.isVIP ? (
                            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md">
                              VIP 👑 {u.vipExpiresAt ? `(${u.vipExpiresAt})` : ''}
                            </span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-2 py-0.5 rounded-md">
                              Standard
                            </span>
                          )}
                          {u.isBanned && (
                            <span className="bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold px-2 py-0.5 rounded-md">
                              {isRTL ? 'محظور 🚫' : 'Banned'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {u.visitCount || 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {u.usageCount || 0}
                      </td>
                      <td className="p-3">
                        {u.hideAds ? (
                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded font-bold">
                            {isRTL ? 'مخفية' : 'Hidden'}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {isRTL ? 'ظاهرة' : 'Visible'}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleHideAds(u.id)}
                            title={isRTL ? 'إخفاء/إظهار الإعلانات لهذا المستخدم' : 'Toggle Ads'}
                            className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            {u.hideAds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleToggleVIP(u.id)}
                            title={isRTL ? 'تفعيل/إلغاء VIP' : 'Toggle VIP'}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              u.isVIP
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRecipientId(u.id);
                              setActiveTab('messages');
                            }}
                            title={isRTL ? 'مراسلة هذا المستخدم مباشرة' : 'Message User'}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleBan(u.id)}
                            disabled={Boolean(u.isAdmin)}
                            title={u.isBanned ? (isRTL ? 'إلغاء الحظر' : 'Unban') : isRTL ? 'حظر المستخدم' : 'Ban User'}
                            className={`p-1.5 rounded-lg border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.isBanned
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={Boolean(u.isAdmin && u.id === currentUser?.id)}
                            title={isRTL ? 'حذف المستخدم' : 'Delete User'}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Executed User Commands & Search/File Audit Log */}
        {activeTab === 'commands' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: isRTL ? 'الكل' : 'All' },
                { id: 'questions', label: isRTL ? 'استخراج الأسئلة' : 'Questions' },
                { id: 'research', label: isRTL ? 'البحوث العلمية' : 'Research' },
                { id: 'translate', label: isRTL ? 'الترجمة' : 'Translation' },
                { id: 'files', label: isRTL ? 'الملفات المرفقة' : 'Attached Files' },
                { id: 'voice', label: isRTL ? 'الصوت والـ PDF الصوتي' : 'Voice / Audio PDF' },
                { id: 'image', label: isRTL ? 'الصور' : 'Images' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCommandCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    commandCategoryFilter === cat.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`w-4 h-4 text-slate-400 absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={commandFilter}
                  onChange={(e) => setCommandFilter(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'ابحث في الأسئلة، البحوث، الترجمة، أو أسماء الملفات المرفقة...'
                      : 'Search queries, files, Q&As, research, translations...'
                  }
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ${
                    isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
                  } py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500`}
                />
              </div>

              <select
                value={commandStatusFilter}
                onChange={(e) => setCommandStatusFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="all">{isRTL ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="success">{isRTL ? 'مكتمل بنجاح' : 'Success'}</option>
                <option value="started">{isRTL ? 'طلب تشغيل أداة' : 'Started'}</option>
                <option value="blocked">{isRTL ? 'مرفوض (محظور)' : 'Blocked'}</option>
              </select>

              <button
                onClick={loadLocalAdminData}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleClearCommandLogs}
                className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isRTL ? 'مسح السجل' : 'Clear Log'}</span>
              </button>
            </div>

            {/* Admin Retention Quick Bar inside Orders */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>{isRTL ? 'مدة الحذف التلقائي للملفات:' : 'Auto-Delete Retention:'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  {isRTL ? 'تطبق على الملفات الجديدة فقط' : 'New files only'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { days: 3 as AllowedRetentionDays, label: '3 ايام' },
                  { days: 7 as AllowedRetentionDays, label: '7 ايام (افتراضي)' },
                  { days: 14 as AllowedRetentionDays, label: '14 يوم' },
                  { days: 30 as AllowedRetentionDays, label: '30 يوم' },
                ]).map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    disabled={savingRetention}
                    onClick={() => handleChangeRetentionDays(opt.days)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                      retentionDays === opt.days
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'لا توجد أوامر أو عمليات بحث مطابقة حالياً. سيظهر هنا كل ما تم البحث عنه في الأسئلة والبحوث والترجمة والملفات المرفقة.'
                  : 'No matching executed commands or search audits recorded yet.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCommands.map((log) => {
                  const isExpanded = expandedCommandId === log.id;
                  const expMeta = computeExpiryMeta(
                    log.timestamp,
                    log.audit?.retentionDays,
                    log.audit?.expiresAt
                  );
                  const isAutoDeleted = Boolean(log.audit?.autoDeleted);
                  const hasAuditContent = Boolean(
                    log.audit?.queryText ||
                      log.audit?.attachedFileName ||
                      log.audit?.inputPreview ||
                      log.audit?.outputPreview
                  );

                  return (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 overflow-hidden"
                    >
                      <div className="p-3.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                            {log.command}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {log.userName}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-md">
                            {log.audit?.queryText || log.details}
                          </span>
                          {log.audit?.attachedFileName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800">
                              <Paperclip className="w-3 h-3" />
                              <span>{log.audit.attachedFileName}</span>
                              {log.audit.attachedFileSize ? (
                                <span className="font-mono opacity-80">
                                  ({(log.audit.attachedFileSize / 1024).toFixed(1)} KB)
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                          </span>
                          {log.status === 'success' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                              {isRTL ? 'مكتمل ✓' : 'Done ✓'}
                            </span>
                          ) : log.status === 'blocked' ? (
                            <span className="text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {isRTL ? 'محظور 🚫' : 'Blocked'}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                              {isRTL ? 'بدء ⏳' : 'Started'}
                            </span>
                          )}

                          {hasAuditContent && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCommandId(isExpanded ? null : log.id)
                              }
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : isRTL ? 'معاينة التفاصيل' : 'Inspect'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Admin-Only Orders Retention Dates & File Actions Toolbar */}
                      {hasPermission && (
                        <div className="px-3.5 pb-3 space-y-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5 bg-white/60 dark:bg-slate-900/40">
                          {/* Upload Date, Auto-Delete Date & Countdown */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span>تاريخ الرفع: {expMeta.uploadedDateFormatted}</span>
                            </span>

                            {isAutoDeleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <Clock className="w-3 h-3" />
                                <span>
                                  تم حذف الملف تلقائيا
                                  {log.audit?.autoDeletedAt
                                    ? ` بتاريخ ${formatDateDDMMYYYY(log.audit.autoDeletedAt)}`
                                    : ''}
                                </span>
                              </span>
                            ) : log.audit?.filesDeletedFromServer ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                تم حذف الملف يدوياً من السيرفر
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <Calendar className="w-3 h-3" />
                                  <span>سيتم الحذف في {expMeta.expiresDateFormatted}</span>
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                    expMeta.remainingDays <= 1
                                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                      : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>باقي {expMeta.remainingDays} ايام للحذف</span>
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAdminOpenPreview(log)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isRTL ? 'عرض / فتح' : 'Open / Preview'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAdminDownloadOriginal(log)}
                                disabled={downloadingKey === `${log.id}_orig`}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-60"
                              >
                                {downloadingKey === `${log.id}_orig` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>{isRTL ? 'تحميل' : 'Download Original'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAdminDownloadResult(log)}
                                disabled={downloadingKey === `${log.id}_res`}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-60"
                              >
                                {downloadingKey === `${log.id}_res` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FileDown className="w-3.5 h-3.5" />
                                )}
                                <span>{isRTL ? 'تحميل النتيجة' : 'Download Result'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAdminDeleteOrderFiles(log)}
                                disabled={
                                  deletingOrderId === log.id ||
                                  Boolean(log.audit?.filesDeletedFromServer) ||
                                  Boolean(log.audit?.autoDeleted) ||
                                  (!log.audit?.originalFileUrl && !log.audit?.resultFileUrl)
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                              >
                                {deletingOrderId === log.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>{isRTL ? 'حذف الان' : 'Delete Now'}</span>
                              </button>
                            </div>

                            <div className="text-[10px] font-bold">
                              {isAutoDeleted ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  تم حذف الملف تلقائيا
                                </span>
                              ) : log.audit?.filesDeletedFromServer ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {isRTL ? 'تم حذف الملفات نهائياً من السيرفر' : 'Deleted from server'}
                                </span>
                              ) : !log.audit?.originalFileUrl && !log.audit?.resultFileUrl ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  هذا الملف قديم وغير محفوظ على السيرفر، لا يمكن فتحه، اطلب من المستخدم اعادة رفعه
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  {log.audit?.originalFileUrl && log.audit?.resultFileUrl
                                    ? isRTL
                                      ? '✓ الأصل + النتيجة محفوظان على السيرفر'
                                      : '✓ Original + Result saved'
                                    : log.audit?.resultFileUrl
                                    ? isRTL
                                      ? '✓ النتيجة محفوظة على السيرفر'
                                      : '✓ Result saved'
                                    : isRTL
                                    ? '✓ الملف الأصلي محفوظ على السيرفر'
                                    : '✓ Original saved'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {isExpanded && log.audit && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 space-y-2.5 text-xs">
                          {log.audit.queryText && (
                            <div>
                              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                                {isRTL ? 'ما تم البحث عنه / تفاصيل الطلب:' : 'Query / Request Details:'}
                              </div>
                              <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                                {log.audit.queryText}
                              </div>
                            </div>
                          )}

                          {log.audit.attachedFileName && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>
                                {isRTL ? 'الملف المرفق:' : 'Attached File:'} {log.audit.attachedFileName}
                              </span>
                              {log.audit.attachedFileType && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                  {log.audit.attachedFileType}
                                </span>
                              )}
                            </div>
                          )}

                          {log.audit.inputPreview && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                                {isRTL ? 'النص الأصلي / محتوى الملف المرفق:' : 'Source Input / Attached Content:'}
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {log.audit.inputPreview}
                              </div>
                            </div>
                          )}

                          {log.audit.outputPreview && (
                            <div>
                              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                                {isRTL ? 'النتيجة المولدة (الأسئلة / البحث / الترجمة):' : 'Generated Result:'}
                              </div>
                              <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 text-slate-800 dark:text-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {log.audit.outputPreview}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: User-Admin Two-Way Inbox */}
        {activeTab === 'messages' && (
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isRTL ? 'التواصل المباشر مع المستخدمين' : 'Direct User-Admin Messaging'}
                </h4>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="all">{isRTL ? 'المستلم: عام للجميع' : 'Recipient: All Users'}</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.id})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={onOpenChat}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isRTL ? 'فتح نافذة المحادثة' : 'Open Chat Window'}</span>
              </button>
            </div>

            {/* Quick Templates */}
            <div className="flex flex-wrap gap-1.5">
              {[
                isRTL ? 'تم تفعيل اشتراك الـ VIP لحسابك بنجاح 👑' : 'Your VIP membership has been activated 👑',
                isRTL ? 'أهلاً بك! كيف يمكن لإدارة المنصة مساعدتك اليوم؟' : 'Welcome! How can our admin team help you?',
                isRTL ? 'تمت مراجعة طلبك وحل المشكلة بنجاح ✓' : 'Your request has been reviewed and resolved ✓',
              ].map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAdminReplyText(tpl)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  + {tpl}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              {contactMessages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  {isRTL ? 'لا توجد رسائل بعد.' : 'No messages yet.'}
                </p>
              ) : (
                contactMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl text-xs border ${
                      msg.senderRole === 'admin'
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {msg.senderRole === 'admin'
                          ? isRTL
                            ? `رد الإدارة 🛡️ (إلى: ${msg.recipientId})`
                            : `Admin Reply 🛡️ (to: ${msg.recipientId})`
                          : `${msg.senderName} (${msg.senderId})`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendAdminReply} className="flex gap-2">
              <input
                type="text"
                value={adminReplyText}
                onChange={(e) => setAdminReplyText(e.target.value)}
                placeholder={isRTL ? 'اكتب رسالة الإدارة للمستخدم هنا...' : 'Write admin message to user...'}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!adminReplyText.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إرسال مباشر' : 'Send Now'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 5: Dynamic Page Editor */}
        {activeTab === 'pages' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isRTL ? 'تعديل نصوص الواجهة محلياً' : 'Local Dynamic Content'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL
                    ? 'يتم حفظ التعديلات مباشرة في المتصفح وتطبيقها فوراً'
                    : 'Edits persist locally in browser storage and apply live'}
                </p>
              </div>

              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {isRTL ? 'تم الحفظ بنجاح' : 'Saved'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pagesList.map((page) => (
                <div
                  key={page.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {page.title}
                    </span>
                    <button
                      onClick={() => setEditingPage(page)}
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {page.content}
                  </p>
                </div>
              ))}
            </div>

            {editingPage && (
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 space-y-3 mt-4">
                <h5 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {editingPage.title}
                </h5>
                <textarea
                  value={editingPage.content}
                  onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                  rows={3}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 text-right"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingPage(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleSavePage}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'حفظ' : 'Save'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Global Announcements */}
        {activeTab === 'announcements' && <AdminAnnouncementsPanel currentUser={currentUser} />}

        {/* Tab 7: Ad Integration */}
        {activeTab === 'ads' && <AdminAdsPanel currentUser={currentUser} />}

        {/* Tab 8: Workspace ZIP Export */}
        {activeTab === 'github' && <AdminGitHubSyncPanel currentUser={currentUser} />}
      </div>

      {/* Admin-Only In-App File Preview Modal */}
      {hasPermission && previewState && (() => {
        const { order, target, textContent, loadingText, error } = previewState;
        const hasOriginal = Boolean(order.audit?.originalFileUrl);
        const hasResult = Boolean(order.audit?.resultFileUrl);
        const activeUrl =
          target === 'original' ? order.audit?.originalFileUrl : order.audit?.resultFileUrl;
        const activeName =
          target === 'original'
            ? order.audit?.attachedFileName || 'original_file'
            : order.audit?.resultFileName || 'result_file';
        const activeMime =
          target === 'original'
            ? order.audit?.attachedFileType || ''
            : order.audit?.resultFileType || '';
        const previewKind = detectPreviewKind(activeName, activeMime);

        return (
          <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Preview Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                      {order.command}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeName}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isRTL ? `المستخدم: ${order.userName}` : `User: ${order.userName}`}
                    {activeMime ? ` · ${activeMime}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasOriginal && hasResult && (
                    <div className="flex items-center bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => loadTextForPreview(order, 'original')}
                        className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                          target === 'original'
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRTL ? 'الملف الأصلي' : 'Original'}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTextForPreview(order, 'result')}
                        className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                          target === 'result'
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRTL ? 'الملف الناتج' : 'Result'}
                      </button>
                    </div>
                  )}

                  {activeUrl && (
                    <button
                      type="button"
                      onClick={() => triggerRealServerFileDownload(activeUrl, activeName)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'تحميل الملف' : 'Download'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewState(null)}
                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Preview Body */}
              <div className="p-5 overflow-y-auto flex-1">
                {!activeUrl ? (
                  <div className="p-8 text-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-bold">
                    {LEGACY_MISSING_MSG}
                  </div>
                ) : previewKind === 'pdf' ? (
                  <div className="space-y-3">
                    <iframe
                      src={activeUrl}
                      title={activeName}
                      className="w-full h-[64vh] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => triggerRealServerFileDownload(activeUrl, activeName)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'تنزيل نسخة PDF مباشرة' : 'Download PDF'}</span>
                      </button>
                    </div>
                  </div>
                ) : previewKind === 'image' ? (
                  <div className="flex flex-col items-center justify-center bg-slate-900/95 rounded-2xl p-4 border border-slate-700">
                    <img
                      src={activeUrl}
                      alt={activeName}
                      className="max-h-[64vh] w-auto object-contain rounded-xl"
                    />
                  </div>
                ) : previewKind === 'audio' ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                      <Volume2 className="w-7 h-7" />
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {activeName}
                    </div>
                    <audio
                      ref={audioPreviewRef}
                      key={activeUrl}
                      src={activeUrl}
                      controls
                      className="w-full max-w-lg"
                    />
                    <button
                      type="button"
                      onClick={() => audioPreviewRef.current?.play().catch(() => {})}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>{isRTL ? 'تشغيل الصوت الآن' : 'Play Audio'}</span>
                    </button>
                  </div>
                ) : previewKind === 'text' ? (
                  <div className="space-y-3">
                    {error && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-700 dark:text-amber-300 text-xs font-bold">
                        {error}
                      </div>
                    )}
                    {loadingText ? (
                      <div className="py-12 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isRTL ? 'جارٍ تحميل النص كاملاً...' : 'Loading text...'}</span>
                      </div>
                    ) : (
                      <pre className="w-full max-h-[62vh] overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {textContent || (isRTL ? 'الملف فارغ.' : 'File is empty.')}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="p-10 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                      <FileText className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      اضغط للتحميل للعرض
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {activeName}
                    </p>
                    <button
                      type="button"
                      onClick={() => triggerRealServerFileDownload(activeUrl, activeName)}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isRTL ? 'تحميل الملف الآن' : 'Download to View'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
