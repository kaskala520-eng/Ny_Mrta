import React, { useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { getOfflineFiles } from '../../utils/offlineDb';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';

interface AdminGitHubSyncPanelProps {
  currentUser: User | null;
}

export const AdminGitHubSyncPanel: React.FC<AdminGitHubSyncPanelProps> = () => {
  const { isRTL } = useLanguage();
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownloadWorkspaceZip = async () => {
    setErrorMsg(null);
    setDoneMsg(null);
    setDownloadingZip(true);

    try {
      const zip = new JSZip();
      const files = await getOfflineFiles();

      const docsFolder = zip.folder('saved_documents') || zip;
      files.forEach((file, idx) => {
        const cleanTitle = (file.title || `doc_${idx + 1}`).replace(/[\\/:*?"<>|\r\n]/g, '_');
        docsFolder.file(`${cleanTitle}_${idx + 1}.txt`, file.resultContent || '');
      });

      const settingsSnapshot = {
        exportedAt: new Date().toISOString(),
        announcements: localStorage.getItem('metany_local_announcements'),
        pages: localStorage.getItem('metany_local_pages'),
        adConfig: localStorage.getItem('metany_local_ad_config'),
        savedFilesCount: files.length,
      };
      zip.file('workspace_backup.json', JSON.stringify(settingsSnapshot, null, 2));

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      triggerFileDownload(
        blob,
        `MetaNy-Workspace-Backup-${new Date().toISOString().slice(0, 10)}.zip`
      );
      setDoneMsg(
        isRTL
          ? `تم تصدير النسخة الاحتياطية (${files.length} ملف محفوظ) بصيغة ZIP بنجاح.`
          : `Exported local workspace backup (${files.length} saved files) as ZIP.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل تصدير ملف ZIP' : 'Failed to build ZIP'));
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`p-6 overflow-y-auto flex-1 space-y-5 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {doneMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">{doneMsg}</span>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200 dark:border-blue-800/70 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isRTL
                  ? 'تصدير نسخة احتياطية كاملة بصيغة ZIP (محلي)'
                  : 'Complete Local Workspace Backup (ZIP)'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'حزم جميع الملفات المحفوظة وإعدادات المنصة المحلية في ملف ZIP واحد مباشرة من المتصفح'
                  : 'Package all saved documents and local workspace preferences into a single ZIP directly in your browser'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadWorkspaceZip}
            disabled={downloadingZip}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {downloadingZip ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {downloadingZip
                ? isRTL
                  ? 'جارٍ ضغط النسخة...'
                  : 'Packaging ZIP...'
                : isRTL
                ? 'تحميل النسخة الاحتياطية ZIP'
                : 'Download Workspace ZIP'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
