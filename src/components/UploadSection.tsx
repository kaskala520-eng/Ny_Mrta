import React, { useRef, useState } from 'react';
import {
  CloudUpload,
  FileUp,
  FileText,
  X,
  Sparkles,
  GraduationCap,
  ListChecks,
  BrainCircuit,
  AlertCircle,
  Languages,
} from 'lucide-react';
import { ServiceType } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { readFileClientSide, MAX_FILE_SIZE_MB } from '../utils/clientFileReader';
import { ToolProgressBar } from './ToolProgressBar';
import { uploadFileToCloudOrServer, UploadedServerFile } from '../utils/cloudStorage';

interface UploadSectionProps {
  onFileSelected: (file: File, extractedContent?: string, uploadedServerFile?: UploadedServerFile | null) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  onQuickAction: (action: ServiceType) => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onFileSelected,
  selectedFile,
  onClearFile,
  onQuickAction,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [extractedChars, setExtractedChars] = useState<number | null>(null);
  const { t, isRTL } = useLanguage();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setDetectedPages(null);
    setExtractedChars(null);
    setUploadProgress(5);
    setUploadStatus(isRTL ? 'جاري فحص الملف...' : 'Inspecting file...');

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        isRTL
          ? `حجم الملف (${sizeMb} MB) يتجاوز الحد الأقصى المسموح به (20 ميجابايت). يرجى اختيار ملف أصغر.`
          : `File size (${sizeMb} MB) exceeds the 20MB limit. Please select a smaller file.`
      );
      return;
    }

    setLoadingExtract(true);

    try {
      const result = await readFileClientSide(
        file,
        (pct, message) => {
          setUploadProgress(pct);
          setUploadStatus(message);
        },
        isRTL
      );

      if (result.pageCount) {
        setDetectedPages(result.pageCount);
      }
      if (result.characterCount) {
        setExtractedChars(result.characterCount);
      }

      setUploadProgress(94);
      setUploadStatus(isRTL ? 'جاري رفع الملف إلى السيرفر...' : 'Uploading file to server...');
      const uploadedMeta = await uploadFileToCloudOrServer(
        file,
        file.name,
        file.type || 'application/octet-stream',
        'original'
      );

      onFileSelected(file, result.extractedText, uploadedMeta);
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(
        err?.message ||
          (isRTL
            ? 'فشل قراءة الملف أو استخراج محتواه. يرجى التأكد من سلامة الملف (الحد الأقصى 20MB).'
            : 'Failed to read or extract file contents. Please verify the file (max 20MB).')
      );
      onClearFile();
    } finally {
      setLoadingExtract(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 flex flex-col justify-between shadow-xs transition-colors duration-200">
      {/* Upload Dropzone Container - Matches image dashed box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all relative ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
            : selectedFile
            ? 'border-emerald-400 dark:border-emerald-600/70 bg-emerald-50/20 dark:bg-emerald-950/20'
            : errorMessage
            ? 'border-rose-400 dark:border-rose-600/70 bg-rose-50/30 dark:bg-rose-950/20'
            : 'border-blue-300/80 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/40 hover:border-blue-500 dark:hover:border-blue-500/70 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.ogg"
        />

        {/* Loading overlay during real client-side file extraction */}
        {loadingExtract && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-6 z-20 gap-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.uploadingDoc}</h4>
            <div className="w-full max-w-xs">
              <ToolProgressBar progress={uploadProgress} label={uploadStatus} active={loadingExtract} accent="blue" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">PDF.js · mammoth · SheetJS · JSZip</p>
          </div>
        )}

        {/* Error Message Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between text-start gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <CloudUpload className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              {t.uploadTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 mb-3">
              {t.uploadSubtitle}
            </p>

            {/* File Support & 20MB Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>{t.largeFilesBadge}</span>
            </div>

            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl mb-4 space-y-0.5 text-center">
              <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
              <p className="text-emerald-700 dark:text-emerald-300">
                سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/25 transition-all hover:scale-102 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>{t.chooseFiles}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center mb-3">
              <FileText className="w-8 h-8" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate max-w-[280px]">
                {selectedFile.name}
              </span>
              <button
                onClick={() => {
                  onClearFile();
                  setDetectedPages(null);
                  setExtractedChars(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-950/70 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                title={t.clearFile}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold mb-4">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {t.readyForProcessing}</span>
              </span>

              {detectedPages !== null && detectedPages > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono text-[11px] border border-blue-200 dark:border-blue-800/70">
                  {detectedPages} {t.pagesCountLabel}
                </span>
              )}

              {extractedChars !== null && extractedChars > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px] border border-slate-200 dark:border-slate-700">
                  {extractedChars.toLocaleString()} {t.charsCountLabel}
                </span>
              )}
            </div>

            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl mb-3 space-y-0.5 text-center">
              <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
              <p className="text-emerald-700 dark:text-emerald-300">
                سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
              </p>
            </div>

            {/* Quick Action Buttons for the uploaded document */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg mt-2">
              <button
                onClick={() => onQuickAction('research')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800/70 transition-colors cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{t.quickResearch}</span>
              </button>

              <button
                onClick={() => onQuickAction('solve')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800/70 transition-colors cursor-pointer"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>{t.quickSolve}</span>
              </button>

              <button
                onClick={() => onQuickAction('questions')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800/70 transition-colors cursor-pointer"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>{t.quickQuestions}</span>
              </button>

              <button
                onClick={() => onQuickAction('translate')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800/70 transition-colors cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{t.quickTranslate}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Underneath Feature Callout */}
      <div
        onClick={() => onQuickAction('research')}
        className="mt-4 flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-blue-50/80 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-purple-200/60 dark:border-purple-800/60 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group text-start"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-purple-950 dark:text-purple-200">
              {t.featureAcademicTitle}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t.featureAcademicDesc}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-purple-600 dark:text-purple-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700/70 shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
          {t.startNow}
        </span>
      </div>
    </div>
  );
};
