import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ListChecks,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Download,
  FileText,
  Upload,
  BookOpen,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  extractMultilingualDocumentQuestions,
  ExtractedQuestionsBundle,
  renderQuestionsBundleToPdfBlob,
  buildQuestionsWordDocBlob,
} from '../../utils/clientAiTools';
import { readFileClientSide } from '../../utils/clientFileReader';
import { buildTxtBlob, clearTranslationCache } from '../../utils/clientTranslator';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import {
  LanguageSelector,
  BILINGUAL_AR_EN_CODE,
  resolveSelectedOutputLanguage,
} from '../LanguageSelector';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';

interface QuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  onSaveFile: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null },
    targetLang?: string
  ) => void;
  checkAdOrVIP: () => Promise<boolean>;
}

export const QuestionsModal: React.FC<QuestionsModalProps> = ({
  isOpen,
  onClose,
  documentContent,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileObj, setUploadedFileObj] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState(documentContent || '');
  const [qType, setQType] = useState<'essay' | 'true_false' | 'ministerial'>('essay');
  const [count, setCount] = useState(20);
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'custom'>('all');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(5);
  const [outputLang, setOutputLang] = useState<string>(BILINGUAL_AR_EN_CODE);
  const [customLangCode, setCustomLangCode] = useState<string>('');

  const [bundle, setBundle] = useState<ExtractedQuestionsBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (documentContent && !sourceText) {
      setSourceText(documentContent);
    }
  }, [documentContent]);

  if (!isOpen) return null;

  // Detect how many page markers exist in sourceText
  const detectedPagesCount = Math.max(
    1,
    (sourceText.match(/---\s*(?:صفحة|Page)\s+\d+/gi) || []).length
  );

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setLoading(true);
    setProgressPct(15);
    setProgressLabel(isRTL ? `جاري قراءة الملف (${file.name})...` : `Reading ${file.name}...`);

    try {
      const res = await readFileClientSide(
        file,
        (pct, msg) => {
          setProgressPct(pct);
          setProgressLabel(msg);
        },
        isRTL
      );
      if (!res.extractedText || res.extractedText.trim().length < 20) {
        throw new Error('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
      }
      setSourceText(res.extractedText);
      setUploadedFileName(file.name);
      setUploadedFileObj(file);
      setToPage(Math.min(Math.max(1, res.pageCount), 10));
      setBundle(null);
      setProgressPct(95);
      setProgressLabel(isRTL ? 'جاري رفع الملف إلى السيرفر...' : 'Uploading file to server...');
      const uploadedMeta = await uploadFileToCloudOrServer(file, file.name, file.type, 'original');
      setProgressPct(100);
      setProgressLabel(
        isRTL
          ? `تم استخراج نص الملف (${res.wordCount} كلمة / ${res.pageCount} صفحة)`
          : `Loaded ${file.name} (${res.wordCount} words)`
      );
      const preselectedLang = resolveSelectedOutputLanguage(outputLang, customLangCode);
      onSaveFile(
        isRTL ? `ملف مستند للأسئلة: ${file.name}` : `Q&A doc uploaded: ${file.name}`,
        res.extractedText.slice(0, 1200),
        'file_upload',
        {
          attachedFileName: file.name,
          attachedFileSize: file.size,
          attachedFileType: file.type,
          inputPreview: res.extractedText.slice(0, 1200),
          targetLang: preselectedLang,
          originalFileUrl: uploadedMeta?.url,
          originalFileStoragePath: uploadedMeta?.storagePath,
        },
        {
          blob: buildTxtBlob(res.extractedText),
          fileName: `${file.name}_extracted.txt`,
          mimeType: 'text/plain;charset=utf-8',
          originalFile: file,
        },
        preselectedLang
      );
    } catch (err: any) {
      setErrorMsg(
        err?.message || (isRTL ? 'فشل قراءة الملف المرفوع (الحد الأقصى 20MB).' : 'Failed to read file.')
      );
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setBundle(null);

    const activeSource = (sourceText || documentContent || '').trim();
    if (!activeSource || activeSource.length < 100) {
      setErrorMsg('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(15);
    setProgressLabel(
      isRTL
        ? 'جاري تحليل النص واستخراج الأسئلة والأجوبة باللغة المطلوبة...'
        : 'Analyzing text & generating Q&As in target language...'
    );

    const chosenOutputLanguage = resolveSelectedOutputLanguage(outputLang, customLangCode);

    try {
      clearTranslationCache();
      const res = await extractMultilingualDocumentQuestions({
        sourceText: activeSource,
        type: qType,
        count,
        pageRangeMode,
        fromPage,
        toPage,
        outputLanguage: chosenOutputLanguage,
        onProgress: (pct, lbl) => {
          setProgressPct(pct);
          setProgressLabel(lbl);
        },
      });

      setBundle(res);
      const finalLang = res.outputLangCode || chosenOutputLanguage;
      setProgressPct(100);
      setProgressLabel(
        isRTL
          ? `تم استخراج ${res.questions.length} سؤالاً وأجوبة موثقة (${finalLang})!`
          : `Extracted ${res.questions.length} fact-verified Q&As (${finalLang})!`
      );

      let resultPdfBlob: Blob;
      let resultFileName = `MetaNy_Verified_Questions_${res.questions.length}.pdf`;
      try {
        resultPdfBlob = await renderQuestionsBundleToPdfBlob(
          res,
          res.isBilingualArEn
            ? `أسئلة وأجوبة باللغتين — عربي ثم إنكليزي (${res.questions.length} سؤالاً)`
            : res.outputIsRTL
            ? `أسئلة وأجوبة موثقة من النص (${res.questions.length} سؤالاً)`
            : `Verified Q&A (${res.questions.length})`
        );
      } catch {
        resultPdfBlob = buildTxtBlob(res.formattedText);
        resultFileName = `MetaNy_Verified_Questions_${res.questions.length}.txt`;
      }

      onSaveFile(
        uploadedFileName
          ? isRTL
            ? `أسئلة موثقة: ${uploadedFileName}`
            : `Verified Q&A: ${uploadedFileName}`
          : isRTL
          ? `أسئلة موثقة (${res.questions.length})`
          : `Verified Q&A (${res.questions.length})`,
        res.formattedText,
        'questions',
        {
          queryText: `استخراج ${res.questions.length} سؤال (${res.pagesUsedLabel}) · اللغة: ${finalLang} · النوع: ${qType}`,
          inputPreview: activeSource.slice(0, 1200),
          outputPreview: res.formattedText.slice(0, 2200),
          attachedFileName: uploadedFileName || undefined,
          targetLang: finalLang,
        },
        {
          blob: resultPdfBlob,
          fileName: resultFileName,
          mimeType: resultPdfBlob.type,
          originalFile: uploadedFileObj,
        },
        finalLang
      );
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول'
      );
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!bundle?.formattedText) return;
    navigator.clipboard.writeText(bundle.formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!bundle?.formattedText) return;
    triggerFileDownload(
      buildTxtBlob(bundle.formattedText),
      `MetaNy_Verified_Questions_${bundle.questions.length}.txt`
    );
  };

  const handleDownloadWord = () => {
    if (!bundle?.formattedText) return;
    const title = bundle.isBilingualArEn
      ? `بنك الأسئلة والأجوبة باللغتين — عربي ثم إنكليزي (${bundle.questions.length} سؤالاً)`
      : bundle.outputIsRTL
      ? `بنك الأسئلة والأجوبة المستخرج من النص (${bundle.questions.length} سؤالاً)`
      : `Extracted Fact-Verified Q&A (${bundle.questions.length})`;
    const blob = buildQuestionsWordDocBlob(bundle, title);
    triggerFileDownload(blob, `MetaNy_Verified_Questions_${bundle.questions.length}.doc`);
  };

  const handleDownloadPdf = async () => {
    if (!bundle?.formattedText) return;
    const title = bundle.isBilingualArEn
      ? `أسئلة وأجوبة باللغتين — عربي ثم إنكليزي (${bundle.questions.length} سؤالاً)`
      : bundle.outputIsRTL
      ? `أسئلة وأجوبة موثقة من النص (${bundle.questions.length} سؤالاً)`
      : `Verified Q&A (${bundle.questions.length})`;
    const blob = await renderQuestionsBundleToPdfBlob(bundle, title);
    triggerFileDownload(blob, `MetaNy_Verified_Questions_${bundle.questions.length}.pdf`);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.serviceQuestions}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'استخراج 20 إلى 30 سؤالاً وجواباً حقيقياً من الحقائق والأرقام والتعاريف والأمثلة داخل الملف فقط (مع الجملة الأصلية ورقم الفقرة)'
                  : 'Extract 20–30 strictly verified Q&As directly from facts, numbers, definitions & examples inside your text'}
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
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Direct File Upload inside Modal */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>
                  {uploadedFileName
                    ? isRTL
                      ? `الملف النشط: ${uploadedFileName} (${detectedPagesCount} صفحة)`
                      : `Loaded: ${uploadedFileName} (${detectedPagesCount} pages)`
                    : isRTL
                    ? `ارفع ملف (PDF / Word / TXT حتى 20MB) أو الصق النص بالأسفل`
                    : 'Upload PDF / Word / TXT (max 20MB) or paste text below'}
                </span>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUploadDoc}
                  accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'رفع ملف للاستخراج' : 'Upload Document'}</span>
                </button>
              </div>
            </div>
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 space-y-0.5">
              <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
              <p className="text-emerald-700 dark:text-emerald-300">
                سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
              </p>
            </div>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <LanguageSelector
              value={outputLang}
              onChange={setOutputLang}
              customValue={customLangCode}
              onCustomChange={setCustomLangCode}
              includeBilingualArEnOption={true}
              label={isRTL ? 'لغة الأسئلة والأجوبة' : 'Q&A Language'}
              accent="amber"
              isRTL={isRTL}
              testId="questions-output-language-select"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'عدد الأسئلة (من الحقائق)' : 'Question Count'}
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value={20}>{isRTL ? '20 سؤالاً (افتراضي)' : '20 Questions'}</option>
                <option value={25}>{isRTL ? '25 سؤالاً' : '25 Questions'}</option>
                <option value={30}>{isRTL ? '30 سؤالاً' : '30 Questions'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'صيغة الأسئلة المسموحة' : 'Format'}
              </label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="essay">{isRTL ? 'تعاريف / أسباب / أرقام / نتائج + أمثلة' : 'Definitions, Causes, Numbers & Results'}</option>
                <option value="ministerial">{isRTL ? 'امتحاني شامل مع الدليل النصي' : 'Exam Style with Textual Evidence'}</option>
                <option value="true_false">{isRTL ? 'تحقق من العبارات النصية (صح/خطأ)' : 'Text Fact Verification (T/F)'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'نطاق الصفحات' : 'Page Scope'}
              </label>
              <select
                value={pageRangeMode}
                onChange={(e) => setPageRangeMode(e.target.value as 'all' | 'custom')}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="all">
                  {isRTL ? `الملف كامل (${detectedPagesCount} صفحة)` : `Full File (${detectedPagesCount}p)`}
                </option>
                <option value="custom">{isRTL ? 'تحديد نطاق صفحات معين' : 'Specific Page Range'}</option>
              </select>
            </div>
          </div>

          {pageRangeMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span>{isRTL ? 'من صفحة:' : 'From page:'}</span>
              <input
                type="number"
                min={1}
                max={detectedPagesCount}
                value={fromPage}
                onChange={(e) => setFromPage(Math.max(1, Number(e.target.value)))}
                className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-center"
              />
              <span>{isRTL ? 'إلى صفحة:' : 'To page:'}</span>
              <input
                type="number"
                min={1}
                max={detectedPagesCount}
                value={toPage}
                onChange={(e) => setToPage(Math.max(1, Number(e.target.value)))}
                className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-center"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL
                ? 'النص الكامل للملف (يُقرأ بالكامل وتُستخرج الأسئلة حرفياً من حقائقه):'
                : 'Source Document Text:'}
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={5}
              placeholder={
                isRTL
                  ? 'ارفع ملفاً أعلاه أو الصق هنا نصاً دراسياً طويلاً يحتوي على تعاريف وأرقام وأسباب ونتائج وأمثلة (لا يقل عن 4 حقائق)...'
                  : 'Upload a document above or paste full study text here containing facts, definitions, numbers & examples...'
              }
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-amber-500 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {(loading || progressPct > 0) && (
            <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="amber" />
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {loading
                ? isRTL
                  ? 'جارٍ قراءة الملف واستخراج الحقائق...'
                  : 'Extracting verified Q&As...'
                : isRTL
                ? `استخراج الأسئلة والأجوبة الحقيقية (${count})`
                : `Extract Verified Q&As (${count})`}
            </span>
          </button>

          {bundle && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isRTL
                    ? `تم استخراج ${bundle.questions.length} سؤالاً موثقاً من ${bundle.totalParagraphs} فقرة (${bundle.pagesUsedLabel})`
                    : `${bundle.questions.length} Verified Questions · ${bundle.totalParagraphs} Paragraphs`}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? t.copied : t.copy}</span>
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                  <button
                    onClick={handleDownloadWord}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {/* Structured Fact-Verified Question Cards */}
              <div
                dir={bundle.outputIsRTL ? 'rtl' : 'ltr'}
                className={`space-y-4 max-h-[440px] overflow-y-auto pr-1 ${
                  bundle.outputIsRTL ? 'text-right' : 'text-left'
                }`}
              >
                {bundle.questions.map((item) =>
                  typeof item.questionAr === 'string' && typeof item.questionEn === 'string' ? (
                    <div
                      key={item.number}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 text-xs sm:text-sm shadow-xs"
                    >
                      <div
                        dir="rtl"
                        lang="ar"
                        className="[unicode-bidi:isolate] flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200 font-extrabold border-b border-slate-100 dark:border-slate-700/80 pb-2"
                      >
                        <span>س{item.number}:</span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                          الفقرة {item.paragraphNumber}
                        </span>
                      </div>

                      <div
                        dir="rtl"
                        lang="ar"
                        className="[unicode-bidi:isolate] p-3.5 rounded-xl bg-sky-50/95 dark:bg-sky-950/45 border border-sky-200 dark:border-sky-800 text-right"
                      >
                        <span className="block text-[11.5px] font-extrabold text-sky-800 dark:text-sky-300 mb-1">
                          السؤال بالعربي:
                        </span>
                        <p className="font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                          {item.questionAr || 'جاري الترجمة'}
                        </p>
                      </div>

                      <div
                        dir="ltr"
                        lang="en"
                        className="[unicode-bidi:isolate] p-3.5 rounded-xl bg-emerald-50/95 dark:bg-emerald-950/45 border border-emerald-200 dark:border-emerald-800 text-left"
                      >
                        <span className="block text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-300 mb-1">
                          Question in English:
                        </span>
                        <p className="font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                          {item.questionEn || 'Translating...'}
                        </p>
                      </div>

                      <div
                        dir="rtl"
                        lang="ar"
                        className="[unicode-bidi:isolate] p-3.5 rounded-xl bg-sky-50/95 dark:bg-sky-950/45 border border-sky-200 dark:border-sky-800 text-right"
                      >
                        <span className="block text-[11.5px] font-extrabold text-sky-800 dark:text-sky-300 mb-1">
                          الجواب بالعربي:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {item.answerAr || 'جاري الترجمة'}
                        </p>
                      </div>

                      <div
                        dir="ltr"
                        lang="en"
                        className="[unicode-bidi:isolate] p-3.5 rounded-xl bg-emerald-50/95 dark:bg-emerald-950/45 border border-emerald-200 dark:border-emerald-800 text-left"
                      >
                        <span className="block text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-300 mb-1">
                          Answer in English:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {item.answerEn || 'Translating...'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={item.number}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs sm:text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        <span>
                          #{item.number} · {item.categoryLabel}
                        </span>
                        <span className="font-mono text-amber-700 dark:text-amber-300">
                          ¶ {item.paragraphNumber}
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                        {item.question}
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
                        <strong className="block mb-0.5">
                          {bundle.outputIsRTL ? 'الجواب الموثق:' : 'Verified Answer:'}
                        </strong>
                        {item.answer}
                      </div>

                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>{bundle.outputIsRTL ? 'الجملة الأصلية من النص: ' : 'Original Sentence: '}</strong>
                        &ldquo;{item.originalSentence}&rdquo;
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
