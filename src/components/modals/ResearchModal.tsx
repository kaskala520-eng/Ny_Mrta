import React, { useState, useRef } from 'react';
import {
  X,
  GraduationCap,
  Download,
  Copy,
  Check,
  FileText,
  Sparkles,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  generateMultilingualStructuredResearch,
  renderResearchHtmlToPdfBlob,
  buildResearchWordDocBlob,
  ResearchDiscipline,
  ResearchDocumentData,
} from '../../utils/scientificResearchEngine';
import { readFileClientSide, validateFileSize } from '../../utils/clientFileReader';
import { buildTxtBlob } from '../../utils/clientTranslator';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import { LanguageSelector, resolveSelectedOutputLanguage } from '../LanguageSelector';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';
import { trackToolActivity } from '../../utils/adminTracking';

interface ResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceContent: string;
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

export const ResearchModal: React.FC<ResearchModalProps> = ({
  isOpen,
  onClose,
  sourceContent,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [topic, setTopic] = useState('');
  const [researcherName, setResearcherName] = useState('');
  const [points, setPoints] = useState('');
  const [discipline, setDiscipline] = useState<ResearchDiscipline>('auto');
  const [researchType, setResearchType] = useState('بحث علمي جامعي');
  const [pagesCount, setPagesCount] = useState(10);
  const [academicLevel, setAcademicLevel] = useState('بكالوريوس');
  const [outputLang, setOutputLang] = useState<string>('original');
  const [customLangCode, setCustomLangCode] = useState<string>('');
  const [attachedDocText, setAttachedDocText] = useState('');
  const [attachedDocName, setAttachedDocName] = useState('');
  const [attachedDocFile, setAttachedDocFile] = useState<File | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [report, setReport] = useState<ResearchDocumentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const combinedSource = [attachedDocText, sourceContent].filter(Boolean).join('\n\n');

  const handleAttachDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const res = await readFileClientSide(file, undefined, isRTL);
      setAttachedDocText(res.extractedText || '');
      setAttachedDocName(file.name);
      setAttachedDocFile(file);
      if (!topic.trim()) {
        setTopic(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
      }
      const uploadedMeta = await uploadFileToCloudOrServer(file, file.name, file.type, 'original');
      const chosenLang = resolveSelectedOutputLanguage(outputLang, customLangCode);
      onSaveFile(
        isRTL ? `ملف مرجعي للبحث: ${file.name}` : `Research reference doc: ${file.name}`,
        (res.extractedText || '').slice(0, 1200),
        'file_upload',
        {
          attachedFileName: file.name,
          attachedFileSize: file.size,
          attachedFileType: file.type,
          inputPreview: (res.extractedText || '').slice(0, 1200),
          targetLang: chosenLang,
          originalFileUrl: uploadedMeta?.url,
          originalFileStoragePath: uploadedMeta?.storagePath,
        },
        {
          blob: buildTxtBlob(res.extractedText || file.name),
          fileName: `${file.name}_reference.txt`,
          mimeType: 'text/plain;charset=utf-8',
          originalFile: file,
        },
        chosenLang
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'تعذر قراءة الملف المرفق.' : 'Failed to read file.'));
    }
  };

  const handleAttachImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    e.target.value = '';
    try {
      const urls: string[] = [];
      for (const f of files) {
        validateFileSize(f, isRTL);
        const url = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error('Image read error'));
          r.readAsDataURL(f);
        });
        urls.push(url);
      }
      setAttachedImages((prev) => [...prev, ...urls].slice(0, 4));
      const firstUploaded = await uploadFileToCloudOrServer(
        files[0],
        files[0].name,
        files[0].type || 'image/png',
        'original'
      );
      trackToolActivity({
        command: 'file_upload',
        details: isRTL ? `صور مرفقة للبحث (${files.map((x) => x.name).join(', ')})` : `Research images (${files.length})`,
        status: 'success',
        audit: {
          attachedFileName: files[0].name,
          attachedFileSize: files.reduce((s, x) => s + x.size, 0),
          attachedFileType: files[0].type || 'image/*',
          originalFileUrl: firstUploaded?.url,
          originalFileStoragePath: firstUploaded?.storagePath,
        },
      });
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل إرفاق الصور.' : 'Failed to load images.'));
    }
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    if (!topic.trim() && !points.trim() && !combinedSource.trim()) {
      setErrorMsg(
        isRTL
          ? 'يرجى إدخال عنوان البحث (أو رفع ملف مرجعي) لإنشاء بحث علمي متكامل.'
          : 'Please enter a research title (or attach a reference file).'
      );
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(20);
    setProgressLabel(
      isRTL
        ? 'جاري تحديد التخصص وإعداد الغلاف والملخص والمقدمة...'
        : 'Structuring Cover, Abstract & Introduction...'
    );

    const chosenOutputLanguage = resolveSelectedOutputLanguage(outputLang, customLangCode);

    try {
      const generated = await generateMultilingualStructuredResearch({
        topic,
        points,
        sourceContent: combinedSource,
        researchType,
        academicLevel,
        pagesCount,
        researcherName: researcherName.trim() || undefined,
        discipline,
        attachedImages,
        outputLanguage: chosenOutputLanguage,
        isRTL,
        onProgress: (pct, lbl) => {
          setProgressPct(pct);
          setProgressLabel(lbl);
        },
      });

      const resolvedOutputLang = generated.outputLanguage || chosenOutputLanguage;
      setReport(generated);
      setProgressPct(100);
      setProgressLabel(
        isRTL
          ? `تم إعداد البحث العلمي المتكامل بنجاح (${resolvedOutputLang})!`
          : `Complete research paper ready (${resolvedOutputLang})!`
      );

      const fileTitle = generated.topic.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 50) || 'Research';
      const wordBlob = buildResearchWordDocBlob(generated);

      onSaveFile(
        isRTL ? `بحث علمي: ${generated.topic}` : `Research: ${generated.topic}`,
        generated.plainMarkdown,
        'research',
        {
          queryText: `${generated.topic}${points.trim() ? ` | المحاور: ${points.trim()}` : ''} · التخصص: ${generated.discipline} · اللغة: ${resolvedOutputLang}`,
          inputPreview: combinedSource ? combinedSource.slice(0, 1200) : points.trim() || generated.topic,
          outputPreview: generated.plainMarkdown.slice(0, 2200),
          attachedFileName: attachedDocName || undefined,
          targetLang: resolvedOutputLang,
        },
        {
          blob: wordBlob,
          fileName: `${fileTitle}.doc`,
          mimeType: 'application/msword',
          originalFile: attachedDocFile,
        },
        resolvedOutputLang
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err?.message || (isRTL ? 'حدث خطأ أثناء إعداد البحث.' : 'Failed to build research.')
      );
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.plainMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadWord = () => {
    if (!report) return;
    const fileTitle = report.topic.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    const blob = buildResearchWordDocBlob(report);
    triggerFileDownload(blob, `${fileTitle}.doc`);
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsExportingPdf(true);
    try {
      const fileTitle = report.topic.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
      const blob = await renderResearchHtmlToPdfBlob(report);
      triggerFileDownload(blob, `${fileTitle}.pdf`);
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل تصدير ملف PDF' : 'PDF export failed'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!report) return;
    const fileTitle = report.topic.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    triggerFileDownload(buildTxtBlob(report.plainMarkdown), `${fileTitle}.txt`);
  };

  const scholarSearchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(
    topic.trim() || 'scientific research'
  )}`;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-purple-50/50 dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.featureAcademicTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'بحث علمي متكامل (غلاف، ملخص 150 كلمة، مقدمة، فصول، معادلات KaTeX، جداول، رسوم SVG وبيانية، و8 مصادر حقيقية)'
                  : 'Complete Scientific Paper (Cover, 150w Abstract, Intro, Chapters, KaTeX Math, Tables, SVG Diagrams & Charts, 8 Real Sources)'}
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

          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-3 py-1.5 rounded-xl space-y-0.5">
            <p>سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته</p>
            <p className="text-emerald-700 dark:text-emerald-300">
              سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
            </p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <LanguageSelector
              value={outputLang}
              onChange={setOutputLang}
              customValue={customLangCode}
              onCustomChange={setCustomLangCode}
              label={isRTL ? 'لغة البحث المطلوبة' : 'Output Language'}
              accent="purple"
              isRTL={isRTL}
              testId="research-output-language-select"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'التخصص العلمي / الأدبي' : 'Field / Discipline'}
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as ResearchDiscipline)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="auto">{isRTL ? 'كشف تلقائي من العنوان' : 'Auto-Detect'}</option>
                <option value="physics">{isRTL ? 'علمي: الفيزياء' : 'Physics'}</option>
                <option value="chemistry">{isRTL ? 'علمي: الكيمياء' : 'Chemistry'}</option>
                <option value="math">{isRTL ? 'علمي: الرياضيات' : 'Mathematics'}</option>
                <option value="medicine">{isRTL ? 'علمي: الطب والأحياء' : 'Medicine & Biology'}</option>
                <option value="engineering">{isRTL ? 'علمي: الهندسة' : 'Engineering'}</option>
                <option value="cs">{isRTL ? 'علمي: علوم الحاسوب' : 'Computer Science'}</option>
                <option value="humanities">{isRTL ? 'أدبي / إنساني / تاريخي' : 'Humanities & Literature'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'نوع البحث' : 'Paper Type'}
              </label>
              <select
                value={researchType}
                onChange={(e) => setResearchType(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="بحث علمي جامعي">{isRTL ? 'بحث علمي جامعي' : 'University Research'}</option>
                <option value="تقرير أكاديمي">{isRTL ? 'تقرير أكاديمي' : 'Academic Report'}</option>
                <option value="مشروع تخرج">{isRTL ? 'مشروع تخرج' : 'Graduation Thesis'}</option>
                <option value="دراسة منهجية">{isRTL ? 'دراسة منهجية' : 'Methodological Study'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'المستوى الأكاديمي' : 'Academic Level'}
              </label>
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="ثانوي">{isRTL ? 'ثانوي' : 'High School'}</option>
                <option value="بكالوريوس">{isRTL ? 'جامعي (بكالوريوس)' : 'Undergraduate'}</option>
                <option value="ماجستير / دكتوراه">{isRTL ? 'دراسات عليا' : 'Postgraduate'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'الحجم التقديري' : 'Target Pages'}
              </label>
              <select
                value={pagesCount}
                onChange={(e) => setPagesCount(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value={5}>{isRTL ? '5 صفحات' : '5 Pages'}</option>
                <option value={10}>{isRTL ? '10 صفحات (قياسي)' : '10 Pages'}</option>
                <option value={15}>{isRTL ? '15 صفحة (موسع)' : '15 Pages'}</option>
              </select>
            </div>
          </div>

          {/* Topic + Researcher Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'عنوان البحث العلمي أو التقرير' : 'Research Title'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  isRTL
                    ? 'مثال: تطبيقات الكيمياء التحليلية / قوانين نيوتن في الهندسة / مقدمة ابن خلدون...'
                    : 'Example: Quantum Mechanics / Cellular Homeostasis / Algorithmic Complexity...'
                }
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isRTL ? 'اسم الباحث (للغلاف)' : 'Researcher Name'}
              </label>
              <input
                type="text"
                value={researcherName}
                onChange={(e) => setResearcherName(e.target.value)}
                placeholder={isRTL ? 'اسم الباحث أو الطالب...' : 'Researcher name...'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-purple-500"
              />
            </div>
          </div>

          {/* Reference Document & Image Attachment */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/50 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={docInputRef}
                type="file"
                onChange={handleAttachDoc}
                accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {attachedDocName
                    ? `ملف مرجعي: ${attachedDocName}`
                    : isRTL
                    ? 'إرفاق ملف للبحث منه (اختياري)'
                    : 'Attach Source File'}
                </span>
              </button>

              <input
                ref={imgInputRef}
                type="file"
                multiple
                onChange={handleAttachImages}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {isRTL
                    ? `إرفاق صور للبحث (${attachedImages.length})`
                    : `Attach Images (${attachedImages.length})`}
                </span>
              </button>
            </div>

            <a
              href={scholarSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isRTL ? 'بحث في Google Scholar' : 'Search Google Scholar'}</span>
            </a>
          </div>

          {/* Key Points Outline */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL
                ? 'المحاور والنقاط الرئيسية المطلوب تحليلها (نقطة في كل سطر)'
                : 'Research Outline / Key Points (one per line)'}
            </label>
            <textarea
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              rows={3}
              placeholder={
                isRTL
                  ? 'المفاهيم النظرية والقوانين الحاكمة\nالتطبيقات المختبرية والصناعية\nتحليل النتائج والتوصيات العملية'
                  : 'Theoretical framework\nIndustrial & lab applications\nFindings and recommendations'
              }
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-purple-500 ${
                isRTL ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {(loading || progressPct > 0) && (
            <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="purple" />
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white text-sm font-bold shadow-md shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {loading
                ? isRTL
                  ? 'جارٍ إعداد البحث المتكامل (KaTeX + جداول + رسوم SVG + مصادر)...'
                  : 'Building Scientific Research...'
                : isRTL
                ? 'إنشاء البحث العلمي المتكامل الآن'
                : 'Generate Full Research Paper'}
            </span>
          </button>

          {/* Rich Rendered Output Preview (KaTeX + Tables + SVG Diagrams + Numeric Charts) */}
          {report && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>
                    {isRTL
                      ? `البحث العلمي الكامل جاهز (${report.isScientific ? `${report.equations.length} معادلات KaTeX · ${report.tables.length} جداول · ${report.diagrams.length} رسوم توضيحية + رسم بياني` : 'جدول زمني · جدول مقارنة · اقتباسات موثقة'} · 8 مصادر)`
                      : 'Complete Research Paper Ready'}
                  </span>
                </span>

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
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingPdf ? '...' : isRTL ? 'تحميل PDF كامل' : 'Download Full PDF'}</span>
                  </button>

                  <button
                    onClick={handleDownloadWord}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تحميل Word كامل' : 'Download Full Word'}</span>
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                </div>
              </div>

              {/* Clean light-paper rendered preview so KaTeX, SVG charts and tables display with 100% contrast */}
              <div
                dir={report.outputIsRTL === false ? 'ltr' : 'rtl'}
                className="bg-white text-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 sm:p-7 max-h-[480px] overflow-y-auto shadow-inner"
                dangerouslySetInnerHTML={{ __html: report.htmlContent }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
