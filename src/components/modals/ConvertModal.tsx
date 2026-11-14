import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeftRight,
  FileSpreadsheet,
  FileText,
  Download,
  Sparkles,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Presentation,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { convertFileClientSide, ConvertTargetFormat } from '../../utils/clientAiTools';
import { validateFileSize } from '../../utils/clientFileReader';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';

interface ConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  fileName?: string;
  selectedFile?: File | null;
  onSaveFile: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null }
  ) => void;
  checkAdOrVIP: () => Promise<boolean>;
}

export const ConvertModal: React.FC<ConvertModalProps> = ({
  isOpen,
  onClose,
  documentContent,
  fileName,
  selectedFile,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFile, setActiveFile] = useState<File | null>(selectedFile || null);
  const [sourceText, setSourceText] = useState(documentContent || '');
  const [targetFormat, setTargetFormat] = useState<ConvertTargetFormat>('pdf');
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [convertedPreviewText, setConvertedPreviewText] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile) setActiveFile(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    if (documentContent && !sourceText) setSourceText(documentContent);
  }, [documentContent]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    try {
      validateFileSize(f, isRTL);
      setActiveFile(f);
      setResultBlob(null);
      setPreviewImageUrl(null);
      setConvertedPreviewText('');
      void uploadFileToCloudOrServer(f, f.name, f.type, 'original');
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل فحص الملف.' : 'File validation error.'));
    }
  };

  const handleConvert = async () => {
    setErrorMsg(null);
    setResultBlob(null);
    setPreviewImageUrl(null);

    if (!activeFile && !sourceText.trim()) {
      setErrorMsg(
        isRTL
          ? 'يرجى رفع ملف (حتى 20MB) أو كتابة نص لتحويله إلى الصيغة المطلوبة.'
          : 'Please upload a file (max 20MB) or enter text to convert.'
      );
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(10);
    setProgressLabel(isRTL ? 'بدء التحويل داخل المتصفح...' : 'Starting conversion...');

    try {
      const res = await convertFileClientSide({
        file: activeFile,
        textFallback: sourceText,
        originalFileName: activeFile?.name || fileName || 'MetaNy_Document',
        targetFormat,
        onProgress: (pct, status) => {
          setProgressPct(pct);
          setProgressLabel(status);
        },
        isRTL,
      });

      setResultBlob(res.blob);
      setDownloadFileName(res.fileName);
      setConvertedPreviewText(res.previewText);
      if (res.previewImageUrl) setPreviewImageUrl(res.previewImageUrl);

      onSaveFile(
        isRTL ? `تحويل إلى ${targetFormat.toUpperCase()}` : `Converted to ${targetFormat.toUpperCase()}`,
        res.previewText.slice(0, 4000),
        'convert',
        {
          queryText: `تحويل ${activeFile?.name || fileName || 'نص'} إلى ${targetFormat.toUpperCase()}`,
          attachedFileName: activeFile?.name || fileName,
          attachedFileSize: activeFile?.size,
          attachedFileType: activeFile?.type,
          outputPreview: res.previewText.slice(0, 2200),
        },
        {
          blob: res.blob,
          fileName: res.fileName,
          mimeType: res.blob.type || 'application/octet-stream',
          originalFile: activeFile,
        }
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err?.message ||
          (isRTL ? 'حدث خطأ أثناء تحويل الملف. تأكد أن حجمه أقل من 20MB.' : 'Conversion failed (max 20MB).')
      );
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    triggerFileDownload(resultBlob, downloadFileName || `MetaNy_converted.${targetFormat}`);
  };

  const formats: Array<{ id: ConvertTargetFormat; label: string; icon: React.ComponentType<any>; color: string }> = [
    { id: 'pdf', label: 'PDF (.pdf)', icon: FileText, color: 'text-rose-600 dark:text-rose-400' },
    { id: 'word', label: 'Word (.doc)', icon: FileText, color: 'text-blue-600 dark:text-blue-400' },
    { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'pptx', label: 'PowerPoint (.pptx)', icon: Presentation, color: 'text-orange-600 dark:text-orange-400' },
    { id: 'txt', label: 'TXT (.txt)', icon: FileText, color: 'text-slate-600 dark:text-slate-300' },
    { id: 'png', label: isRTL ? 'صورة PNG' : 'PNG Image', icon: ImageIcon, color: 'text-indigo-600 dark:text-indigo-400' },
    { id: 'jpg', label: isRTL ? 'صورة JPG' : 'JPG Image', icon: ImageIcon, color: 'text-amber-600 dark:text-amber-400' },
    { id: 'webp', label: isRTL ? 'صورة WEBP' : 'WEBP Image', icon: ImageIcon, color: 'text-teal-600 dark:text-teal-400' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 via-white to-blue-50/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.serviceConvert}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'تحويل حقيقي بين PDF, Word, Excel, PowerPoint, TXT والصور داخل المتصفح'
                  : 'Real browser conversion across PDF, Word, Excel, PowerPoint, TXT & Images'}
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

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* File Selector inside Modal */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[260px]">
              {activeFile ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {isRTL ? `الملف المختار: ${activeFile.name}` : `Selected: ${activeFile.name}`}
                </span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  {isRTL ? 'يمكنك رفع ملف (حتى 20MB) أو كتابة نص أدناه' : 'Upload a file (max 20MB) or type text below'}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>{isRTL ? 'اختيار ملف للتحويل' : 'Choose File'}</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl space-y-0.5">
            <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
            <p className="text-emerald-700 dark:text-emerald-300">
              سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
            </p>
          </div>

          {!activeFile && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'أو أدخل النص المراد تحويله:' : 'Or enter text to convert:'}
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={3}
                placeholder={isRTL ? 'الصق النص هنا لتحويله إلى PDF أو Word أو Excel أو PPTX أو صورة...' : 'Paste text here to convert...'}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {isRTL ? 'اختر الصيغة المستهدفة للتحويل' : 'Select Target Conversion Format'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {formats.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setTargetFormat(fmt.id)}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    targetFormat === fmt.id
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/50 shadow-xs ring-2 ring-blue-600/20 dark:ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <fmt.icon className={`w-6 h-6 ${fmt.color}`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(loading || progressPct > 0) && (
            <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="blue" />
          )}

          <button
            onClick={handleConvert}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {loading
                ? isRTL
                  ? 'جارٍ تحويل وتنسيق الملف...'
                  : 'Converting and formatting file...'
                : isRTL
                ? `تحويل الملف إلى ${targetFormat.toUpperCase()}`
                : `Convert File to ${targetFormat.toUpperCase()}`}
            </span>
          </button>

          {resultBlob && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[260px]">
                  {isRTL ? `جاهز للتحميل: ${downloadFileName}` : `Ready: ${downloadFileName}`}
                </span>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRTL ? 'تحميل الملف المحول الآن' : 'Download Converted File'}</span>
                </button>
              </div>

              {previewImageUrl && (
                <div className="p-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex justify-center">
                  <img src={previewImageUrl} alt="Converted preview" className="max-h-52 rounded-xl object-contain" />
                </div>
              )}

              {convertedPreviewText && (
                <div className={`bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl p-4 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-line ${isRTL ? 'text-right' : 'text-left'}`}>
                  {convertedPreviewText.slice(0, 2500)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
