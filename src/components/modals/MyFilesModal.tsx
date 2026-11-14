import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  Trash2,
  Calendar,
  Search,
  Archive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderArchive,
} from 'lucide-react';
import JSZip from 'jszip';
import { FileRecord, User } from '../../types';
import { getOfflineFiles, deleteOfflineFile } from '../../utils/offlineDb';
import {
  computeExpiryMeta,
  runClientAndServerAutoDeleteSweep,
  triggerRealServerFileDownload,
} from '../../utils/cloudStorage';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatLanguageDisplayName } from '../LanguageSelector';

interface MyFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

const modalTranslations = {
  ar: {
    modalTitle: 'سجل ملفاتي ومستنداتي',
    modalSubtitle: 'سجل بجميع البحوث والترجمات والأسئلة المحفوظة',
    searchPlaceholder: 'ابحث في ملفاتك السابقة...',
    noFilesFound: 'لا توجد ملفات محفوظة حتى الآن. ستظهر هنا الملفات الناتجة عن الترجمة والبحوث وحل المسائل.',
    exportBtn: 'تصدير السجل (ZIP)',
    exporting: 'جاري تجهيز وتنزيل ZIP...',
    exportSuccess: 'تم تنزيل الأرشيف بنجاح!',
    exportError: 'حدث خطأ أثناء إنشاء ملف ZIP',
    noFilesToExport: 'لا توجد ملفات للتصدير',
    filesCount: 'ملف',
    preview: 'معاينة',
    download: 'تنزيل',
    delete: 'حذف',
    allFiles: 'جميع الملفات',
    exportDesc: 'تحميل جميع الملفات والمستندات المحفوظة مجمعة في ملف ZIP واحد',
    manifestTitle: 'تقرير تصدير سجل الملفات والمستندات - منصة Meta.Ny',
    onlineSync: 'متزامن',
    offlineBadge: 'الوضع غير المتصل (IndexedDB)',
  },
  en: {
    modalTitle: 'My Files & Documents',
    modalSubtitle: 'Complete archive of all saved translations, research, and questions',
    searchPlaceholder: 'Search saved files...',
    noFilesFound: 'No saved files yet. Processed files from translation, research, and problem solving will appear here.',
    exportBtn: 'Export History (ZIP)',
    exporting: 'Packaging ZIP file...',
    exportSuccess: 'ZIP archive downloaded successfully!',
    exportError: 'Error creating ZIP file',
    noFilesToExport: 'No files to export',
    filesCount: 'files',
    preview: 'Preview',
    download: 'Download',
    delete: 'Delete',
    allFiles: 'All Files',
    exportDesc: 'Download all saved documents and translations bundled into a single ZIP file',
    manifestTitle: 'Meta.Ny AI Platform - Document History Export Report',
    onlineSync: 'Synced',
    offlineBadge: 'Offline Mode (IndexedDB)',
  },
  ku: {
    modalTitle: 'مێژوو و بەڵگەنامەکانم',
    modalSubtitle: 'تۆماری تەواوی وەرگێڕان، لێکۆڵینەوە و پرسیارە پارێزراوەکان',
    searchPlaceholder: 'گەڕان لە فایلەکانت...',
    noFilesFound: 'تا ئێستا هیچ فایلێک پاشەکەوت نەکراوە.',
    exportBtn: 'هەناردەکردنی مێژوو (ZIP)',
    exporting: 'دروستکردنی فایلی ZIP...',
    exportSuccess: 'فایلی ZIP بە سەرکەوتوویی دابەزێندرا!',
    exportError: 'هەڵەیەک لە دروستکردنی فایلی ZIP ڕوویدا',
    noFilesToExport: 'هیچ فایلێک نییە بۆ هەناردەکردن',
    filesCount: 'فایل',
    preview: 'پێشبینین',
    download: 'داگرتن',
    delete: 'سڕینەوە',
    allFiles: 'هەموو فایلەکان',
    exportDesc: 'داگرتنی هەموو بەڵگەنامەکان لە یەک فایلی ZIP دا',
    manifestTitle: 'پلاتفۆرمی Meta.Ny - ڕاپۆرتی هەناردەکردنی بەڵگەنامەکان',
    onlineSync: 'هاوکاتکراو',
    offlineBadge: 'دۆخی ئۆفلاین (IndexedDB)',
  },
  fr: {
    modalTitle: 'Mes Fichiers & Documents',
    modalSubtitle: 'Historique complet des traductions, recherches et questions',
    searchPlaceholder: 'Rechercher vos fichiers...',
    noFilesFound: 'Aucun fichier enregistré pour l\'instant.',
    exportBtn: 'Exporter l\'historique (ZIP)',
    exporting: 'Création du fichier ZIP...',
    exportSuccess: 'Archive ZIP téléchargée avec succès !',
    exportError: 'Erreur lors de la création de l\'archive ZIP',
    noFilesToExport: 'Aucun fichier à exporter',
    filesCount: 'fichiers',
    preview: 'Aperçu',
    download: 'Télécharger',
    delete: 'Supprimer',
    allFiles: 'Tous les fichiers',
    exportDesc: 'Télécharger tous les fichiers et traductions regroupés dans un fichier ZIP',
    manifestTitle: 'Plateforme Meta.Ny - Rapport d\'exportation',
    onlineSync: 'Synchronisé',
    offlineBadge: 'Mode Hors-ligne (IndexedDB)',
  },
  es: {
    modalTitle: 'Mis Archivos y Documentos',
    modalSubtitle: 'Historial completo de traducciones, investigaciones y preguntas',
    searchPlaceholder: 'Buscar en tus archivos...',
    noFilesFound: 'No hay archivos guardados todavía.',
    exportBtn: 'Exportar historial (ZIP)',
    exporting: 'Creando archivo ZIP...',
    exportSuccess: '¡Archivo ZIP descargado con éxito!',
    exportError: 'Error al generar el archivo ZIP',
    noFilesToExport: 'No hay archivos para exportar',
    filesCount: 'archivos',
    preview: 'Vista previa',
    download: 'Descargar',
    delete: 'Eliminar',
    allFiles: 'Todos los archivos',
    exportDesc: 'Descarga todos tus documentos y traducciones agrupados en un solo archivo ZIP',
    manifestTitle: 'Plataforma Meta.Ny - Informe de exportación',
    onlineSync: 'Sincronizado',
    offlineBadge: 'Modo fuera de línea (IndexedDB)',
  },
  tr: {
    modalTitle: 'Dosyalarım ve Belgelerim',
    modalSubtitle: 'Kayıtlı tüm çeviriler, araştırmalar ve soruların arşivi',
    searchPlaceholder: 'Dosyalarınızda arayın...',
    noFilesFound: 'Henüz kayıtlı dosya bulunmuyor.',
    exportBtn: 'Geçmişi Dışa Aktar (ZIP)',
    exporting: 'ZIP arşivi oluşturuluyor...',
    exportSuccess: 'ZIP arşivi başarıyla indirildi!',
    exportError: 'ZIP oluşturulurken hata oluştu',
    noFilesToExport: 'Dışa aktarılacak dosya yok',
    filesCount: 'dosya',
    preview: 'Önizleme',
    download: 'İndir',
    delete: 'Sil',
    allFiles: 'Tüm Dosyalar',
    exportDesc: 'Tüm kayıtlı belgeleri tek bir ZIP arşivi olarak indirin',
    manifestTitle: 'Meta.Ny Platformu - Dosya Dışa Aktarma Raporu',
    onlineSync: 'Eşitlendi',
    offlineBadge: 'Çevrimdışı Mod (IndexedDB)',
  },
  de: {
    modalTitle: 'Meine Dateien & Dokumente',
    modalSubtitle: 'Vollständiges Archiv aller Übersetzungen, Recherchen und Fragen',
    searchPlaceholder: 'Dateien durchsuchen...',
    noFilesFound: 'Noch keine gespeicherten Dateien.',
    exportBtn: 'Verlauf exportieren (ZIP)',
    exporting: 'ZIP-Archiv wird erstellt...',
    exportSuccess: 'ZIP-Archiv erfolgreich heruntergeladen!',
    exportError: 'Fehler beim Erstellen des ZIP-Archivs',
    noFilesToExport: 'Keine Dateien zum Exportieren',
    filesCount: 'Dateien',
    preview: 'Vorschau',
    download: 'Herunterladen',
    delete: 'Löschen',
    allFiles: 'Alle Dateien',
    exportDesc: 'Alle gespeicherten Dokumente als ein einziges ZIP-Archiv herunterladen',
    manifestTitle: 'Meta.Ny Plattform - Exportbericht',
    onlineSync: 'Synchronisiert',
    offlineBadge: 'Offline-Modus (IndexedDB)',
  },
  fa: {
    modalTitle: 'فایل‌ها و اسناد من',
    modalSubtitle: 'آرشیو کامل ترجمه‌ها، پژوهش‌ها و پرسش‌های ذخیره‌شده',
    searchPlaceholder: 'جستجو در فایل‌های گذشته...',
    noFilesFound: 'هنوز فایلی ذخیره نشده است.',
    exportBtn: 'خروجی سابقه (ZIP)',
    exporting: 'در حال ساخت فایل ZIP...',
    exportSuccess: 'فایل ZIP با موفقیت دانلود شد!',
    exportError: 'خطا در ایجاد فایل ZIP',
    noFilesToExport: 'فایلی برای خروجی وجود ندارد',
    filesCount: 'فایل',
    preview: 'پیش‌نمایش',
    download: 'دانلود',
    delete: 'حذف',
    allFiles: 'همه فایل‌ها',
    exportDesc: 'دانلود تمامی اسناد و ترجمه‌ها در یک فایل فشرده ZIP',
    manifestTitle: 'پلتفرم هوشمند Meta.Ny - گزارش خروجی اسناد',
    onlineSync: 'همگام‌سازی شده',
    offlineBadge: 'حالت آفلاین (IndexedDB)',
  },
};

