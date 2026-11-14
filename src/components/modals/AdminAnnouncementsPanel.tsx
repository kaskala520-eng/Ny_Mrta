import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  Megaphone,
  PauseCircle,
  PlayCircle,
  RotateCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AnnouncementSeverity, GlobalAnnouncement, User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  GlobalAnnouncementBar,
  LOCAL_ANNOUNCEMENTS_EVENT,
  LOCAL_ANNOUNCEMENTS_KEY,
} from '../GlobalAnnouncementBar';

interface AdminAnnouncementsPanelProps {
  currentUser: User | null;
}

const SEVERITY_OPTIONS: Array<{
  value: AnnouncementSeverity;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'info', labelAr: 'إعلان عام', labelEn: 'Info' },
  { value: 'success', labelAr: 'ميزة / تحديث', labelEn: 'Success' },
  { value: 'warning', labelAr: 'تنبيه', labelEn: 'Warning' },
  { value: 'urgent', labelAr: 'عاجل', labelEn: 'Urgent' },
];

export const AdminAnnouncementsPanel: React.FC<AdminAnnouncementsPanelProps> = () => {
  const { isRTL } = useLanguage();

  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AnnouncementSeverity>('info');
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [expiryHours, setExpiryHours] = useState<string>('none');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_ANNOUNCEMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setAnnouncements(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  const persistAnnouncements = (next: GlobalAnnouncement[]) => {
    setAnnouncements(next);
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(LOCAL_ANNOUNCEMENTS_EVENT));
  };

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const showToast = (text: string) => {
    setSuccessMsg(text);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setMessage('');
    setSeverity('info');
    setActionLabel('');
    setActionUrl('');
    setExpiryHours('none');
  };

  const computeExpiresAt = (): string | undefined => {
    if (expiryHours === 'none') return undefined;
    const hours = Number(expiryHours);
    if (Number.isNaN(hours) || hours <= 0) return undefined;
    return new Date(Date.now() + hours * 3600 * 1000).toISOString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!message.trim()) {
      setErrorMsg(isRTL ? 'يرجى كتابة نص الإشعار قبل الإرسال.' : 'Please enter an announcement message.');
      return;
    }

    const nowIso = new Date().toISOString();
    if (editingId) {
      const next = announcements.map((a) =>
        a.id === editingId
          ? {
              ...a,
              title: title.trim(),
              message: message.trim(),
              severity,
              actionLabel: actionLabel.trim() || undefined,
              actionUrl: actionUrl.trim() || undefined,
              isActive: true,
              expiresAt: computeExpiresAt(),
              updatedAt: nowIso,
            }
          : { ...a, isActive: false }
      );
      persistAnnouncements(next);
      resetForm();
      showToast(isRTL ? 'تم تحديث الإشعار بنجاح.' : 'Announcement updated locally.');
      return;
    }

    const created: GlobalAnnouncement = {
      id: `ann_${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      severity,
      actionLabel: actionLabel.trim() || undefined,
      actionUrl: actionUrl.trim() || undefined,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt: computeExpiresAt(),
    };

    const deactivated = announcements.map((a) => ({ ...a, isActive: false }));
    persistAnnouncements([created, ...deactivated]);
    resetForm();
    showToast(isRTL ? 'تم تفعيل الإشعار أعلى الشاشة بنجاح.' : 'Announcement published live.');
  };

  const handleToggleActive = (item: GlobalAnnouncement) => {
    const next = announcements.map((a) => {
      if (a.id === item.id) {
        return { ...a, isActive: !item.isActive, updatedAt: new Date().toISOString() };
      }
      return !item.isActive ? { ...a, isActive: false } : a;
    });
    persistAnnouncements(next);
    showToast(
      !item.isActive
        ? isRTL
          ? 'تم تفعيل الإشعار.'
          : 'Announcement activated.'
        : isRTL
        ? 'تم إيقاف عرض الإشعار.'
        : 'Announcement paused.'
    );
  };

  const handleRepush = (id: string) => {
    const nowIso = new Date().toISOString();
    const next = announcements.map((a) =>
      a.id === id ? { ...a, isActive: true, updatedAt: nowIso } : { ...a, isActive: false }
    );
    persistAnnouncements(next);
    showToast(isRTL ? 'تم إعادة عرض الإشعار.' : 'Announcement re-pushed.');
  };

  const handleDelete = (id: string) => {
    const next = announcements.filter((a) => a.id !== id);
    persistAnnouncements(next);
    setPendingDeleteId(null);
    if (editingId === id) resetForm();
    showToast(isRTL ? 'تم حذف الإشعار.' : 'Announcement deleted.');
  };

  const handleStartEdit = (item: GlobalAnnouncement) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setMessage(item.message || '');
    setSeverity(item.severity || 'info');
    setActionLabel(item.actionLabel || '');
    setActionUrl(item.actionUrl || '');
    setExpiryHours('none');
    setErrorMsg(null);
  };

  const previewDraft: GlobalAnnouncement = {
    id: editingId || 'preview',
    title: title.trim(),
    message:
      message.trim() ||
      (isRTL
        ? 'معاينة مباشرة لشكل شريط الإشعار في أعلى الشاشة.'
        : 'Live preview of how your alert bar appears at the top of the screen.'),
    severity,
    actionLabel: actionLabel.trim() || undefined,
    actionUrl: actionUrl.trim() || undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const formatTimestamp = (iso: string) => {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return iso;
    return new Date(ms).toLocaleString(isRTL ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (item: GlobalAnnouncement) => {
    if (!item.expiresAt) return false;
    const exp = Date.parse(item.expiresAt);
    return !Number.isNaN(exp) && exp <= Date.now();
  };

  return (
    <div className={`p-6 overflow-y-auto flex-1 space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isRTL ? 'نظام الإشعارات العامة المحلي' : 'Local Push Announcements'}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRTL
              ? 'إدارة تنبيهات أعلى الشاشة محلياً بالكامل دون الحاجة لخادم'
              : 'Manage dismissible top alert bar locally without a backend server'}
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 rounded-xl"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-700 dark:text-rose-300 hover:opacity-75 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {isRTL ? 'معاينة حية لشريط أعلى الشاشة' : 'Live Top-Bar Preview'}
        </div>
        <GlobalAnnouncementBar previewAnnouncement={previewDraft} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {editingId
              ? isRTL
                ? 'تعديل الإشعار الحالي'
                : 'Edit Announcement'
              : isRTL
              ? 'إنشاء إشعار عام جديد'
              : 'Compose New Announcement'}
          </h5>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              {isRTL ? 'إلغاء التعديل' : 'Cancel edit'}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {isRTL ? 'مستوى التنبيه' : 'Alert Severity'}
          </label>
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            {SEVERITY_OPTIONS.map((opt) => {
              const active = severity === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isRTL ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ann-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {isRTL ? 'العنوان المختصر (اختياري)' : 'Short Title (optional)'}
            </label>
            <input
              id="ann-title"
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isRTL ? 'مثال: تحديث جديد' : 'e.g. New Update'}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="ann-expiry"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {isRTL ? 'مدة الظهور' : 'Expiration'}
            </label>
            <select
              id="ann-expiry"
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            >
              <option value="none">{isRTL ? 'مفتوح حتى يتم إيقافه يدوياً' : 'Until paused'}</option>
              <option value="1">{isRTL ? 'ساعة واحدة' : '1 hour'}</option>
              <option value="24">{isRTL ? '24 ساعة' : '24 hours'}</option>
              <option value="168">{isRTL ? 'أسبوع' : '7 days'}</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="ann-message"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {isRTL ? 'نص الإشعار العام *' : 'Broadcast Message *'}
          </label>
          <textarea
            id="ann-message"
            rows={2}
            maxLength={320}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isRTL ? 'اكتب نص الإشعار هنا...' : 'Write your announcement message here...'
            }
            className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ann-action-label"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {isRTL ? 'نص زر الإجراء (اختياري)' : 'Action Button Label (optional)'}
            </label>
            <input
              id="ann-action-label"
              type="text"
              maxLength={40}
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="ann-action-url"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {isRTL ? 'رابط الزر (اختياري)' : 'Action URL (optional)'}
            </label>
            <input
              id="ann-action-url"
              type="text"
              dir="ltr"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="https://... or /"
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            data-testid="publish-announcement-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {editingId
                ? isRTL
                  ? 'حفظ التعديل'
                  : 'Save Update'
                : isRTL
                ? 'عرض الإشعار الآن'
                : 'Publish Alert'}
            </span>
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {isRTL ? 'سجل الإعلانات' : 'Announcement History'}
          </h5>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {announcements.length} {isRTL ? 'إعلان' : 'total'}
          </span>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-1.5">
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
              {isRTL ? 'لا توجد إعلانات عامة بعد' : 'No announcements yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            {announcements.map((item) => {
              const expired = isExpired(item);
              const severityMeta = SEVERITY_OPTIONS.find((s) => s.value === item.severity);
              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span
                        className={`font-bold ${
                          item.isActive && !expired
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {!item.isActive
                          ? isRTL
                            ? 'متوقف'
                            : 'Paused'
                          : expired
                          ? isRTL
                            ? 'منتهي'
                            : 'Expired'
                          : isRTL
                          ? 'نشط الآن'
                          : 'Active'}
                      </span>
                      <span>·</span>
                      <span>{isRTL ? severityMeta?.labelAr : severityMeta?.labelEn}</span>
                      <span>·</span>
                      <span>{formatTimestamp(item.updatedAt)}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 break-words">
                      {item.title && <span className="font-bold me-1.5">{item.title}:</span>}
                      <span>{item.message}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRepush(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-700 dark:text-blue-300 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'إعادة' : 'Re-push'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {item.isActive ? (
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>
                        {item.isActive
                          ? isRTL
                            ? 'إيقاف'
                            : 'Pause'
                          : isRTL
                          ? 'تفعيل'
                          : 'Activate'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {pendingDeleteId === item.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                        >
                          {isRTL ? 'تأكيد' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/70 text-rose-600 dark:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
