import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Sliders,
  AlertCircle,
  Download,
  RotateCw,
  FileDown,
  Languages,
  Copy,
  Check,
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  Files,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import jsPDF from 'jspdf';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateFileSize } from '../../utils/clientFileReader';
import { translateTextClientSide, buildTxtBlob, buildWordDocBlob } from '../../utils/clientTranslator';
import { renderTextToPdfBlob } from '../../utils/clientAiTools';
import { triggerFileDownload } from '../../utils/exactDocumentTranslator';
import { ToolProgressBar } from '../ToolProgressBar';
import { CommandAuditMeta } from '../../types';
import { uploadFileToCloudOrServer } from '../../utils/cloudStorage';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFile: (
    title: string,
    content: string,
    format: string,
    audit?: CommandAuditMeta,
    resultFile?: { blob: Blob; fileName: string; mimeType?: string; originalFile?: File | null }
  ) => void;
  checkAdOrVIP: () => Promise<boolean>;
}

interface PdfImageItem {
  id: string;
  name: string;
  dataUrl: string;
  sizeKb: number;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onSaveFile,
  checkAdOrVIP,
}) => {
  const { isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'edit' | 'translate' | 'pdf'>('edit');

  // Edit & single image state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFileObj, setImageFileObj] = useState<File | null>(null);
  const [imageName, setImageName] = useState('MetaNy_Image');
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  // Image Translation (OCR + Client Translator) state
  const [ocrLang, setOcrLang] = useState<'ara+eng' | 'eng' | 'ara' | 'fra' | 'deu' | 'tur'>('ara+eng');
  const [targetLang, setTargetLang] = useState('العربية');
  const [extractedImageText, setExtractedImageText] = useState('');
  const [translatedImageText, setTranslatedImageText] = useState('');
  const [copiedTrans, setCopiedTrans] = useState(false);

  // Images to PDF (1 - 50 images) state
  const [pdfImages, setPdfImages] = useState<PdfImageItem[]>([]);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const pdfMultiInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      validateFileSize(file, isRTL);
      setImageFileObj(file);
      setImageName(file.name.replace(/\.[^/.]+$/, '') || 'MetaNy_Image');
      void uploadFileToCloudOrServer(file, file.name, file.type, 'original');
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || '');
        setImageSrc(src);
        setExtractedImageText('');
        setTranslatedImageText('');
        const img = new Image();
        img.onload = () => setDimensions({ w: img.width, h: img.height });
        img.src = src;
      };
      reader.onerror = () => {
        setErrorMsg(isRTL ? 'فشل قراءة الصورة.' : 'Failed to read image file.');
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(
        err?.message || (isRTL ? 'خطأ في حجم الصورة (الحد الأقصى 20MB).' : 'Image validation failed (max 20MB).')
      );
    }
  };

  const handleExportEditedImage = async () => {
    setErrorMsg(null);
    if (!imageSrc) {
      setErrorMsg(isRTL ? 'يرجى رفع صورة أولاً.' : 'Please upload an image first.');
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(35);
    setProgressLabel(isRTL ? 'جاري تطبيق الفلاتر والتدوير عبر HTML5 Canvas...' : 'Applying adjustments...');

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error(isRTL ? 'فشل تحميل الصورة.' : 'Failed to load image.'));
        i.src = imageSrc;
      });

      const swapDims = rotation % 180 !== 0;
      const canvas = document.createElement('canvas');
      canvas.width = swapDims ? img.height : img.width;
      canvas.height = swapDims ? img.width : img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      if (exportFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      setProgressPct(85);
      const mime = `image/${exportFormat}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), mime, 0.93);
      });

      const outName = `${imageName}_edited.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`;
      triggerFileDownload(blob, outName);

      setProgressPct(100);
      setProgressLabel(isRTL ? `تم تعديل وتحميل ${outName} بنجاح!` : `Downloaded ${outName}!`);

      onSaveFile(
        isRTL ? `صورة معدلة: ${outName}` : `Edited Image: ${outName}`,
        `${outName} (${canvas.width}x${canvas.height})`,
        'image',
        {
          queryText: `تعديل وتصدير صورة (${outName})`,
          attachedFileName: imageFileObj?.name || outName,
          attachedFileSize: imageFileObj?.size,
          attachedFileType: imageFileObj?.type,
        },
        {
          blob,
          fileName: outName,
          mimeType: blob.type,
          originalFile: imageFileObj,
        }
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل تصدير الصورة المعدلة.' : 'Failed to export image.'));
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  // ── Image Translation via Client-Side Tesseract OCR + LibreTranslate/MyMemory ─────────────────
  const handleTranslateImage = async () => {
    setErrorMsg(null);
    if (!imageSrc) {
      setErrorMsg(isRTL ? 'يرجى رفع صورة تحتوي على نص لترجمتها.' : 'Please upload an image first.');
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(12);
    setProgressLabel(isRTL ? 'تهيئة محرك قراءة النصوص من الصور (Tesseract OCR)...' : 'Initializing OCR engine...');

    try {
      const worker = await createWorker(ocrLang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgressPct(20 + Math.round(m.progress * 45));
            setProgressLabel(
              isRTL
                ? `جاري استخراج النص من الصورة (${Math.round(m.progress * 100)}%)...`
                : `Extracting text from image (${Math.round(m.progress * 100)}%)...`
            );
          }
        },
      });

      const {
        data: { text: ocrText },
      } = await worker.recognize(imageSrc);
      await worker.terminate();

      const cleanedOcr = (ocrText || '').trim();
      setExtractedImageText(cleanedOcr);

      if (!cleanedOcr || cleanedOcr.length < 2) {
        throw new Error(
          isRTL
            ? 'لم يتم العثور على نص واضح قابل للقراءة داخل الصورة. جرب صورة أوضح أو غيّر لغة القراءة.'
            : 'No readable text detected in this image. Try a clearer image or adjust OCR language.'
        );
      }

      setProgressPct(70);
      setProgressLabel(isRTL ? `جاري ترجمة النص المستخرج إلى ${targetLang}...` : `Translating extracted text...`);

      const trRes = await translateTextClientSide(
        cleanedOcr,
        'auto',
        targetLang,
        (p) => {
          setProgressPct(70 + Math.round((p.percent / 100) * 28));
          setProgressLabel(p.status);
        }
      );

      setTranslatedImageText(trRes.translatedText);
      setProgressPct(100);
      setProgressLabel(isRTL ? 'تمت قراءة النص من الصورة وترجمته بنجاح!' : 'Image translated successfully!');

      onSaveFile(
        isRTL ? `ترجمة صورة: ${imageName}` : `Image Translation: ${imageName}`,
        trRes.translatedText,
        'translate',
        {
          queryText: `ترجمة نص صورة (${imageName}) إلى ${targetLang}`,
          targetLang,
          inputPreview: cleanedOcr.slice(0, 1200),
          outputPreview: trRes.translatedText.slice(0, 2200),
          attachedFileName: imageFileObj?.name || imageName,
          attachedFileSize: imageFileObj?.size,
          attachedFileType: imageFileObj?.type,
        },
        {
          blob: buildTxtBlob(trRes.translatedText),
          fileName: `${imageName}_translated.txt`,
          mimeType: 'text/plain;charset=utf-8',
          originalFile: imageFileObj,
        }
      );
    } catch (err: any) {
      setErrorMsg(
        err?.message || (isRTL ? 'تعذر ترجمة الصورة. تأكد من وضوح النص.' : 'Image translation failed.')
      );
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTranslatedImageCard = async () => {
    if (!imageSrc || !translatedImageText) return;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image load error'));
      i.src = imageSrc;
    });

    const padding = 28;
    const lines = translatedImageText.split('\n').flatMap((l) => {
      const words = l.split(/\s+/);
      const chunks: string[] = [];
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).length > 62) {
          chunks.push(cur);
          cur = w;
        } else {
          cur = cur ? `${cur} ${w}` : w;
        }
      }
      if (cur) chunks.push(cur);
      return chunks.length ? chunks : [''];
    });

    const footerHeight = Math.max(140, 70 + lines.slice(0, 14).length * 26);
    const canvas = document.createElement('canvas');
    const targetWidth = Math.max(760, Math.min(1200, img.width));
    const scaledImgHeight = Math.round((img.height / img.width) * targetWidth);

    canvas.width = targetWidth;
    canvas.height = scaledImgHeight + footerHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, targetWidth, scaledImgHeight);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, scaledImgHeight, targetWidth, footerHeight);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px "Cairo", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`الترجمة (${targetLang}):`, targetWidth - padding, scaledImgHeight + 34);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 16px "Cairo", Arial, sans-serif';
    lines.slice(0, 14).forEach((ln, idx) => {
      ctx.fillText(ln, targetWidth - padding, scaledImgHeight + 66 + idx * 24);
    });

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export error'))), 'image/png', 0.92)
    );
    triggerFileDownload(blob, `${imageName}_translated.png`);
  };

  // ── Multi-Image (1 to 50 images) to Single PDF Converter ──────────────────────────────────────
  const handleAddPdfImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    e.target.value = '';

    if (pdfImages.length + selected.length > 50) {
      setErrorMsg(
        isRTL
          ? `الحد الأقصى هو 50 صورة في الملف الواحد (لديك الآن ${pdfImages.length} صورة).`
          : `Maximum 50 images per PDF (currently ${pdfImages.length}).`
      );
      return;
    }

    const nextItems: PdfImageItem[] = [];
    for (const file of selected) {
      try {
        validateFileSize(file, isRTL);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error(`فشل قراءة ${file.name}`));
          r.readAsDataURL(file);
        });
        nextItems.push({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          dataUrl,
          sizeKb: Math.round(file.size / 1024),
        });
      } catch (err: any) {
        setErrorMsg(err?.message || `فشل فحص الصورة ${file.name}`);
        break;
      }
    }

    setPdfImages((prev) => [...prev, ...nextItems].slice(0, 50));
  };

  const movePdfImage = (index: number, dir: -1 | 1) => {
    setPdfImages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePdfImage = (id: string) => {
    setPdfImages((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBuildMultiImagePdf = async () => {
    setErrorMsg(null);
    if (pdfImages.length < 1 || pdfImages.length > 50) {
      setErrorMsg(
        isRTL
          ? 'يرجى اختيار من 1 إلى 50 صورة لدمجها في ملف PDF واحد.'
          : 'Please add between 1 and 50 images.'
      );
      return;
    }

    const allowed = await checkAdOrVIP();
    if (!allowed) return;

    setLoading(true);
    setProgressPct(5);
    setProgressLabel(
      isRTL
        ? `جاري دمج ${pdfImages.length} صورة داخل ملف PDF واحد...`
        : `Building PDF from ${pdfImages.length} images...`
    );

    try {
      const pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;

      for (let i = 0; i < pdfImages.length; i++) {
        const item = pdfImages[i];
        if (i > 0) pdf.addPage();

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error(`تعذر معالجة الصورة ${item.name}`));
          el.src = item.dataUrl;
        });

        // Normalize via Canvas to clean JPEG to support WEBP/PNG/transparent backgrounds seamlessly
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const cCtx = c.getContext('2d')!;
        cCtx.fillStyle = '#ffffff';
        cCtx.fillRect(0, 0, c.width, c.height);
        cCtx.drawImage(img, 0, 0);
        const jpegUrl = c.toDataURL('image/jpeg', 0.9);

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        pdf.addImage(jpegUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');

        const pct = 10 + Math.round(((i + 1) / pdfImages.length) * 85);
        setProgressPct(pct);
        setProgressLabel(
          isRTL
            ? `دمج صورة ${i + 1} من ${pdfImages.length}...`
            : `Adding image ${i + 1} of ${pdfImages.length}...`
        );
      }

      const blob = pdf.output('blob');
      const outName = `MetaNy_Images_${pdfImages.length}.pdf`;
      triggerFileDownload(blob, outName);

      setProgressPct(100);
      setProgressLabel(
        isRTL
          ? `تم دمج وتحميل ${pdfImages.length} صورة داخل ${outName} بنجاح!`
          : `Downloaded ${outName} (${pdfImages.length} pages)!`
      );

      onSaveFile(
        isRTL ? `دمج ${pdfImages.length} صور إلى PDF` : `Images to PDF (${pdfImages.length})`,
        `${outName} (${pdfImages.length} صفحة)`,
        'image',
        {
          queryText: `دمج ${pdfImages.length} صور إلى PDF (${outName})`,
          attachedFileName: pdfImages[0]?.name || outName,
        },
        {
          blob,
          fileName: outName,
          mimeType: 'application/pdf',
          originalFile: imageFileObj,
        }
      );
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'فشل إنشاء PDF من الصور.' : 'Failed to create PDF from images.'));
      setProgressPct(0);
    } finally {
      setLoading(false);
    }
  };

  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setRotation(0);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.serviceImage}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'تعديل الصور، ترجمة النصوص داخل الصور (OCR)، ودمج من 1 إلى 50 صورة في ملف PDF واحد'
                  : 'Edit Images, Translate Image Text (OCR), and Combine 1–50 Images into PDF'}
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

        {/* 3 Mode Tabs */}
        <div className="flex flex-wrap border-b border-slate-100 dark:border-slate-800 px-6 pt-3 bg-slate-50 dark:bg-slate-800/60 gap-1">
          <button
            onClick={() => {
              setActiveTab('edit');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تعديل الصورة' : 'Edit Image'}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('translate');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'translate'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{isRTL ? 'ترجمة الصور' : 'Translate Image'}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('pdf');
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pdf'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحويل الصور إلى PDF (1–50 صورة)' : 'Images to PDF (1–50)'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-[11px] font-bold text-amber-800 dark:text-amber-200 text-center space-y-0.5">
            <p>{isRTL ? 'سيتم رفع ملفك الى السيرفر ليتمكن الادمن من مراجعته' : 'Your file will be uploaded to the server so the admin can review it'}</p>
            <p className="text-emerald-700 dark:text-emerald-300">
              سيتم حذف ملفك تلقائيا بعد 7 ايام للحفاظ على خصوصيتك
            </p>
          </div>

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

          {/* Tab 1: Edit Image */}
          {activeTab === 'edit' && (
            <>
              {!imageSrc ? (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-emerald-200 dark:border-emerald-800/60 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors">
                  <Upload className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isRTL ? 'اضغط لرفع صورة من جهازك (حتى 20MB)' : 'Click to upload an image (max 20MB)'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP</span>
                  <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 flex flex-col items-center gap-2 w-full">
                      <div className="relative max-h-60 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center p-2">
                        <img
                          src={imageSrc}
                          alt="Preview"
                          style={{
                            filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`,
                            transform: `rotate(${rotation}deg)`,
                          }}
                          className="max-h-52 object-contain transition-transform"
                        />
                      </div>
                      {dimensions && (
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {imageName} ({dimensions.w} × {dimensions.h} px)
                        </span>
                      )}
                    </div>

                    <div className="w-full sm:w-64 space-y-3 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center justify-between text-slate-900 dark:text-slate-100">
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{isRTL ? 'أدوات التعديل:' : 'Adjustments:'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={resetAdjustments}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {isRTL ? 'إعادة ضبط' : 'Reset'}
                        </button>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>{isRTL ? 'السطوع' : 'Brightness'}</span>
                          <span>{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={200}
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>{isRTL ? 'التباين' : 'Contrast'}</span>
                          <span>{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={220}
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span>{isRTL ? 'أبيض وأسود' : 'Grayscale'}</span>
                          <span>{grayscale}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={grayscale}
                          onChange={(e) => setGrayscale(Number(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setRotation((r) => (r + 90) % 360)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{isRTL ? `تدوير 90° (${rotation}°)` : `Rotate 90° (${rotation}°)`}</span>
                        </button>

                        <label className="cursor-pointer py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-center">
                          <span>{isRTL ? 'تغيير' : 'Change'}</span>
                          <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                        </label>
                      </div>

                      <div>
                        <label className="block mb-1">{isRTL ? 'صيغة التصدير' : 'Output Format'}</label>
                        <select
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value as any)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                        >
                          <option value="png">PNG</option>
                          <option value="jpeg">JPG</option>
                          <option value="webp">WEBP</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {(loading || progressPct > 0) && (
                    <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="emerald" />
                  )}

                  <button
                    onClick={handleExportEditedImage}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>
                      {isRTL
                        ? `حفظ وتحميل الصورة (${exportFormat.toUpperCase()})`
                        : `Save & Download (${exportFormat.toUpperCase()})`}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Tab 2: Translate Images (OCR + Client Translation) */}
          {activeTab === 'translate' && (
            <div className="space-y-4">
              {!imageSrc ? (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-emerald-200 dark:border-emerald-800/60 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 cursor-pointer hover:bg-emerald-50/60 transition-colors">
                  <Upload className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isRTL ? 'ارفع الصورة المراد قراءة نصها وترجمتها (حتى 20MB)' : 'Upload an image to translate'}
                  </span>
                  <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    <div className="flex items-center gap-2 truncate max-w-[220px]">
                      <img src={imageSrc} alt="Thumb" className="w-10 h-10 rounded-lg object-cover border border-slate-300" />
                      <span className="truncate">{imageName}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={ocrLang}
                        onChange={(e) => setOcrLang(e.target.value as any)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                      >
                        <option value="ara+eng">{isRTL ? 'النص: عربي + إنجليزي' : 'OCR: Arabic + English'}</option>
                        <option value="eng">{isRTL ? 'النص: إنجليزي فقط' : 'OCR: English'}</option>
                        <option value="ara">{isRTL ? 'النص: عربي فقط' : 'OCR: Arabic'}</option>
                        <option value="fra">Français</option>
                        <option value="deu">Deutsch</option>
                        <option value="tur">Türkçe</option>
                      </select>

                      <span>←</span>

                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                      >
                        <option value="العربية">العربية</option>
                        <option value="English">English</option>
                        <option value="Français">Français</option>
                        <option value="Deutsch">Deutsch</option>
                        <option value="Español">Español</option>
                        <option value="Türkçe">Türkçe</option>
                      </select>

                      <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500">
                        <span>{isRTL ? 'تغيير الصورة' : 'Change'}</span>
                        <input type="file" onChange={handleImageUpload} accept="image/*" className="hidden" />
                      </label>
                    </div>
                  </div>

                  {(loading || progressPct > 0) && (
                    <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="emerald" />
                  )}

                  <button
                    type="button"
                    onClick={handleTranslateImage}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    <Languages className="w-4 h-4" />
                    <span>
                      {loading
                        ? isRTL
                          ? 'جارٍ قراءة النص من الصورة وترجمته...'
                          : 'Extracting & translating image text...'
                        : isRTL
                        ? 'قراءة وترجمة نص الصورة الآن'
                        : 'Extract & Translate Image Text'}
                    </span>
                  </button>

                  {(extractedImageText || translatedImageText) && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            {isRTL ? 'النص المستخرج من الصورة:' : 'Extracted Text:'}
                          </label>
                          <textarea
                            value={extractedImageText}
                            onChange={(e) => setExtractedImageText(e.target.value)}
                            rows={4}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                            {isRTL ? `الترجمة (${targetLang}):` : `Translation (${targetLang}):`}
                          </label>
                          <textarea
                            value={translatedImageText}
                            onChange={(e) => setTranslatedImageText(e.target.value)}
                            rows={4}
                            className="w-full bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(translatedImageText);
                            setCopiedTrans(true);
                            setTimeout(() => setCopiedTrans(false), 2000);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                        >
                          {copiedTrans ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedTrans ? t.copied : t.copy}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFileDownload(buildTxtBlob(translatedImageText), `${imageName}_translated.txt`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>TXT</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerFileDownload(
                              buildWordDocBlob({
                                title: `${imageName} (${targetLang})`,
                                content: translatedImageText,
                                targetLang,
                              }),
                              `${imageName}_translated.doc`
                            )
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Word</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const blob = await renderTextToPdfBlob(translatedImageText, `${imageName} - ${targetLang}`);
                            triggerFileDownload(blob, `${imageName}_translated.pdf`);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadTranslatedImageCard}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{isRTL ? 'تحميل صورة مترجمة PNG' : 'Download Translated Image'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Combine 1 to 50 Images into a Single PDF */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isRTL
                    ? `الصور المختارة: ${pdfImages.length} / 50 صورة (الحد الأقصى 50 صورة في الملف الواحد)`
                    : `Selected Images: ${pdfImages.length} / 50 max`}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={pdfOrientation}
                    onChange={(e) => setPdfOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="portrait">{isRTL ? 'عمودي (A4 Portrait)' : 'Portrait A4'}</option>
                    <option value="landscape">{isRTL ? 'أفقي (A4 Landscape)' : 'Landscape A4'}</option>
                  </select>

                  <input
                    ref={pdfMultiInputRef}
                    type="file"
                    multiple
                    onChange={handleAddPdfImages}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pdfMultiInputRef.current?.click()}
                    disabled={pdfImages.length >= 50}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'إضافة صور (1 إلى 50)' : 'Add Images (1–50)'}</span>
                  </button>
                </div>
              </div>

              {pdfImages.length === 0 ? (
                <div
                  onClick={() => pdfMultiInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-emerald-200 dark:border-emerald-800/60 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 cursor-pointer hover:bg-emerald-50/60 transition-colors"
                >
                  <Files className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isRTL ? 'اضغط لاختيار من 1 إلى 50 صورة لدمجها في PDF واحد' : 'Click to select 1–50 images'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {isRTL ? 'كل صورة حتى 20MB · يدعم ترتيب الصفحات' : 'Up to 20MB per image · Reorderable'}
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {pdfImages.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 w-6 text-center">
                          {idx + 1}
                        </span>
                        <img src={item.dataUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-slate-300 shrink-0" />
                        <div className="truncate">
                          <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.sizeKb} KB</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => movePdfImage(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                          title={isRTL ? 'تحريك لأعلى' : 'Move up'}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePdfImage(idx, 1)}
                          disabled={idx === pdfImages.length - 1}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                          title={isRTL ? 'تحريك لأسفل' : 'Move down'}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePdfImage(item.id)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800 cursor-pointer"
                          title={isRTL ? 'حذف' : 'Remove'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(loading || progressPct > 0) && (
                <ToolProgressBar progress={progressPct} label={progressLabel} active={loading} accent="emerald" />
              )}

              <button
                type="button"
                onClick={handleBuildMultiImagePdf}
                disabled={loading || pdfImages.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                <span>
                  {loading
                    ? isRTL
                      ? 'جارٍ تحويل الصور إلى ملف PDF واحد...'
                      : 'Generating PDF...'
                    : isRTL
                    ? `تحويل وتحميل (${pdfImages.length}) صورة في ملف PDF واحد`
                    : `Convert & Download (${pdfImages.length}) Images as PDF`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