const serviceFolderMap: Record<string, string> = {
  translate: 'Translations_الترجمات',
  research: 'Research_البحوث',
  questions: 'Questions_الأسئلة',
  solve: 'Solutions_المسائل',
  convert: 'Conversions_التحويل',
  voice: 'Transcripts_الصوتيات',
  image: 'Image_Analysis_الصور',
};

export const MyFilesModal: React.FC<MyFilesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { language, isRTL, t } = useLanguage();
  const tModal = modalTranslations[language as keyof typeof modalTranslations] || modalTranslations.ar;

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchFiles = async () => {
    await runClientAndServerAutoDeleteSweep(false);
    const offlineList = await getOfflineFiles();
    setFiles(offlineList);
  };

  useEffect(() => {
    if (isOpen) {
      void fetchFiles();
      setExportFeedback(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const expiringTomorrowList = files.filter((f) => {
    if (f.autoDeleted) return false;
    const meta = computeExpiryMeta(f.createdAt, f.retentionDays, f.expiresAt);
    return meta.isExpiringTomorrow;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteOfflineFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (selectedFile?.id === id) setSelectedFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (file: FileRecord) => {
    if (file.autoDeleted) return;
    if (file.resultFileUrl) {
      await triggerRealServerFileDownload(
        file.resultFileUrl,
        `${file.title.replace(/\s+/g, '_')}`
      );
      return;
    }
    const blob = new Blob([file.resultContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportZip = async () => {
    if (files.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);

    try {
      const zip = new JSZip();

      // Track duplicate filenames
      const usedFilenames: Record<string, number> = {};

      files.forEach((file, index) => {
        const folderName = serviceFolderMap[file.serviceUsed] || 'Documents_المستندات';
        const folder = zip.folder(folderName) || zip;

        // Clean file name
        let cleanBase = (file.title || `doc_${index + 1}`)
          .replace(/[\\/:*?"<>|\r\n]/g, '_')
          .trim()
          .slice(0, 50);

        if (!cleanBase) cleanBase = `doc_${index + 1}`;

        let filename = `${cleanBase}.txt`;
        if (usedFilenames[filename]) {
          usedFilenames[filename]++;
          filename = `${cleanBase}_(${usedFilenames[filename]}).txt`;
        } else {
          usedFilenames[filename] = 1;
        }

        // Header for each file
        const header = `================================================================================
Meta.Ny AI Platform | منصة Meta.Ny الذكية
================================================================================
العنوان / Title:        ${file.title}
الخدمة / Service:       ${file.serviceUsed}
الملف الأصلي / Source:  ${file.fileName || 'N/A'}
تاريخ الحفظ / Date:     ${new Date(file.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
معرف المستند / ID:      ${file.id}
================================================================================

`;

        folder.file(filename, header + (file.resultContent || ''));
      });

      // Manifest summary
      const now = new Date();
      const dateFormatted = now.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US');
      const manifest = `================================================================================
${tModal.manifestTitle}
================================================================================
تاريخ التصدير / Export Date:  ${dateFormatted}
إجمالي المستندات / Total:    ${files.length} ${tModal.filesCount}
المستخدم / User:             ${currentUser?.name || 'Meta.Ny Local User'}
الموقع / Platform:           Meta.Ny AI Suite (https://metany.ai)
================================================================================

قائمة المستندات المضمنة / Itemized Document List:
${files
  .map(
    (f, idx) =>
      `${String(idx + 1).padStart(3, ' ')}. [${f.serviceUsed.toUpperCase()}] ${f.title} (${new Date(
        f.createdAt
      ).toLocaleDateString()}) - ${f.resultContent?.length || 0} chars`
  )
  .join('\n')}

================================================================================
تم إنشاء هذا الأرشيف تلقائياً بواسطة نظام تصدير السجل لمنصة Meta.Ny.
Generated automatically by Meta.Ny Document History Exporter.
================================================================================
`;

      zip.file('00_README_MANIFEST.txt', manifest);

      // Generate the ZIP blob
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const dateStamp = now.toISOString().slice(0, 10);
      a.download = `MetaNy_Export_History_${dateStamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExportFeedback({
        type: 'success',
        message: `${tModal.exportSuccess} (${files.length} ${tModal.filesCount})`,
      });

      setTimeout(() => {
        setExportFeedback(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to export history as ZIP:', err);
      setExportFeedback({
        type: 'error',
        message: tModal.exportError,
      });
      setTimeout(() => {
        setExportFeedback(null);
      }, 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.serviceUsed.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {tModal.modalTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-transparent dark:border-blue-800/60">
                  {files.length} {tModal.filesCount}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{tModal.modalSubtitle}</p>
            </div>
          </div>

          {/* Header Action: Export History Button + Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportZip}
              disabled={files.length === 0 || isExporting}
              title={files.length === 0 ? tModal.noFilesToExport : tModal.exportDesc}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-xs ${
                files.length === 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                  : isExporting
                  ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 cursor-wait'
                  : exportFeedback?.type === 'success'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-300" />
                  <span>{tModal.exporting}</span>
                </>
              ) : exportFeedback?.type === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{tModal.exportSuccess}</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>{tModal.exportBtn}</span>
                  {files.length > 0 && (
                    <span className="hidden sm:inline-block bg-white/20 text-white text-[11px] px-1.5 py-0.5 rounded-md font-mono">
                      ZIP
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback alert banner if export succeeded or failed */}
        {exportFeedback && (
          <div
            className={`px-6 py-2.5 flex items-center gap-2 text-xs font-semibold border-b ${
              exportFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
            }`}
          >
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{exportFeedback.message}</span>
            <button
              onClick={() => setExportFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Overview bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 flex-1 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tModal.searchPlaceholder}
              className={`w-full text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent focus:outline-hidden ${isRTL ? 'text-right' : 'text-left'}`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {files.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-300 font-medium hidden sm:flex items-center gap-1.5 whitespace-nowrap bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <FolderArchive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {filteredFiles.length} / {files.length} {tModal.filesCount}
              </span>
            </div>
          )}
        </div>

        {/* Expiring Tomorrow Alert */}
        {expiringTomorrowList.length > 0 && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>سيتم حذف ملفك غدا، حمله الان اذا تحتاجه</span>
          </div>
        )}

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/40 dark:bg-slate-950/40">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <FileText className="w-7 h-7" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                {search
                  ? isRTL
                    ? 'لم يتم العثور على أي ملف يطابق بحثك.'
                    : 'No files matching your search were found.'
                  : tModal.noFilesFound}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredFiles.map((file) => {
                const expMeta = computeExpiryMeta(file.createdAt, file.retentionDays, file.expiresAt);
                const isDeleted = Boolean(file.autoDeleted || expMeta.isExpired);

                return (
                <div
                  key={file.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-600/70 hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-0.5 rounded-lg">
                        {file.serviceUsed}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(file.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {file.title}
                    </h4>

                    {isDeleted ? (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        تم حذف الملف تلقائيا
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-2 mt-1.5 leading-relaxed bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-100 dark:border-slate-700/80">
                          {file.resultContent || (isRTL ? '(لا يوجد نص متاح)' : '(No preview text available)')}
                        </p>
                        <div
                          className={`mt-2 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            expMeta.isExpiringTomorrow
                              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {expMeta.isExpiringTomorrow
                            ? '⏳ سيتم حذف ملفك غدا، حمله الان اذا تحتاجه'
                            : `باقي ${expMeta.remainingDays} ايام لتحميل ملفك قبل الحذف`}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isDeleted ? '0' : (file.resultContent?.length || 0)} {t.charsCountLabel}
                      {file.metadata?.targetLang
                        ? ` · ${formatLanguageDisplayName(file.metadata.targetLang, isRTL)}`
                        : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isDeleted && (
                        <>
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                          >
                            {tModal.preview}
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>{tModal.download}</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title={tModal.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Full preview modal */}
          {selectedFile && (
            <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 px-2 py-0.5 rounded-md">
                      {selectedFile.serviceUsed}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-sm">
                      {selectedFile.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed my-4 whitespace-pre-line border border-slate-100 dark:border-slate-700 select-text">
                  {selectedFile.resultContent}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(selectedFile.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      {t.close}
                    </button>
                    <button
                      onClick={() => handleDownload(selectedFile)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{tModal.download}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
