import React, { useState, useEffect } from 'react';
import {
  Languages,
  ChevronDown,
  Terminal,
  FileDown,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  FileType,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { exportAsPDF, generatePDFFileName } from '../utils/pdfExport';
import {
  translateExactDocument,
  triggerFileDownload,
} from '../utils/exactDocumentTranslator';
import {
  translateTextClientSide,
  buildTxtBlob,
  buildWordDocBlob,
} from '../utils/clientTranslator';
import { ToolProgressBar } from './ToolProgressBar';
import { CommandAuditMeta } from '../types';

interface TranslationBoxProps {
  onTranslate: (options: {
    text: string;
    targetLang: string;
    mode: 'single' | 'dual';
  }) => void;
  initialText?: string;
  isTranslating?: boolean;
  fileName?: string;
  selectedFile?: File | null;
  translatedText?: string;
  onTranslateResult?: (result: string) => void;
  checkAdOrVIP?: () => Promise<boolean>;
  onSaveFile?: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null }
  ) => void;
}

export const TranslationBox: React.FC<TranslationBoxProps> = ({
  onTranslate,
  initialText = '',
  isTranslating = false,
  fileName,
  selectedFile,
  translatedText: externalTranslatedText,
  onTranslateResult,
  checkAdOrVIP,
  onSaveFile,
}) => {
  const [mode, setMode] = useState<'single' | 'dual'>('single');
  const [targetLang, setTargetLang] = useState('العربية');
  const [customText, setCustomText] = useState(initialText);
  const [localResultText, setLocalResultText] = useState(externalTranslatedText || '');
  const [exactFileBlob, setExactFileBlob] = useState<Blob | null>(null);
  const [exactFileName, setExactFileName] = useState<string | null>(null);
  const [localTranslating, setLocalTranslating] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<
    Array<{ text: string; time: string; type: 'info' | 'success' | 'error' | 'pending' }>
  >([]);

  const { t, isRTL } = useLanguage();

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'pending' = 'info') => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    setLogs((prev) => [...prev, { text, time, type }]);
  };

  useEffect(() => {
    if (initialText) {
      setCustomText(initialText);
      setPdfSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [initialText]);

  useEffect(() => {
    if (externalTranslatedText) {
      setLocalResultText(externalTranslatedText);
    }
  }, [externalTranslatedText]);

  const availableLanguages = [
    'العربية (Arabic)',
    'English (الإنجليزية)',
    'کوردی - Kurdî (الكردية)',
    'Türkçe (التركية)',
    'Français (الفرنسية)',
    'Deutsch (الألمانية)',
    'Español (الإسبانية)',
    'فارسی (الفارسية)',
  ];

  // Perform 100% client-side translation using LibreTranslate -> MyMemory fallback
  const executeTranslate = async (textToProcess: string): Promise<string> => {
    setLogs([]);
    setErrorMessage(null);
    setProgressPct(5);
    setProgressMsg(isRTL ? 'بدء الترجمة الفورية...' : 'Starting translation...');
    addLog(
      isRTL
        ? `بدء الترجمة الفورية عبر المتصفح (LibreTranslate / MyMemory) [الهدف: ${targetLang}]`
        : `Starting browser translation (LibreTranslate / MyMemory) [Target: ${targetLang}]`,
      'info'
    );

    if (!textToProcess.trim()) {
      const msg = isRTL
        ? 'يرجى كتابة نص أو رفع ملف لاستخراج النص وترجمته.'
        : 'Please enter text or upload a file to translate.';
      addLog(msg, 'error');
      setErrorMessage(msg);
      throw new Error(msg);
    }

    if (checkAdOrVIP) {
      const allowed = await checkAdOrVIP();
      if (!allowed) {
        throw new Error(isRTL ? 'يرجى إكمال الإجراء للمتابعة.' : 'Please complete the action to proceed.');
      }
    }

    setLocalTranslating(true);

    try {
      // Translate text via LibreTranslate with automatic fallback to MyMemory
      const res = await translateTextClientSide(textToProcess, targetLang, 'auto', (info) => {
        setProgressPct(info.percent);
        setProgressMsg(info.status);
      });

      const translated = res.translatedText || '';
      const engineLabel =
        res.engineUsed === 'libretranslate'
          ? 'LibreTranslate API'
          : res.engineUsed === 'mixed'
          ? 'LibreTranslate + MyMemory'
          : 'MyMemory API';
      addLog(
        isRTL ? `اكتملت الترجمة بنجاح عبر محرك: ${engineLabel}` : `Translation complete via ${engineLabel}`,
        'success'
      );

      setLocalResultText(translated);
      if (onTranslateResult) {
        onTranslateResult(translated);
      }

      let builtExactBlob: Blob | null = null;
      let builtExactName: string | null = null;

      // If an actual document file is selected (DOCX, XLSX, PPTX, PDF), translate original structure too
      if (selectedFile) {
        const lowerName = selectedFile.name.toLowerCase();
        const isSupportedDoc =
          lowerName.endsWith('.docx') ||
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.pptx') ||
          lowerName.endsWith('.pdf');

        if (isSupportedDoc) {
          addLog(
            isRTL
              ? `معالجة وتنسيق الملف الأصلي (${selectedFile.name}) للتحميل...`
              : `Building translated original document (${selectedFile.name})...`,
            'pending'
          );
          try {
            const docRes = await translateExactDocument(
              selectedFile,
              targetLang,
              translated,
              (msg) => addLog(msg, 'info')
            );
            setExactFileBlob(docRes.blob);
            setExactFileName(docRes.fileName);
            builtExactBlob = docRes.blob;
            builtExactName = docRes.fileName;
            addLog(
              isRTL ? `تم تجهيز الملف (${docRes.fileName}) للتحميل المباشر.` : `File ready (${docRes.fileName}).`,
              'success'
            );
          } catch (docErr: any) {
            addLog(`${docErr?.message || docErr}`, 'info');
          }
        }
      }

      if (onSaveFile) {
        const docTitle = fileName ? `ترجمة ${fileName}` : `ترجمة إلى ${targetLang}`;
        const baseName = (selectedFile?.name || fileName || 'MetaNy_Translated')
          .replace(/\.[^/.]+$/, '')
          .replace(/[\\/:*?"<>|]/g, '_');
        const fallbackDocBlob = buildWordDocBlob({
          title: docTitle,
          content: translated,
          targetLang,
          sourceText: mode === 'dual' ? textToProcess : undefined,
          mode,
        });
        onSaveFile(
          docTitle,
          translated,
          'translate',
          {
            queryText: `ترجمة إلى ${targetLang} (${mode}): ${textToProcess.slice(0, 220)}`,
            targetLang,
            inputPreview: textToProcess.slice(0, 1200),
            outputPreview: translated.slice(0, 2200),
            attachedFileName: selectedFile?.name || fileName,
            attachedFileSize: selectedFile?.size,
            attachedFileType: selectedFile?.type,
          },
          {
            blob: builtExactBlob || fallbackDocBlob,
            fileName: builtExactName || `${baseName}_translated.doc`,
            mimeType: builtExactBlob?.type || 'application/msword',
            originalFile: selectedFile,
          }
        );
      }

      return translated;
    } catch (err: any) {
      const msg =
        err?.message ||
        (isRTL ? 'تعذر إتمام الترجمة حالياً. يرجى التحقق من اتصال الإنترنت.' : 'Translation failed. Please check internet connection.');
      addLog(msg, 'error');
      setErrorMessage(msg);
      throw err;
    } finally {
      setLocalTranslating(false);
    }
  };

  const handleTranslateClick = async () => {
    const textToSend = customText || initialText;
    if (!textToSend.trim()) {
      onTranslate({
        text: '',
        targetLang,
        mode,
      });
      return;
    }

    try {
      await executeTranslate(textToSend);
    } catch (err: any) {
      console.warn('Inline translation note:', err?.message);
    }
  };

  const ensureTranslatedContent = async (): Promise<{ content: string; sourceToSend: string }> => {
    let contentToExport = localResultText || externalTranslatedText;
    const sourceToSend = customText || initialText;

    if (!contentToExport || !contentToExport.trim()) {
      if (!sourceToSend || !sourceToSend.trim()) {
        throw new Error(isRTL ? 'لا يوجد محتوى لتصديره. اكتب نصاً أو ارفع ملفاً أولاً.' : 'No content to export. Enter text or upload a file first.');
      }
      contentToExport = await executeTranslate(sourceToSend);
    }
    return { content: contentToExport, sourceToSend };
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    setPdfSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { content: contentToExport, sourceToSend } = await ensureTranslatedContent();
      const expectedName = generatePDFFileName(fileName, targetLang);
      addLog(isRTL ? `جاري إنشاء ملف PDF (${expectedName})...` : `Creating PDF (${expectedName})...`, 'pending');

      await exportAsPDF({
        title: fileName ? `ترجمة ملف: ${fileName}` : `مستند مترجم إلى ${targetLang}`,
        content: contentToExport,
        originalFileName: fileName,
        targetLang,
        sourceText: mode === 'dual' ? sourceToSend : undefined,
        mode,
      });

      addLog(isRTL ? `تم تحميل ${expectedName} بنجاح.` : `Downloaded ${expectedName}.`, 'success');
      setPdfSuccessMessage(
        isRTL ? `تم تحميل ${expectedName} بنجاح.` : `Downloaded ${expectedName} successfully.`
      );
      setTimeout(() => setPdfSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('PDF Export error:', err);
      const msg = err?.message || (isRTL ? 'فشل تصدير PDF' : 'PDF export failed');
      setErrorMessage(msg);
      addLog(msg, 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    setErrorMessage(null);
    try {
      const { content: contentToExport, sourceToSend } = await ensureTranslatedContent();
      const base = (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'MetaNy_Translation').replace(/[\\/:*?"<>|]/g, '_');
      const docName = `${base}_translated.doc`;
      const blob = buildWordDocBlob({
        title: fileName ? `ترجمة: ${fileName}` : `الترجمة (${targetLang})`,
        content: contentToExport,
        targetLang,
        sourceText: mode === 'dual' ? sourceToSend : undefined,
        mode,
      });
      triggerFileDownload(blob, docName);
      setPdfSuccessMessage(isRTL ? `تم تحميل ملف Word (${docName})` : `Downloaded Word (${docName})`);
      setTimeout(() => setPdfSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || (isRTL ? 'فشل تصدير Word' : 'Word export failed'));
    }
  };

  const handleExportTxt = async () => {
    setErrorMessage(null);
    try {
      const { content: contentToExport, sourceToSend } = await ensureTranslatedContent();
      const base = (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'MetaNy_Translation').replace(/[\\/:*?"<>|]/g, '_');
      const txtName = `${base}_translated.txt`;
      const finalTxt =
        mode === 'dual' && sourceToSend
          ? `=== Original ===\n${sourceToSend}\n\n=== Translation (${targetLang}) ===\n${contentToExport}`
          : contentToExport;
      triggerFileDownload(buildTxtBlob(finalTxt), txtName);
      setPdfSuccessMessage(isRTL ? `تم تحميل ملف TXT (${txtName})` : `Downloaded TXT (${txtName})`);
      setTimeout(() => setPdfSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || (isRTL ? 'فشل تصدير TXT' : 'TXT export failed'));
    }
  };

  const handleCopy = () => {
    const textToCopy = localResultText || externalTranslatedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeResult = localResultText || externalTranslatedText;
  const isWorking = isTranslating || localTranslating;
  const currentFileNameTarget = generatePDFFileName(fileName, targetLang);

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col justify-between shadow-xs h-full transition-colors duration-200 ${
        isRTL ? 'text-right' : 'text-left'
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            {t.translationOptionsTitle}
          </h3>
          {fileName && (
            <span className="text-[11px] font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 px-2 py-0.5 rounded-lg truncate max-w-[180px]">
              {fileName}
            </span>
          )}
        </div>

        {/* Segmented control: لغة واحدة / لغتين مزدوجتين */}
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center justify-between mb-4 border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('dual')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'dual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.dualLanguage}
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'single'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.singleLanguage}
          </button>
        </div>

        {/* Target language selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.extractedLangLabel}
          </label>
          <div className="relative">
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className={`w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors cursor-pointer ${
                isRTL ? 'text-right pr-4 pl-10' : 'text-left pl-4 pr-10'
              }`}
            >
              {availableLanguages.map((l) => (
                <option key={l} value={l} className="dark:bg-slate-900 dark:text-slate-100">
                  {l}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 absolute ${
                isRTL ? 'left-3' : 'right-3'
              } top-1/2 -translate-y-1/2 pointer-events-none`}
            />
          </div>
        </div>

        {/* Text area */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.textToTranslateLabel}
            </label>
            {(customText || initialText) && (
              <span className="text-[10px] text-slate-400 font-mono">
                {(customText || initialText).length} {t.charsCountLabel}
              </span>
            )}
          </div>
          <textarea
            value={customText || initialText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={t.typeOrPastePlaceholder}
            rows={4}
            className={`w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors resize-none ${
              isRTL ? 'text-right' : 'text-left'
            }`}
          />
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {(isWorking || progressPct > 0) && (
          <div className="mb-3">
            <ToolProgressBar progress={progressPct} label={progressMsg} active={isWorking} accent="teal" />
          </div>
        )}

        {/* Translated Result Preview Box */}
        {activeResult && (
          <div className={`mb-4 p-3.5 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-950/50 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/70 rounded-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-200/70 dark:border-blue-800/60 gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t.translatedResultTitle} ({targetLang})</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700/70 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? t.copied : t.copy}</span>
                </button>
                <button
                  onClick={handleExportWord}
                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileDown className="w-3 h-3" />
                  <span>Word</span>
                </button>
                <button
                  onClick={handleExportTxt}
                  className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>TXT</span>
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap select-text pr-1 font-sans">
              {activeResult}
            </div>
          </div>
        )}

        {/* Feedback message upon export */}
        {pdfSuccessMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{pdfSuccessMessage}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 mt-2">
        {/* Exact Document Download Banner */}
        {exactFileBlob && (
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/60 dark:via-teal-950/50 dark:to-emerald-950/60 border border-emerald-300 dark:border-emerald-700/70 rounded-xl flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="text-[11px] font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5 flex-wrap">
                  <span>{t.exactDocReady}</span>
                  <span className="font-mono text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-700 truncate max-w-[160px]">
                    {exactFileName}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  {t.exactDocPreserved}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerFileDownload(exactFileBlob, exactFileName || 'document')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{t.downloadFileBtn}</span>
            </button>
          </div>
        )}

        {/* Dual Actions Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={handleTranslateClick}
            disabled={isWorking}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {isWorking ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Languages className="w-4 h-4" />
            )}
            <span>{isWorking ? t.translatingBtn : t.translateBtn}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || isWorking}
            title={currentFileNameTarget}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-700 to-rose-600 hover:from-rose-700 hover:to-rose-800 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 group"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileDown className="w-4 h-4 text-rose-100 group-hover:scale-110 transition-transform" />
            )}
            <span>{isExportingPDF ? t.preparingPdfBtn : t.exportPdfBtn}</span>
          </button>
        </div>

        {/* File naming guide hint */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 font-mono">
          <span className="flex items-center gap-1">
            <FileType className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>{t.downloadFileNameHint}</span>
          </span>
          <span className="text-blue-700 dark:text-blue-300 font-bold bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-2 py-0.5 rounded-md truncate max-w-[220px]">
            {currentFileNameTarget}
          </span>
        </div>

        {/* Diagnostic Logger Box */}
        <div className={`rounded-2xl border border-slate-800 bg-[#0a1122] text-slate-200 p-3 font-mono text-[11px] shadow-inner ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>{t.diagnosticLogTitle}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {logs.length > 0 ? `${logs.length} ${t.diagnosticSteps}` : t.diagnosticReady}
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="text-slate-400 text-[10px] py-0.5 leading-relaxed">
              {t.diagnosticIdleHint}
            </div>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-1.5 rounded-lg flex items-start justify-between gap-2 border text-[10px] ${
                    log.type === 'error'
                      ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                      : log.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                      : log.type === 'pending'
                      ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="break-all whitespace-pre-wrap">{log.text}</span>
                  <span className="text-[9px] text-slate-400 shrink-0 font-sans">{log.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
