import React, { useState } from 'react';
import { X, BrainCircuit, Sparkles, Copy, Check, RefreshCw, HelpCircle, AlertCircle, Download, FileText } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { solveQuestionMultilingualClientSide } from '../../utils/clientAiTools';
import { buildTxtBlob, buildWordDocBlob } from '../../utils/clientTranslator';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import { LanguageSelector, resolveSelectedOutputLanguage } from '../LanguageSelector';
import { CommandAuditMeta } from '../../types';

interface SolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContext: string;
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

export const SolveModal: React.FC<SolveModalProps> = ({
  isOpen,
  onClose,
  documentContext,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [outputLang, setOutputLang] = useState<string>('original');
  const [customLangCode, setCustomLangCode] = useState<string>('');
  const [solution, setSolution] = useState('');
  const [solutionMeta, setSolutionMeta] = useState<{ outputLangCode: string; outputIsRTL: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSolve = async (mode: 'normal' | 'explain_more' | 'alternative_method' = 'normal') => {
    setErrorMsg(null);
    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    if (!question.trim() && !documentContext.trim()) {
      setErrorMsg(
        isRTL
          ? 'يرجى كتابة معادلة أو سؤال، أو رفع مستند أولاً لتحليله.'
          : 'Please enter a math expression or question, or upload a document first.'
      );
      return;
    }

    const chosenOutputLanguage = resolveSelectedOutputLanguage(outputLang, customLangCode);

    setLoading(true);
    setProgressPct(25);
    setProgressLabel(isRTL ? 'جاري تحليل المعطيات داخل المتصفح...' : 'Analyzing problem in browser...');

    try {
      const res = await solveQuestionMultilingualClientSide({
        question,
        context: documentContext,
        mode,
        outputLanguage: chosenOutputLanguage,
        isRTL,
        onProgress: (pct, lbl) => {
          setProgressPct(pct);
          setProgressLabel(lbl);
        },
      });

      const resolvedLang = res.outputLangCode || chosenOutputLanguage;
      setProgressPct(100);
      setProgressLabel(
        isRTL ? `تم استخراج الحل بنجاح (${resolvedLang})!` : `Solution ready (${resolvedLang})!`
      );
      setSolution(res.solution);
      setSolutionMeta({ outputLangCode: resolvedLang, outputIsRTL: res.outputIsRTL });

      onSaveFile(
        question
          ? isRTL
            ? `حل: ${question.slice(0, 30)}`
            : `Solution: ${question.slice(0, 30)}`
          : isRTL
          ? 'حل أسئلة المستند'
          : 'Document Solutions',
        res.solution,
        'solve',
        {
          queryText: `${question || 'تحليل مستند وحل أسئلته'} · اللغة: ${resolvedLang}`,
          outputPreview: res.solution.slice(0, 2200),
          targetLang: resolvedLang,
        },
        {
          blob: buildTxtBlob(res.solution),
          fileName: 'MetaNy_Solution.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        resolvedLang
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || (isRTL ? 'حدث خطأ أثناء التحليل.' : 'Failed to solve problem.'));
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resultIsRTL = solutionMeta ? solutionMeta.outputIsRTL : isRTL;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-50 via-white to-sky-50/50 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {isRTL ? 'محلل المعادلات وأسئلة المستندات' : 'Equation & Document Question Solver'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'حل المعادلات الخطية والحسابية خطوة بخطوة واستخراج الإجابات من المستند المرفوع'
                  : 'Step-by-step math solver & document evidence extractor running 100% in browser'}
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
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <LanguageSelector
              value={outputLang}
              onChange={setOutputLang}
              customValue={customLangCode}
              onCustomChange={setCustomLangCode}
              label={isRTL ? 'لغة الحل والشرح المطلوبة' : 'Solution Output Language'}
              accent="sky"
              isRTL={isRTL}
              testId="solve-output-language-select"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL ? 'السؤال أو المعادلة (مثال: 2x + 4 = 12)' : 'Question or Equation (e.g. 2x + 4 = 12)'}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                isRTL
                  ? 'اكتب مسألة رياضية أو سؤالاً للبحث عن إجابته في المستند المرفوع...'
                  : 'Type an equation or a question to search inside your uploaded document...'
              }
              rows={3}
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 resize-none ${isRTL ? 'text-right' : 'text-left'}`}
            />
          </div>

          {(loading || progressPct > 0) && (
            <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="sky" />
          )}

          <button
            onClick={() => handleSolve('normal')}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-sky-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {loading
                ? isRTL
                  ? 'جارٍ الحل والتحليل...'
                  : 'Solving...'
                : isRTL
                ? 'تحليل وحل الآن'
                : 'Solve Now'}
            </span>
          </button>

          {solution && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'النتيجة والشرح:' : 'Solution & Explanation:'}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t.copied : t.copy}</span>
                  </button>
                  <button
                    onClick={() => triggerFileDownload(buildTxtBlob(solution), 'MetaNy_Solution.txt')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerFileDownload(
                        buildWordDocBlob({
                          title: 'MetaNy Solution',
                          content: solution,
                          targetLang: solutionMeta?.outputLangCode,
                        }),
                        'MetaNy_Solution.doc'
                      )
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>
                </div>
              </div>

              <div
                dir={resultIsRTL ? 'rtl' : 'ltr'}
                className={`bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-sans leading-relaxed whitespace-pre-line ${resultIsRTL ? 'text-right' : 'text-left'}`}
              >
                {solution}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleSolve('explain_more')}
                  disabled={loading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{isRTL ? 'توسيع الأدلة من النص' : 'Show More Evidence'}</span>
                </button>

                <button
                  onClick={() => handleSolve('alternative_method')}
                  disabled={loading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{isRTL ? 'تحقق بطريقة بديلة' : 'Alternative Verification'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
