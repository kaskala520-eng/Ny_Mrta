import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Languages,
  Sparkles,
  Copy,
  Check,
  Volume2,
  AlertCircle,
  FileDown,
  Loader2,
  FileText,
  Table as TableIcon,
  Image as ImageIcon,
  Layers,
  UploadCloud,
  Eye,
  FileCheck,
} from 'lucide-react';
import { DiagnosticLogger, DiagnosticEvent } from '../DiagnosticLogger';
import { exportAsPDF, generatePDFFileName } from '../../utils/pdfExport';
import {
  parseWordDocument,
  parsePdfDocument,
  reconstructDocumentHtml,
  ParsedDocumentStructure,
} from '../../utils/documentParser';
import {
  translateExactDocument,
  triggerFileDownload,
} from '../../utils/exactDocumentTranslator';
import {
  readFileClientSide,
  MAX_FILE_SIZE_MB,
} from '../../utils/clientFileReader';
import {
  translateTextClientSide,
  buildTxtBlob,
  buildWordDocBlob,
  isRtlLangCode,
  resolveLangCode,
} from '../../utils/clientTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import { LanguageSelector, resolveSelectedOutputLanguage } from '../LanguageSelector';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';

interface TranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  fileName?: string;
  uploadedFile?: File | null;
  onSaveFile: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null },
    targetLang?: string
  ) => void;
  onTranslateComplete?: (result: string) => void;
  checkAdOrVIP: () => Promise<boolean>;
  initialOptions?: {
    text: string;
    targetLang: string;
    mode: 'single' | 'dual';
  };
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  isOpen,
  onClose,
  documentContent,
  fileName,
  uploadedFile,
  onSaveFile,
  onTranslateComplete,
  checkAdOrVIP,
  initialOptions,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFile, setActiveFile] = useState<File | null>(uploadedFile || null);
  const [sourceText, setSourceText] = useState(initialOptions?.text || documentContent || '');
  const [sourceLang] = useState('Auto-detect (تلقائي)');
  const [targetLang, setTargetLang] = useState(
    initialOptions?.targetLang ? resolveLangCode(initialOptions.targetLang) : 'ar'
  );
  const [customLangCode, setCustomLangCode] = useState('');
  const [mode, setMode] = useState<'single' | 'dual'>(initialOptions?.mode || 'single');
  const [resultText, setResultText] = useState('');
  const [reconstructedHtml, setReconstructedHtml] = useState<string | null>(null);
  const [structureInfo, setStructureInfo] = useState<ParsedDocumentStructure | null>(null);

  const [activeTab, setActiveTab] = useState<'reconstructed' | 'text'>('reconstructed');
  const [loading, setLoading] = useState(false);
  const [parsingDoc, setParsingDoc] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [translatedFileBlob, setTranslatedFileBlob] = useState<Blob | null>(null);
  const [translatedExactFileName, setTranslatedExactFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticEvent[]>([]);

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'pending' = 'info', details?: string) => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    setDiagnosticLogs((prev) => [...prev, { text, time, type, details }]);
  };

  // Client-side file extraction with PDF.js, mammoth, SheetJS & JSZip + 20MB check
  const processDocumentFile = async (file: File) => {
    setErrorMessage(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        `حجم الملف (${mb} MB) يتجاوز الحد الأقصى المسموح به (20 ميجابايت). يرجى اختيار ملف أصغر.`
      );
      return;
    }

    setActiveFile(file);
    setParsingDoc(true);
    setProgressPct(10);
    setProgressLabel(`جاري قراءة الملف (${file.name})...`);
    addLog(`بدء قراءة الملف محلياً: ${file.name}`, 'info', `الحجم: ${(file.size / 1024).toFixed(1)} KB`);

    try {
      const readRes = await readFileClientSide(
        file,
        (pct, msg) => {
          setProgressPct(pct);
          setProgressLabel(msg);
        },
        true
      );

      if (readRes.extractedText) {
        setSourceText(readRes.extractedText);
      }

      const uploadedMeta = await uploadFileToCloudOrServer(file, file.name, file.type, 'original');
      const selectedLang = resolveSelectedOutputLanguage(targetLang, customLangCode);
      const effectiveLang = selectedLang === 'original' ? 'ar' : selectedLang;
      onSaveFile(
        `ملف مرفق للترجمة: ${file.name}`,
        (readRes.extractedText || '').slice(0, 1200),
        'file_upload',
        {
          attachedFileName: file.name,
          attachedFileSize: file.size,
          attachedFileType: file.type,
          inputPreview: (readRes.extractedText || '').slice(0, 1200),
          targetLang: effectiveLang,
          originalFileUrl: uploadedMeta?.url,
          originalFileStoragePath: uploadedMeta?.storagePath,
        },
        {
          blob: buildTxtBlob(readRes.extractedText || file.name),
          fileName: `${file.name}_extracted.txt`,
          mimeType: 'text/plain;charset=utf-8',
          originalFile: file,
        },
        effectiveLang
      );

      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
        const buffer = await file.arrayBuffer();
        const docStructure = await parseWordDocument(buffer);
        setStructureInfo({ ...docStructure, extractedText: readRes.extractedText });
        addLog(
          `Word (mammoth.js): الصفحات التقديرية ${docStructure.pageCount}، الجداول ${docStructure.tableCount}، الصور ${docStructure.imageCount}`,
          'success'
        );
      } else if (lowerName.endsWith('.pdf') || file.type.includes('pdf')) {
        const buffer = await file.arrayBuffer();
        const pdfStructure = await parsePdfDocument(buffer);
        setStructureInfo({ ...pdfStructure, extractedText: readRes.extractedText });
        addLog(`PDF.js: تم استخراج ${pdfStructure.pageCount} صفحة بنجاح`, 'success');
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        setStructureInfo({
          fileType: 'xlsx',
          pageCount: readRes.pageCount,
          hasTables: true,
          hasImages: false,
          tableCount: readRes.tableCount,
          imageCount: 0,
          extractedText: readRes.extractedText,
        });
        addLog(`SheetJS: تم استخراج ${readRes.tableCount} ورقة عمل من Excel بنجاح`, 'success');
      } else if (lowerName.endsWith('.pptx')) {
        setStructureInfo({
          fileType: 'pptx',
          pageCount: readRes.pageCount,
          hasTables: false,
          hasImages: false,
          tableCount: 0,
          imageCount: 0,
          extractedText: readRes.extractedText,
        });
        addLog(`PPTX (JSZip): تم استخراج ${readRes.pageCount} شريحة عرض بنجاح`, 'success');
      } else {
        setStructureInfo({
          fileType: 'text',
          pageCount: readRes.pageCount,
          hasTables: false,
          hasImages: false,
          tableCount: 0,
          imageCount: 0,
          extractedText: readRes.extractedText,
        });
        addLog('تمت قراءة الملف النصي بنجاح.', 'success');
      }
    } catch (err: any) {
      console.error('Document parse error:', err);
      const errMsg = err?.message || 'فشل قراءة واستخراج محتوى الملف.';
      setErrorMessage(errMsg);
      addLog(errMsg, 'error');
    } finally {
      setParsingDoc(false);
    }
  };

  useEffect(() => {
    if (uploadedFile) {
      processDocumentFile(uploadedFile);
    }
  }, [uploadedFile]);

  useEffect(() => {
    if (initialOptions?.text) {
      setSourceText(initialOptions.text);
      if (initialOptions.targetLang) setTargetLang(resolveLangCode(initialOptions.targetLang));
      if (initialOptions.mode) setMode(initialOptions.mode);
    } else if (documentContent && !sourceText) {
      setSourceText(documentContent);
    }
  }, [initialOptions, documentContent]);

  if (!isOpen) return null;

  const effectiveTargetLang = (() => {
    const chosen = resolveSelectedOutputLanguage(targetLang, customLangCode);
    return chosen === 'original' ? 'ar' : chosen;
  })();

  const currentDisplayName = activeFile?.name || fileName || 'document';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processDocumentFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleExportPDF = async () => {
    if (!resultText) return;
    setIsExportingPDF(true);
    setPdfSuccessMessage(null);
    const targetPdfName = generatePDFFileName(currentDisplayName, effectiveTargetLang);
    try {
      addLog('PDF Export', 'pending', `جاري تجهيز ملف PDF (${targetPdfName})...`);
      await exportAsPDF({
        title: currentDisplayName ? `ترجمة ملف: ${currentDisplayName}` : `مستند مترجم إلى ${effectiveTargetLang}`,
        content: resultText,
        originalFileName: currentDisplayName,
        targetLang: effectiveTargetLang,
        sourceText: mode === 'dual' ? sourceText : undefined,
        mode,
      });
      addLog('PDF Export Success', 'success', `تم تحميل ملف PDF بنجاح: ${targetPdfName}`);
      setPdfSuccessMessage(`تم تحميل ${targetPdfName} بنجاح.`);
      setTimeout(() => setPdfSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error(err);
      addLog(`Error: [${err.message || 'فشل تصدير PDF'}]`, 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportWord = () => {
    if (!resultText) return;
    const base = currentDisplayName.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'MetaNy_Translated';
    const docName = `${base}_translated.doc`;
    const blob = buildWordDocBlob({
      title: `ترجمة: ${currentDisplayName}`,
      content: resultText,
      targetLang: effectiveTargetLang,
      sourceText: mode === 'dual' ? sourceText : undefined,
      mode,
    });
    triggerFileDownload(blob, docName);
    setPdfSuccessMessage(`تم تحميل ملف Word (${docName}) بنجاح.`);
    setTimeout(() => setPdfSuccessMessage(null), 5000);
  };

  const handleExportTxt = () => {
    if (!resultText) return;
    const base = currentDisplayName.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'MetaNy_Translated';
    const txtName = `${base}_translated.txt`;
    const content =
      mode === 'dual' && sourceText
        ? `=== النص الأصلي ===\n${sourceText}\n\n=== الترجمة (${effectiveTargetLang}) ===\n${resultText}`
        : resultText;
    triggerFileDownload(buildTxtBlob(content), txtName);
    setPdfSuccessMessage(`تم تحميل ملف TXT (${txtName}) بنجاح.`);
    setTimeout(() => setPdfSuccessMessage(null), 5000);
  };

  const handleTranslate = async () => {
    setErrorMessage(null);
    setDiagnosticLogs([]);
    setTranslatedFileBlob(null);

    addLog('بدء الترجمة', 'info', 'تجهيز النص للترجمة المباشرة عبر المتصفح (LibreTranslate -> MyMemory).');

    if (!sourceText.trim()) {
      const msg = 'يرجى كتابة نص أو رفع ملف لاستخراج النص وترجمته.';
      addLog(msg, 'error');
      setErrorMessage(msg);
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(5);
    setProgressLabel('جاري الاتصال بمحرك الترجمة...');

    try {
      const translationRes = await translateTextClientSide(
        sourceText,
        effectiveTargetLang,
        sourceLang,
        (info) => {
          setProgressPct(info.percent);
          setProgressLabel(info.status);
        }
      );

      const translated = translationRes.translatedText;
      const engineName =
        translationRes.engineUsed === 'libretranslate'
          ? 'LibreTranslate API'
          : translationRes.engineUsed === 'mixed'
          ? 'LibreTranslate + MyMemory'
          : 'MyMemory API';

      addLog(`اكتملت ترجمة النص بنجاح (${engineName})`, 'success');
      setResultText(translated);

      const reconstructed = reconstructDocumentHtml(
        translated,
        effectiveTargetLang,
        mode === 'dual',
        sourceText
      );
      setReconstructedHtml(reconstructed);

      let builtResultBlob: Blob | null = null;
      let builtResultName: string | null = null;

      if (activeFile) {
        const lowerName = activeFile.name.toLowerCase();
        const isSupportedDoc =
          lowerName.endsWith('.docx') ||
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.pptx') ||
          lowerName.endsWith('.pdf');

        if (isSupportedDoc) {
          addLog('معالجة الملف الأصلي', 'pending', `تجهيز نسخة مترجمة من ${activeFile.name}...`);
          try {
            const docRes = await translateExactDocument(
              activeFile,
              effectiveTargetLang,
              translated,
              (statusMsg) => addLog(statusMsg, 'info')
            );
            setTranslatedFileBlob(docRes.blob);
            setTranslatedExactFileName(docRes.fileName);
            builtResultBlob = docRes.blob;
            builtResultName = docRes.fileName;
            addLog('جاهز للتحميل', 'success', `تم تجهيز الملف (${docRes.fileName}) للتحميل.`);
          } catch (docErr: any) {
            addLog(`تنبيه المعالجة الهيكلية: ${docErr?.message || docErr}`, 'info');
          }
        }
      }

      const base = currentDisplayName.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'MetaNy_Translated';
      const fallbackWordBlob = buildWordDocBlob({
        title: `ترجمة: ${currentDisplayName}`,
        content: translated,
        targetLang: effectiveTargetLang,
        sourceText: mode === 'dual' ? sourceText : undefined,
        mode,
      });

      onSaveFile(
        `ترجمة ${currentDisplayName} إلى ${effectiveTargetLang}`,
        translated,
        'translate',
        {
          queryText: `ترجمة إلى ${effectiveTargetLang} (${mode}): ${sourceText.slice(0, 220)}`,
          targetLang: effectiveTargetLang,
          inputPreview: sourceText.slice(0, 1200),
          outputPreview: translated.slice(0, 2200),
          attachedFileName: activeFile?.name || fileName,
          attachedFileSize: activeFile?.size,
          attachedFileType: activeFile?.type,
        },
        {
          blob: builtResultBlob || fallbackWordBlob,
          fileName: builtResultName || `${base}_translated.doc`,
          mimeType: builtResultBlob?.type || 'application/msword',
          originalFile: activeFile,
        },
        effectiveTargetLang
      );
      if (onTranslateComplete) {
        onTranslateComplete(translated);
      }
    } catch (err: any) {
      console.error(err);
      const fullError = err?.message || 'فشلت عملية الترجمة. تأكد من اتصالك بالإنترنت.';
      addLog(`Error: [${fullError}]`, 'error');
      setErrorMessage(fullError);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const code = resolveLangCode(effectiveTargetLang);
      utterance.lang = code === 'ar' ? 'ar-SA' : code;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTargetRTL = isRtlLangCode(resolveLangCode(effectiveTargetLang));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-50 via-white to-teal-50/50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  ترجمة المستندات والملفات (PDF / Word / Excel / PPTX / TXT)
                </h2>
                {activeFile && (
                  <span className="text-[11px] font-mono bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800/70 truncate max-w-[180px]">
                    {activeFile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                قراءة داخل المتصفح عبر PDF.js و mammoth و SheetJS، والترجمة عبر LibreTranslate و MyMemory API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Structural Metadata Badges & Upload Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">حالة المستند:</span>

              {structureInfo ? (
                <>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800/70 text-[11px]">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>
                      {structureInfo.fileType === 'docx'
                        ? 'Word (mammoth)'
                        : structureInfo.fileType === 'xlsx'
                        ? 'Excel (SheetJS)'
                        : structureInfo.fileType === 'pptx'
                        ? 'PowerPoint (JSZip)'
                        : structureInfo.fileType === 'pdf'
                        ? 'PDF (PDF.js)'
                        : 'مستند نصي'}
                    </span>
                  </span>

                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/70 text-[11px]">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{structureInfo.pageCount} صفحة</span>
                  </span>

                  {structureInfo.tableCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/70 text-[11px]">
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>{structureInfo.tableCount} جداول</span>
                    </span>
                  )}

                  {structureInfo.imageCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/70 text-[11px]">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{structureInfo.imageCount} صور</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-400 text-xs">
                  {currentDisplayName ? `الملف: ${currentDisplayName}` : 'حد أقصى 20MB (PDF / Word / Excel / PPTX / TXT)'}
                </span>
              )}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingDoc}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-teal-500 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                {parsingDoc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                )}
                <span>{parsingDoc ? 'جاري القراءة...' : 'رفع مستند (حتى 20MB)'}</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl space-y-0.5">
            <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
            <p className="text-emerald-700 dark:text-emerald-300">
              سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between text-start gap-2 shadow-xs">
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

          {/* Controls Bar */}
          <div className="flex flex-wrap items-end justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <LanguageSelector
              value={targetLang}
              onChange={setTargetLang}
              customValue={customLangCode}
              onCustomChange={setCustomLangCode}
              includeOriginalOption={false}
              label="اللغة المستهدفة للترجمة"
              accent="teal"
              isRTL={true}
              testId="translate-output-language-select"
              className="min-w-[230px] flex-1 max-w-sm"
            />

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'single' ? 'bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                لغة واحدة
              </button>
              <button
                type="button"
                onClick={() => setMode('dual')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'dual' ? 'bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                مزدوج (لغتين)
              </button>
            </div>
          </div>

          {/* Text Areas */}
          <div className={`grid gap-4 ${mode === 'dual' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  النص الأصلي والمستند المستخرج
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {sourceText.length} حرف
                </span>
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="اكتب أو الصق النص هنا، أو ارفع ملف PDF / Word / Excel / PPTX / TXT..."
                rows={6}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-sans focus:outline-hidden focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 resize-y text-right"
              />
            </div>

            {mode === 'dual' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الترجمة الفورية الموازية ({effectiveTargetLang})
                </label>
                <div className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 min-h-[150px] max-h-[220px] overflow-y-auto whitespace-pre-line text-right">
                  {resultText || 'ستظهر الترجمة المقابلة هنا...'}
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {(loading || parsingDoc || progressPct > 0) && (
            <ToolProgressBar
              progress={progressPct}
              label={progressLabel}
              active={loading || parsingDoc}
              accent="teal"
            />
          )}

          {/* Translate Button */}
          <button
            onClick={handleTranslate}
            disabled={loading || parsingDoc}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-teal-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {loading
                ? 'جارٍ الترجمة عبر LibreTranslate / MyMemory...'
                : 'ترجمة المستند الآن'}
            </span>
          </button>

          {/* DiagnosticLogger */}
          <DiagnosticLogger
            events={diagnosticLogs}
            onClear={() => setDiagnosticLogs([])}
            title="سجل معالجة المستندات والترجمة (PDF.js / mammoth / SheetJS)"
            placeholderText="جاهز لقراءة الملفات محلياً حتى 20MB وترجمتها وتحميلها بصيغ PDF و Word و TXT."
          />

          {/* Success Banner */}
          {pdfSuccessMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{pdfSuccessMessage}</span>
            </div>
          )}

          {/* Reconstructed Document Output Area */}
          {(resultText || translatedFileBlob) && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {translatedFileBlob && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/60 dark:via-teal-950/50 dark:to-emerald-950/60 border-2 border-emerald-300 dark:border-emerald-700/70 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md shadow-emerald-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
                      <FileDown className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                          نسخة الملف الأصلي المترجمة جاهزة للتحميل:
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                          {translatedExactFileName}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        اضغط للتحميل المباشر أو اختر التحميل بصيغة PDF أو Word أو TXT أدناه.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerFileDownload(translatedFileBlob, translatedExactFileName || 'document')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>تحميل الملف الأصلي المترجم</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">الترجمة الناتجة:</span>
                  <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800/70 truncate max-w-[200px]">
                    {generatePDFFileName(currentDisplayName, effectiveTargetLang)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('reconstructed')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        activeTab === 'reconstructed'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>منسق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('text')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        activeTab === 'text'
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span>نص خام</span>
                    </button>
                  </div>

                  {/* Export as PDF */}
                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-70"
                  >
                    {isExportingPDF ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    <span>{isExportingPDF ? 'جاري التجهيز...' : 'تحميل PDF'}</span>
                  </button>

                  {/* Export as Word */}
                  <button
                    onClick={handleExportWord}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>تحميل Word</span>
                  </button>

                  {/* Export as TXT */}
                  <button
                    onClick={handleExportTxt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>تحميل TXT</span>
                  </button>

                  <button
                    onClick={() => handleSpeak(resultText)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition-colors cursor-pointer"
                    title="استماع صوتي"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>

              {activeTab === 'reconstructed' && (
                <div
                  dir={isTargetRTL ? 'rtl' : 'ltr'}
                  className={`bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 text-xs sm:text-sm text-slate-800 dark:text-slate-200 max-h-[380px] overflow-y-auto shadow-inner ${
                    isTargetRTL ? 'text-right' : 'text-left'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html:
                      reconstructedHtml ||
                      reconstructDocumentHtml(resultText, effectiveTargetLang, mode === 'dual', sourceText),
                  }}
                />
              )}

              {activeTab === 'text' && (
                <div
                  dir={isTargetRTL ? 'rtl' : 'ltr'}
                  className={`bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans whitespace-pre-line ${
                    isTargetRTL ? 'text-right' : 'text-left'
                  } max-h-[300px] overflow-y-auto select-text`}
                >
                  {resultText}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
