import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { readFileClientSide, renderPdfPagesToImages } from './clientFileReader';
import {
  buildTxtBlob,
  buildWordDocBlob,
  detectLanguageCode,
  isRtlLangCode,
  resolveLangCode,
  translateBatchClientSide,
  translateTextClientSide,
} from './clientTranslator';

export type ConvertTargetFormat = 'pdf' | 'word' | 'excel' | 'pptx' | 'txt' | 'png' | 'jpg' | 'webp';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render formatted text into an A4 PDF Blob using html2canvas + jsPDF (full Unicode & Arabic RTL support)
 */
export async function renderTextToPdfBlob(text: string, title: string): Promise<Blob> {
  const isRTL = /[\u0600-\u06FF]/.test(text.slice(0, 300) + title);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '40px 46px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', Arial, sans-serif";
  container.style.direction = isRTL ? 'rtl' : 'ltr';
  container.style.textAlign = isRTL ? 'right' : 'left';

  const lines = (text || '').split('\n').map((l) => {
    const t = l.trim();
    if (!t) return '<div style="height:8px;"></div>';
    if (t.startsWith('# ')) return `<h1 style="font-size:18px;font-weight:800;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:6px;margin:14px 0 8px;">${escapeHtml(t.slice(2))}</h1>`;
    if (t.startsWith('## ')) return `<h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:12px 0 6px;">${escapeHtml(t.slice(3))}</h2>`;
    if (t.startsWith('### ')) return `<h3 style="font-size:13px;font-weight:700;color:#334155;margin:10px 0 4px;">${escapeHtml(t.slice(4))}</h3>`;
    return `<p style="font-size:12px;line-height:1.85;margin:0 0 6px;color:#1e293b;">${escapeHtml(l)}</p>`;
  });

  container.innerHTML = `
    <div style="border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:18px;">
      <div style="font-size:17px;font-weight:800;color:#1e3a8a;">${escapeHtml(title)}</div>
    </div>
    <div>${lines.join('')}</div>
  `;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const printWidth = 190;
    const printHeight = 277;
    const imgHeight = (canvas.height * printWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;
    pdf.addImage(canvas, 'JPEG', 10, position, printWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printHeight;
    while (heightLeft > 0) {
      position -= printHeight;
      pdf.addPage();
      pdf.addImage(canvas, 'JPEG', 10, position, printWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printHeight;
    }
    return pdf.output('blob');
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

/**
 * Render formatted text into a PNG/JPG/WEBP Canvas Image Blob
 */
async function renderTextToImageBlob(
  text: string,
  title: string,
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
): Promise<Blob> {
  const isRTL = /[\u0600-\u06FF]/.test(text.slice(0, 300) + title);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '900px';
  container.style.padding = '42px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', Arial, sans-serif";
  container.style.direction = isRTL ? 'rtl' : 'ltr';
  container.style.textAlign = isRTL ? 'right' : 'left';
  container.innerHTML = `
    <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;font-size:20px;font-weight:800;color:#1e3a8a;">
      ${escapeHtml(title)}
    </div>
    <div style="font-size:14px;line-height:1.9;white-space:pre-wrap;color:#1e293b;">${escapeHtml(text.slice(0, 4500))}</div>
  `;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 1.5, backgroundColor: '#ffffff', windowWidth: 900 });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to generate image'))),
        mime,
        0.92
      );
    });
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

/**
 * Build a genuine PowerPoint (.pptx) OpenXML archive from text/slides via JSZip
 */
export async function buildPptxBlob(title: string, rawText: string): Promise<Blob> {
  const zip = new JSZip();

  // Split text into logical slides (every ~7 lines or by headings/markers)
  const rawSections = rawText
    .split(/(?:^|\n)(?=###?\s|---\s*صفحة|---\s*Page)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const slidesData: Array<{ heading: string; bullets: string[] }> = [];
  if (rawSections.length > 1) {
    for (const sec of rawSections.slice(0, 30)) {
      const lines = sec.split('\n').map((l) => l.trim()).filter(Boolean);
      slidesData.push({
        heading: lines[0].replace(/^#+\s*/, '').replace(/^---\s*|\s*---$/g, '').slice(0, 90),
        bullets: lines.slice(1, 9).map((b) => b.slice(0, 180)),
      });
    }
  } else {
    const allLines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < Math.max(1, allLines.length); i += 6) {
      const chunk = allLines.slice(i, i + 6);
      slidesData.push({
        heading: i === 0 ? title.slice(0, 80) : `${title.slice(0, 50)} (${Math.floor(i / 6) + 1})`,
        bullets: chunk.length > 0 ? chunk.map((c) => c.slice(0, 180)) : [title],
      });
      if (slidesData.length >= 25) break;
    }
  }

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slidesData
    .map(
      (_, idx) =>
        `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ')}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    ${slidesData
      .map((_, idx) => `<p:sldId id="${256 + idx}" r:id="rId${idx + 1}"/>`)
      .join('\n    ')}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slidesData
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`
    )
    .join('\n  ')}
</Relationships>`
  );

  slidesData.forEach((slide, idx) => {
    const paragraphsXml = slide.bullets
      .map(
        (bullet) => `
      <a:p>
        <a:r><a:rPr lang="ar-SA" sz="1800"/><a:t>${escapeXml(bullet)}</a:t></a:r>
      </a:p>`
      )
      .join('');

    zip.file(
      `ppt/slides/slide${idx + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ar-SA" sz="2800" b="1"/><a:t>${escapeXml(slide.heading)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1350000"/><a:ext cx="8229600" cy="4800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

/**
 * 100% Client-Side File Converter (PDF <-> Word <-> Excel <-> PPTX <-> TXT <-> Images)
 */
export async function convertFileClientSide(options: {
  file?: File | null;
  textFallback?: string;
  originalFileName?: string;
  targetFormat: ConvertTargetFormat;
  onProgress?: (percent: number, status: string) => void;
  isRTL?: boolean;
}): Promise<{ blob: Blob; fileName: string; previewText: string; previewImageUrl?: string }> {
  const { file, textFallback = '', originalFileName = 'MetaNy_Document', targetFormat, onProgress, isRTL = true } = options;

  const baseName = ((file?.name || originalFileName).replace(/\.[^/.]+$/, '') || 'MetaNy_Document').replace(/[\\/:*?"<>|]/g, '_');

  onProgress?.(10, isRTL ? 'جاري قراءة المصدر...' : 'Reading source...');

  let extractedText = textFallback.trim();
  let sheets: Array<{ name: string; rows: string[][] }> | undefined;
  let sourceIsImage = false;
  let sourceImageDataUrl: string | undefined;
  let sourceIsPdf = false;
  let pdfBuffer: ArrayBuffer | undefined;

  if (file) {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const mime = (file.type || '').toLowerCase();
    if (ext === 'pdf' || mime === 'application/pdf') {
      sourceIsPdf = true;
      pdfBuffer = await file.arrayBuffer();
    }
    const readRes = await readFileClientSide(
      file,
      (p, msg) => onProgress?.(Math.round(p * 0.45), msg),
      isRTL
    );
    extractedText = readRes.extractedText || extractedText;
    sheets = readRes.sheets;
    if (readRes.fileType === 'image' && readRes.imageDataUrl) {
      sourceIsImage = true;
      sourceImageDataUrl = readRes.imageDataUrl;
    }
  }

  if (!extractedText && !sourceIsImage && !sourceIsPdf) {
    throw new Error(isRTL ? 'يرجى رفع ملف أو إدخال نص لتحويله.' : 'Please upload a file or enter text to convert.');
  }

  onProgress?.(60, isRTL ? `جاري التحويل إلى ${targetFormat.toUpperCase()}...` : `Converting to ${targetFormat.toUpperCase()}...`);

  // Image -> Image or Image -> PDF
  if (sourceIsImage && sourceImageDataUrl) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to load image'));
      i.src = sourceImageDataUrl!;
    });

    if (targetFormat === 'pdf') {
      const orientation = img.width > img.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
      pdf.addImage(sourceImageDataUrl, 'JPEG', 0, 0, img.width, img.height);
      onProgress?.(100, isRTL ? 'تم إنشاء PDF من الصورة!' : 'PDF created from image!');
      return {
        blob: pdf.output('blob'),
        fileName: `${baseName}.pdf`,
        previewText: isRTL ? `تم تحويل الصورة (${img.width}×${img.height}) إلى مستند PDF.` : `Converted image (${img.width}x${img.height}) to PDF.`,
        previewImageUrl: sourceImageDataUrl,
      };
    }

    if (targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'webp') {
      const mime =
        targetFormat === 'jpg'
          ? 'image/jpeg'
          : targetFormat === 'webp'
          ? 'image/webp'
          : 'image/png';
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      if (targetFormat === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const outUrl = canvas.toDataURL(mime, 0.92);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export error'))), mime, 0.92)
      );
      onProgress?.(100, isRTL ? 'تم تحويل صيغة الصورة بنجاح!' : 'Image format converted!');
      return {
        blob,
        fileName: `${baseName}.${targetFormat}`,
        previewText: isRTL ? `تم تحويل الصورة إلى ${targetFormat.toUpperCase()} (${img.width}×${img.height}).` : `Converted to ${targetFormat.toUpperCase()} (${img.width}x${img.height}).`,
        previewImageUrl: outUrl,
      };
    }
  }

  // PDF -> Images (PNG / JPG / WEBP) using real PDF.js Canvas render
  if (sourceIsPdf && pdfBuffer && (targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'webp')) {
    const imgMime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const rendered = await renderPdfPagesToImages(
      pdfBuffer,
      imgMime,
      20,
      (p, msg) => onProgress?.(50 + Math.round(p * 0.45), msg),
      isRTL
    );
    if (rendered.length === 1) {
      onProgress?.(100, isRTL ? 'تم تحويل صفحة PDF إلى صورة!' : 'PDF page converted to image!');
      return {
        blob: rendered[0].blob,
        fileName: `${baseName}_page1.${targetFormat}`,
        previewText: isRTL ? 'تم استخراج الصفحة 1 كصورة عالية الدقة.' : 'Page 1 exported as high-res image.',
        previewImageUrl: rendered[0].dataUrl,
      };
    } else {
      const zip = new JSZip();
      rendered.forEach((p) => {
        zip.file(`${baseName}_page_${p.pageNumber}.${targetFormat}`, p.blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      onProgress?.(100, isRTL ? `تم تحويل ${rendered.length} صفحة إلى صور (ZIP)!` : `Converted ${rendered.length} pages to images (ZIP)!`);
      return {
        blob: zipBlob,
        fileName: `${baseName}_pages_${targetFormat}.zip`,
        previewText: isRTL ? `تم تحويل ${rendered.length} صفحة PDF إلى صور عالية الجودة داخل أرشيف ZIP.` : `Converted ${rendered.length} PDF pages into images inside a ZIP bundle.`,
        previewImageUrl: rendered[0]?.dataUrl,
      };
    }
  }

  switch (targetFormat) {
    case 'txt': {
      const blob = buildTxtBlob(extractedText);
      onProgress?.(100, isRTL ? 'تم التحويل إلى TXT بنجاح!' : 'Converted to TXT!');
      return { blob, fileName: `${baseName}.txt`, previewText: extractedText };
    }
    case 'word': {
      const blob = buildWordDocBlob({ title: baseName, content: extractedText });
      onProgress?.(100, isRTL ? 'تم التحويل إلى Word (.doc) بنجاح!' : 'Converted to Word (.doc)!');
      return { blob, fileName: `${baseName}.doc`, previewText: extractedText };
    }
    case 'excel': {
      const wb = XLSX.utils.book_new();
      if (sheets && sheets.length > 0) {
        sheets.forEach((s) => {
          const ws = XLSX.utils.aoa_to_sheet(s.rows);
          XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || 'Sheet1');
        });
      } else {
        const lines = extractedText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const rows = lines.map((line, i) => {
          if (line.startsWith('|') && line.endsWith('|')) {
            return line
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());
          }
          if (line.includes('\t')) return line.split('\t');
          return [String(i + 1), line];
        });
        const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['#', 'Content'], ['1', extractedText]]);
        XLSX.utils.book_append_sheet(wb, ws, 'ConvertedData');
      }
      const xlsxArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([xlsxArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      onProgress?.(100, isRTL ? 'تم إنشاء ملف Excel (.xlsx) حقيقي!' : 'Real Excel (.xlsx) generated!');
      return { blob, fileName: `${baseName}.xlsx`, previewText: extractedText };
    }
    case 'pptx': {
      const blob = await buildPptxBlob(baseName, extractedText);
      onProgress?.(100, isRTL ? 'تم إنشاء عرض PowerPoint (.pptx)!' : 'PowerPoint (.pptx) generated!');
      return { blob, fileName: `${baseName}.pptx`, previewText: extractedText };
    }
    case 'pdf': {
      const blob = await renderTextToPdfBlob(extractedText, baseName);
      onProgress?.(100, isRTL ? 'تم إنشاء ملف PDF حقيقي!' : 'Real PDF generated!');
      return { blob, fileName: `${baseName}.pdf`, previewText: extractedText };
    }
    case 'png':
    case 'jpg':
    case 'webp': {
      const mime = targetFormat === 'jpg' ? 'image/jpeg' : targetFormat === 'webp' ? 'image/webp' : 'image/png';
      const blob = await renderTextToImageBlob(extractedText, baseName, mime);
      onProgress?.(100, isRTL ? `تم التحويل إلى صورة ${targetFormat.toUpperCase()}!` : `Converted to ${targetFormat.toUpperCase()}!`);
      return { blob, fileName: `${baseName}.${targetFormat}`, previewText: extractedText };
    }
  }
}

export interface ExtractedFactQuestion {
  number: number;
  category: 'definition' | 'cause' | 'number' | 'result' | 'example';
  categoryLabel: string;
  question: string;
  answer: string;
  questionAr?: string;
  questionEn?: string;
  answerAr?: string;
  answerEn?: string;
  originalSentence: string;
  paragraphNumber: number;
}

export interface ExtractedQuestionsBundle {
  questions: ExtractedFactQuestion[];
  totalParagraphs: number;
  totalPagesDetected: number;
  pagesUsedLabel: string;
  formattedText: string;
  outputLangCode?: string;
  outputIsRTL?: boolean;
  isBilingualArEn?: boolean;
}

/**
 * Slice multi-page extracted document text if page markers exist
 */
export function sliceTextByPageRange(
  rawText: string,
  pageRangeMode: 'all' | 'custom',
  fromPage: number = 1,
  toPage: number = 5
): { slicedText: string; totalPages: number; pagesUsedLabel: string } {
  const pageRegex = /---\s*(?:صفحة|Page)\s+(\d+)(?:\s*\/\s*Page\s+\d+)?\s*---/gi;
  const matches = Array.from(rawText.matchAll(pageRegex));
  if (matches.length === 0) {
    return { slicedText: rawText, totalPages: 1, pagesUsedLabel: 'النص كامل' };
  }

  const pages: Array<{ pageNum: number; content: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : rawText.length;
    const pageNum = parseInt(matches[i][1], 10) || i + 1;
    pages.push({ pageNum, content: rawText.slice(startIdx, endIdx).trim() });
  }

  const totalPages = pages.length;
  if (pageRangeMode === 'all') {
    return {
      slicedText: pages.map((p) => p.content).join('\n\n'),
      totalPages,
      pagesUsedLabel: `الملف كامل (${totalPages} صفحة)`,
    };
  }

  const minP = Math.max(1, Math.min(fromPage, toPage));
  const maxP = Math.min(totalPages, Math.max(fromPage, toPage));
  const filtered = pages.filter((p) => p.pageNum >= minP && p.pageNum <= maxP);
  return {
    slicedText: filtered.map((p) => p.content).join('\n\n'),
    totalPages,
    pagesUsedLabel: `الصفحات ${minP} إلى ${maxP} من أصل ${totalPages}`,
  };
}

/**
 * Strict Zero-Hallucination Fact Extractor:
 * Reads full text -> splits into numbered paragraphs & sentences ->
 * extracts ONLY real definitions, causes, numbers/dates, results, examples/problems.
 * Prohibits invented book/author/publication meta-questions.
 */
export function extractStrictDocumentQuestions(options: {
  sourceText: string;
  topic?: string;
  type?: 'multiple_choice' | 'true_false' | 'essay' | 'ministerial';
  count?: number;
  pageRangeMode?: 'all' | 'custom';
  fromPage?: number;
  toPage?: number;
  isRTL?: boolean;
}): ExtractedQuestionsBundle {
  const {
    sourceText,
    type = 'essay',
    count = 20,
    pageRangeMode = 'all',
    fromPage = 1,
    toPage = 5,
    isRTL = true,
  } = options;

  const trimmedInput = (sourceText || '').trim();
  if (!trimmedInput || trimmedInput.length < 100) {
    throw new Error('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
  }

  const { slicedText, totalPages, pagesUsedLabel } = sliceTextByPageRange(
    trimmedInput,
    pageRangeMode,
    fromPage,
    toPage
  );

  // Split into numbered paragraphs
  const rawParagraphs = slicedText
    .replace(/\r\n/g, '\n')
    .split(/\n{1,}/)
    .map((p) => p.replace(/^---\s*(?:صفحة|Page).*?---\s*$/i, '').trim())
    .filter((p) => p.length >= 20);

  if (rawParagraphs.length === 0) {
    throw new Error('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
  }

  interface SentenceUnit {
    sentence: string;
    paragraphNumber: number;
  }

  const sentenceUnits: SentenceUnit[] = [];
  const seenSent = new Set<string>();

  rawParagraphs.forEach((para, pIdx) => {
    const pNum = pIdx + 1;
    // Split paragraph into real factual sentences (supports Arabic, Latin & CJK punctuation without spaces)
    const parts = para
      .split(/(?<=[.!?؟])\s+|(?<=[。！？])\s*|\n+/)
      .map((s) => s.replace(/^[-•*\d.)]+\s*/, '').trim())
      .filter((s) => s.length >= 14);

    for (const s of parts) {
      const key = s.toLowerCase().slice(0, 80);
      if (!seenSent.has(key)) {
        seenSent.add(key);
        sentenceUnits.push({ sentence: s, paragraphNumber: pNum });
      }
    }

    // If paragraph is a dense comma/semicolon list with facts, split into informative sub-clauses too
    if (parts.length <= 1 && para.length > 90) {
      const clauses = para
        .split(/[؛;،,、；]+/)
        .map((c) => c.trim())
        .filter((c) => c.length >= 18);
      for (const c of clauses) {
        const key = c.toLowerCase().slice(0, 80);
        if (!seenSent.has(key)) {
          seenSent.add(key);
          sentenceUnits.push({ sentence: c, paragraphNumber: pNum });
        }
      }
    }
  });

  if (sentenceUnits.length < 4) {
    throw new Error('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
  }

  const extracted: ExtractedFactQuestion[] = [];
  const usedQuestions = new Set<string>();

  const pushUnique = (item: Omit<ExtractedFactQuestion, 'number'>) => {
    const qKey = item.question.toLowerCase().slice(0, 80);
    if (usedQuestions.has(qKey)) return;
    usedQuestions.add(qKey);
    extracted.push({ ...item, number: extracted.length + 1 });
  };

  const targetMax = Math.min(30, Math.max(20, count));

  // Pass 1: Strict factual pattern matching (Definitions, Causes, Numbers/Dates, Results, Examples/Problems)
  for (const unit of sentenceUnits) {
    if (extracted.length >= targetMax) break;
    const s = unit.sentence;
    const pNum = unit.paragraphNumber;

    // 1. Definition match
    const defMatch = s.match(
      /^([^،.;:]{3,55}?)\s+(هو|هي|يُعرف بـ|يعرف بـ|يُعرف بأنه|تعرف بأنها|يعني|تعني|يُقصد به|تعد|يعد|تعتبر|يعتبر|is defined as|refers to|means|is a|is the|are|est|sont|signifie|ist|sind|bedeutet|è|sono|es|son|significa)\s+(.{8,})$/i
    );
    if (defMatch) {
      const term = defMatch[1].replace(/^(إن|أن|و|فـ|الـ\s+)/, '').trim();
      if (term.length >= 2 && !/(الكتاب|المؤلف|العنوان|author|book|title)/i.test(term)) {
        pushUnique({
          category: 'definition',
          categoryLabel: isRTL ? 'تعريف' : 'Definition',
          question: isRTL ? `ما هو تعريف ${term}؟` : `What is the definition of "${term}"?`,
          answer: `${term} ${defMatch[2]} ${defMatch[3]}`,
          originalSentence: s,
          paragraphNumber: pNum,
        });
        continue;
      }
    }

    // 2. Cause / Reason match
    const causeMatch = s.match(
      /^(.{8,95}?)\s+(لأن|بسبب|نظراً لـ|نظرا لـ|نتيجة لـ|يرجع ذلك إلى|يعود إلى|because|due to|since|parce que|car|weil|denn|perché|porque|потому что)\s+(.{6,})$/i
    );
    if (causeMatch) {
      const eventPart = causeMatch[1].trim().slice(0, 85);
      pushUnique({
        category: 'cause',
        categoryLabel: isRTL ? 'سبب وتعليل' : 'Cause / Why',
        question: isRTL ? `لماذا حدث: "${eventPart}"؟` : `Why did "${eventPart}" occur?`,
        answer: `${causeMatch[2]} ${causeMatch[3]}`,
        originalSentence: s,
        paragraphNumber: pNum,
      });
      continue;
    }

    // 3. Result / Outcome match
    const resultMatch = s.match(
      /^(.{8,95}?)\s+(مما يؤدي إلى|يؤدي إلى|تؤدي إلى|ينتج عنه|نتج عن|يترتب عليه|يسبب|تسبب|leads to|results in|produces|causes|mène à|führt zu|porta a|provoca)\s+(.{6,})$/i
    );
    if (resultMatch) {
      const trigger = resultMatch[1].trim().slice(0, 85);
      pushUnique({
        category: 'result',
        categoryLabel: isRTL ? 'نتيجة وأثر' : 'Result / Outcome',
        question: isRTL ? `ما هي نتيجة "${trigger}"؟` : `What is the result of "${trigger}"?`,
        answer: `${resultMatch[2]} ${resultMatch[3]}`,
        originalSentence: s,
        paragraphNumber: pNum,
      });
      continue;
    }

    // 4. Examples & Problems match
    const exampleMatch = s.match(
      /(مثال|مثلاً|مسألة|احسب|تطبيق عملي|نموذج|على سبيل المثال|for example|e\.g\.|problem|calculate|equation|exemple|beispiel|esempio|ejemplo|пример|例如|例え|=)/i
    );
    if (exampleMatch) {
      const words = s.includes(' ') ? s.split(/\s+/).slice(0, 7).join(' ') : s.slice(0, 18);
      pushUnique({
        category: 'example',
        categoryLabel: isRTL ? 'مثال / مسألة' : 'Example / Problem',
        question: isRTL
          ? `ما المثال أو المسألة المذكورة في النص حول "${words}..."؟`
          : `What example or problem is stated regarding "${words}..."?`,
        answer: s,
        originalSentence: s,
        paragraphNumber: pNum,
      });
      continue;
    }

    // 5. Numbers / Dates / Percentages match
    const numMatch = s.match(/(\d+(?:[.,]\d+)?\s*(?:%|بالمئة|عام|سنة|متر|كيلو|درجة|مليون|ألف|ثانية|صفحة|جول|فولت|أمبير|mol|kg|m\/s|°C|年|月)?)/i);
    if (numMatch && numMatch[1].trim()) {
      const numToken = numMatch[1].trim();
      const contextSnippet = s.replace(numToken, '____').slice(0, 95);
      pushUnique({
        category: 'number',
        categoryLabel: isRTL ? 'رقم / تاريخ' : 'Number / Date',
        question: isRTL
          ? `كم عدد / ما القيمة أو التاريخ المذكور في العبارة: "${contextSnippet}"؟`
          : `What exact number/date fits: "${contextSnippet}"?`,
        answer: `${numToken} — ${s}`,
        originalSentence: s,
        paragraphNumber: pNum,
      });
    }
  }

  // Pass 2: Extract additional verifiable factual definitions / numbers / outcomes from remaining informative sentences
  for (const unit of sentenceUnits) {
    if (extracted.length >= targetMax) break;
    const s = unit.sentence;
    const pNum = unit.paragraphNumber;

    if (extracted.some((item) => item.originalSentence === s)) continue;

    const words = s.split(/\s+/).filter(Boolean);
    const isCJKOrNoSpace = !s.includes(' ') || words.length <= 2;
    if (!isCJKOrNoSpace && words.length < 5) continue;
    if (isCJKOrNoSpace && s.length < 16) continue;

    const subjectAnchor = isCJKOrNoSpace
      ? s.slice(0, Math.min(14, Math.floor(s.length / 2)))
      : words.slice(0, Math.min(4, Math.floor(words.length / 2))).join(' ');
    const predicateAnswer = isCJKOrNoSpace
      ? s.slice(Math.min(14, Math.floor(s.length / 2)))
      : words.slice(Math.min(4, Math.floor(words.length / 2))).join(' ');
    if (predicateAnswer.length < 8) continue;

    if (/\d/.test(s)) {
      pushUnique({
        category: 'number',
        categoryLabel: isRTL ? 'رقم / حقيقة كمية' : 'Quantitative Fact',
        question: isRTL
          ? `كم عدد أو ما المعطى الرقمي الوارد بشأن "${subjectAnchor}"؟`
          : `What numeric value is stated regarding "${subjectAnchor}"?`,
        answer: s,
        originalSentence: s,
        paragraphNumber: pNum,
      });
    } else if (/(يؤثر|يزيد|يقلل|يساعد|يساهم|يحقق|يميز|يعتمد|تتطلب|يتكون)/i.test(s)) {
      pushUnique({
        category: 'result',
        categoryLabel: isRTL ? 'نتيجة / آلية' : 'Result / Mechanism',
        question: isRTL
          ? `ما هي نتيجة أو دور "${subjectAnchor}" وفقاً للنص؟`
          : `What is the outcome or role of "${subjectAnchor}" in the text?`,
        answer: s,
        originalSentence: s,
        paragraphNumber: pNum,
      });
    } else {
      pushUnique({
        category: 'definition',
        categoryLabel: isRTL ? 'توصيف / مفهوم' : 'Concept / Fact',
        question: isRTL
          ? `ما هو تعريف أو مضمون "${subjectAnchor}" كما ورد في الفقرة (${pNum})؟`
          : `What does the text state about "${subjectAnchor}" in paragraph ${pNum}?`,
        answer: s,
        originalSentence: s,
        paragraphNumber: pNum,
      });
    }
  }

  // Enforce strict minimum quality threshold — do not pad with fake filler
  if (extracted.length < 4) {
    throw new Error('النص لا يحتوي على معلومات كافية لتوليد اسئلة حقيقية، ارفع ملف اطول');
  }

  // Format cleanly for Copy / TXT / Word / PDF exports
  const header = isRTL
    ? `# بنك الأسئلة والأجوبة المستخرج حرفياً من النص (${extracted.length} سؤالاً)\n**النطاق المستخدم:** ${pagesUsedLabel} | **نوع العرض:** ${type} | **عدد الفقرات المحللة:** ${rawParagraphs.length}\n`
    : `# Fact-Verified Q&A Extracted from Document (${extracted.length} Questions)\n**Scope:** ${pagesUsedLabel} | **Paragraphs Analyzed:** ${rawParagraphs.length}\n`;

  const bodyLines = extracted.map((q) => {
    if (type === 'true_false') {
      return isRTL
        ? [
            `**سؤال ${q.number} [${q.categoryLabel}] (صح أم خطأ):** ${q.originalSentence}`,
            `**الجواب:** ✔️ صحيح (موثق حرفياً في النص)`,
            `**الجملة الأصلية من النص:** "${q.originalSentence}"`,
            `**رقم الفقرة:** الفقرة ${q.paragraphNumber}\n`,
          ].join('\n')
        : [
            `**Q${q.number} [${q.categoryLabel}] (True / False):** ${q.originalSentence}`,
            `**Answer:** ✔️ True (verified verbatim in source text)`,
            `**Original Sentence:** "${q.originalSentence}"`,
            `**Paragraph:** ${q.paragraphNumber}\n`,
          ].join('\n');
    }
    return isRTL
      ? [
          `**سؤال ${q.number} [${q.categoryLabel}]:** ${q.question}`,
          `**الجواب:** ${q.answer}`,
          `**الجملة الأصلية من النص:** "${q.originalSentence}"`,
          `**رقم الفقرة:** الفقرة ${q.paragraphNumber}\n`,
        ].join('\n')
      : [
          `**Q${q.number} [${q.categoryLabel}]:** ${q.question}`,
          `**Answer:** ${q.answer}`,
          `**Original Sentence:** "${q.originalSentence}"`,
          `**Paragraph:** ${q.paragraphNumber}\n`,
        ].join('\n');
  });

  const formattedText = [header, ...bodyLines].join('\n');

  return {
    questions: extracted,
    totalParagraphs: rawParagraphs.length,
    totalPagesDetected: totalPages,
    pagesUsedLabel,
    formattedText,
    outputLangCode: isRTL ? 'ar' : 'en',
    outputIsRTL: isRTL,
  };
}

const EN_UNIT_TO_AR: Array<[RegExp, string]> = [
  [/\bGHz\b/gi, 'غيغاهرتز'],
  [/\bMHz\b/gi, 'ميغاهرتز'],
  [/\bkHz\b/gi, 'كيلوهرتز'],
  [/\bHz\b/gi, 'هرتز'],
  [/\bms\b/g, 'ملي ثانية'],
  [/\bmV\b/gi, 'ملي فولت'],
  [/\bkV\b/gi, 'كيلوفولت'],
  [/\bmA\b/gi, 'ملي أمبير'],
  [/\bkg\b/gi, 'كيلوغرام'],
  [/\bkm\b/gi, 'كيلومتر'],
  [/\bcm\b/gi, 'سنتيمتر'],
  [/\bmm\b/gi, 'مليمتر'],
  [/\bdB\b/gi, 'ديسيبل'],
  [/\bmol\b/gi, 'مول'],
  [/\bPa\b/g, 'باسكال'],
  [/\bkW\b/gi, 'كيلوواط'],
  [/\bMW\b/gi, 'ميغاواط'],
];

/**
 * Ensures the English section has zero Arabic characters or mixed inline Arabic explanations.
 */
export function sanitizeEnglishSection(text: string): string {
  const cleaned = (text || '')
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([?.!,;:])/g, '$1')
    .trim();
  const enLetters = (cleaned.match(/[A-Za-z]/g) || []).length;
  return enLetters >= 3 ? cleaned : '';
}

/**
 * Produces 100% pure Arabic text:
 * - Zero English words or letters
 * - Zero parentheses (prevents RTL bidi text reversal)
 * - Always starts with an Arabic letter and ends cleanly with an Arabic letter (or ؟ for questions)
 * - Returns '' if no valid Arabic translation exists (never falls back to English!)
 */
export function sanitizePureArabicSection(arText: string, isQuestion: boolean = false): string {
  let clean = (arText || '').trim();
  if (!clean) return '';

  // Reject any translation API error strings
  if (/MYMEMORY WARNING|PLEASE SELECT TWO DISTINCT|QUERY LENGTH LIMIT/i.test(clean)) {
    return '';
  }

  // CRITICAL: Check BEFORE unit replacement that the raw string actually contains real Arabic translation
  const rawArLetters = (clean.match(/[\u0621-\u063A\u0641-\u064A]/g) || []).length;
  const rawEnLetters = (clean.match(/[A-Za-z]/g) || []).length;
  if (rawArLetters < 6 || rawEnLetters > rawArLetters) {
    return '';
  }

  // Convert common Latin technical units to Arabic words before stripping remaining Latin characters
  for (const [pattern, arUnit] of EN_UNIT_TO_AR) {
    clean = clean.replace(pattern, ` ${arUnit} `);
  }

  // Strip parenthetical English fragments completely, then strip remaining ASCII/curly parentheses
  clean = clean
    .replace(/\([^)]*[A-Za-z][^)]*\)/g, ' ')
    .replace(/[A-Za-z]+/g, ' ')
    .replace(/[()[\]{}«»"'`]+/g, ' ')
    .replace(/\s*[-–—]+\s*/g, ' ')
    .replace(/\s*[,;:]\s*/g, '، ')
    .replace(/(،\s*){2,}/g, '، ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([؟،.!:])/g, '$1')
    .trim();

  // Enforce: begins with an Arabic letter
  clean = clean.replace(/^[^\u0621-\u063A\u0641-\u064A]+/, '').trim();

  // Enforce: ends with an Arabic letter (answers) or Arabic letter / Arabic question mark (questions)
  if (isQuestion) {
    clean = clean.replace(/[^\u0621-\u063A\u0641-\u064A\u061F]+$/, '').trim();
    if (clean && !clean.endsWith('؟')) {
      clean = `${clean}؟`;
    }
  } else {
    clean = clean.replace(/[^\u0621-\u063A\u0641-\u064A]+$/, '').trim();
  }

  // Verify substantial Arabic content and zero English letters
  const arLetterCount = (clean.match(/[\u0621-\u063A\u0641-\u064A]/g) || []).length;
  if (arLetterCount < 4 || /[A-Za-z]/.test(clean)) {
    return '';
  }

  return clean;
}

/**
 * Multilingual World-Language Fact-Verified Q&A Extractor:
 * Supports Bilingual Arabic-then-English ('bilingual_ar_en' — default), original language ('original'),
 * OR generating/translating Q&As into ANY world language (or ISO code).
 */
export async function extractMultilingualDocumentQuestions(options: {
  sourceText: string;
  topic?: string;
  type?: 'multiple_choice' | 'true_false' | 'essay' | 'ministerial';
  count?: number;
  pageRangeMode?: 'all' | 'custom';
  fromPage?: number;
  toPage?: number;
  outputLanguage?: string; // 'bilingual_ar_en' | 'original' | any language name / ISO code
  onProgress?: (percent: number, label: string) => void;
}): Promise<ExtractedQuestionsBundle> {
  const {
    sourceText,
    topic,
    type = 'essay',
    count = 20,
    pageRangeMode = 'all',
    fromPage = 1,
    toPage = 5,
    outputLanguage = 'bilingual_ar_en',
    onProgress,
  } = options;

  const detectedSourceCode = detectLanguageCode(sourceText);

  // === BILINGUAL MODE (Arabic first, then English) ===
  if (outputLanguage === 'bilingual_ar_en') {
    const sourceIsArabic = detectedSourceCode === 'ar';

    onProgress?.(20, 'جاري استخراج الحقائق وبناء الأسئلة باللغتين (عربي ثم إنكليزي)...');
    const baseBundle = extractStrictDocumentQuestions({
      sourceText,
      topic,
      type,
      count,
      pageRangeMode,
      fromPage,
      toPage,
      isRTL: sourceIsArabic,
    });

    const qList = baseBundle.questions;
    const rawQuestions = qList.map((q) =>
      type === 'true_false'
        ? sourceIsArabic
          ? `صح أم خطأ: ${q.originalSentence}`
          : `True or False: ${q.originalSentence}`
        : q.question
    );
    const rawAnswers = qList.map((q) =>
      type === 'true_false'
        ? sourceIsArabic
          ? 'صحيح وموثق في النص'
          : 'True (verified in the text).'
        : q.answer
    );

    let arQuestions: string[] = [];
    let arAnswers: string[] = [];
    let enQuestions: string[] = [];
    let enAnswers: string[] = [];

    if (sourceIsArabic) {
      arQuestions = rawQuestions;
      arAnswers = rawAnswers;
      onProgress?.(45, 'جاري ترجمة الأسئلة والأجوبة إلى الإنكليزية بدقة...');
      const enBatch = await translateBatchClientSide(
        [...rawQuestions, ...rawAnswers],
        'en',
        (done, total) => {
          const pct = Math.min(92, 45 + Math.round((done / Math.max(1, total)) * 45));
          onProgress?.(pct, `تجهيز النسخة الإنكليزية (${done}/${total})...`);
        }
      );
      enQuestions = enBatch.slice(0, qList.length);
      enAnswers = enBatch.slice(qList.length);
    } else {
      if (detectedSourceCode === 'en') {
        enQuestions = rawQuestions;
        enAnswers = rawAnswers;
      } else {
        onProgress?.(35, 'جاري تجهيز الصياغة الإنكليزية الدقيقة...');
        const enBatch = await translateBatchClientSide(
          [...rawQuestions, ...rawAnswers],
          'en',
          (done, total) => {
            const pct = Math.min(60, 35 + Math.round((done / Math.max(1, total)) * 25));
            onProgress?.(pct, `صياغة الإنكليزية (${done}/${total})...`);
          }
        );
        enQuestions = enBatch.slice(0, qList.length);
        enAnswers = enBatch.slice(qList.length);
      }

      onProgress?.(62, 'جاري توليد ترجمة عربية صافية للأسئلة والأجوبة...');
      const arBatch = await translateBatchClientSide(
        [...enQuestions, ...enAnswers],
        'ar',
        (done, total) => {
          const pct = Math.min(92, 62 + Math.round((done / Math.max(1, total)) * 30));
          onProgress?.(pct, `تجهيز النسخة العربية (${done}/${total})...`);
        }
      );
      arQuestions = arBatch.slice(0, qList.length);
      arAnswers = arBatch.slice(qList.length);
    }

    // Retry any individual item whose Arabic or English translation returned empty/mixed
    const bilingualQuestions: ExtractedFactQuestion[] = [];
    for (let idx = 0; idx < qList.length; idx++) {
      const q = qList[idx];
      let pureEnQ = sanitizeEnglishSection(enQuestions[idx] || (!sourceIsArabic ? rawQuestions[idx] : ''));
      let pureEnA = sanitizeEnglishSection(enAnswers[idx] || (!sourceIsArabic ? rawAnswers[idx] : ''));
      let pureArQ = sanitizePureArabicSection(arQuestions[idx] || (sourceIsArabic ? rawQuestions[idx] : ''), true);
      let pureArA = sanitizePureArabicSection(arAnswers[idx] || (sourceIsArabic ? rawAnswers[idx] : ''), false);

      if (!pureArQ && pureEnQ) {
        try {
          const retryQ = await translateTextClientSide(pureEnQ, 'ar', 'en');
          pureArQ = sanitizePureArabicSection(retryQ.translatedText, true);
        } catch {
          pureArQ = '';
        }
      }
      if (!pureArA && pureEnA) {
        try {
          const retryA = await translateTextClientSide(pureEnA, 'ar', 'en');
          pureArA = sanitizePureArabicSection(retryA.translatedText, false);
        } catch {
          pureArA = '';
        }
      }
      if (!pureEnQ && pureArQ) {
        try {
          const retryEnQ = await translateTextClientSide(pureArQ, 'en', 'ar');
          pureEnQ = sanitizeEnglishSection(retryEnQ.translatedText);
        } catch {
          pureEnQ = '';
        }
      }
      if (!pureEnA && pureArA) {
        try {
          const retryEnA = await translateTextClientSide(pureArA, 'en', 'ar');
          pureEnA = sanitizeEnglishSection(retryEnA.translatedText);
        } catch {
          pureEnA = '';
        }
      }

      bilingualQuestions.push({
        ...q,
        questionAr: pureArQ,
        questionEn: pureEnQ,
        answerAr: pureArA,
        answerEn: pureEnA,
        question: pureArQ || 'جاري الترجمة',
        answer: pureArA || 'جاري الترجمة',
      });
    }

    const formattedBlocks = bilingualQuestions.map((q) =>
      [
        `س${q.number}:`,
        `السؤال بالعربي:`,
        `${q.questionAr || 'جاري الترجمة'}`,
        ``,
        `Question in English:`,
        `${q.questionEn || 'Translating...'}`,
        ``,
        `الجواب بالعربي:`,
        `${q.answerAr || 'جاري الترجمة'}`,
        ``,
        `Answer in English:`,
        `${q.answerEn || 'Translating...'}`,
        ``,
        `----------------------------------------`,
      ].join('\n')
    );

    const header = [
      `بنك الأسئلة والأجوبة باللغتين`,
      `عربي ثم إنكليزي`,
      `عدد الأسئلة: ${bilingualQuestions.length}`,
      `النطاق: ${baseBundle.pagesUsedLabel}`,
      `عدد الفقرات: ${baseBundle.totalParagraphs}`,
      ``,
    ].join('\n');

    onProgress?.(100, 'اكتمل تجهيز الأسئلة والأجوبة باللغتين بنجاح!');

    return {
      questions: bilingualQuestions,
      totalParagraphs: baseBundle.totalParagraphs,
      totalPagesDetected: baseBundle.totalPagesDetected,
      pagesUsedLabel: baseBundle.pagesUsedLabel,
      formattedText: `${header}\n${formattedBlocks.join('\n')}`,
      outputLangCode: 'bilingual_ar_en',
      outputIsRTL: true,
      isBilingualArEn: true,
    };
  }

  // === SINGLE WORLD-LANGUAGE MODE ===
  const resolvedTargetCode =
    !outputLanguage || outputLanguage === 'original'
      ? detectedSourceCode
      : resolveLangCode(outputLanguage);

  const baseUseArabic = resolvedTargetCode === 'ar';

  onProgress?.(20, 'جاري تحليل فقرات النص واستخراج الحقائق...');
  const baseBundle = extractStrictDocumentQuestions({
    sourceText,
    topic,
    type,
    count,
    pageRangeMode,
    fromPage,
    toPage,
    isRTL: baseUseArabic,
  });

  const targetIsRtl = isRtlLangCode(resolvedTargetCode);
  const baseLang = baseUseArabic ? 'ar' : 'en';

  // If no translation needed (e.g. Arabic text with Arabic/original, or English text with English/original)
  if (resolvedTargetCode === baseLang) {
    onProgress?.(100, 'اكتمل استخراج الأسئلة بنجاح!');
    return {
      ...baseBundle,
      outputLangCode: resolvedTargetCode,
      outputIsRTL: targetIsRtl,
      isBilingualArEn: false,
    };
  }

  onProgress?.(
    45,
    `جاري صياغة الأسئلة والأجوبة باللغة المستهدفة (${resolvedTargetCode})...`
  );

  const labelTitle = `Fact-Verified Q&A Extracted from Document (${baseBundle.questions.length} Questions)`;
  const labelScope = `Scope: ${baseBundle.pagesUsedLabel} | Paragraphs Analyzed: ${baseBundle.totalParagraphs}`;
  const labelQ = 'Question';
  const labelA = 'Answer';
  const labelOrig = 'Original Sentence';
  const labelPara = 'Paragraph';
  const labelTrue = 'True (verified in text)';

  const uniqueCats = Array.from(new Set(baseBundle.questions.map((q) => q.categoryLabel)));
  const itemsToTranslate = [
    labelTitle,
    labelScope,
    labelQ,
    labelA,
    labelOrig,
    labelPara,
    labelTrue,
    ...uniqueCats,
    ...baseBundle.questions.flatMap((q) => [q.question, q.answer]),
  ];

  const translatedItems = await translateBatchClientSide(
    itemsToTranslate,
    resolvedTargetCode,
    (done, total) => {
      const pct = Math.min(96, 45 + Math.round((done / Math.max(1, total)) * 50));
      onProgress?.(pct, `جاري ترجمة وصياغة الأسئلة (${done}/${total})...`);
    }
  );

  let idx = 0;
  const trTitle = translatedItems[idx++] || labelTitle;
  const trScope = translatedItems[idx++] || labelScope;
  const trQ = translatedItems[idx++] || labelQ;
  const trA = translatedItems[idx++] || labelA;
  const trOrig = translatedItems[idx++] || labelOrig;
  const trPara = translatedItems[idx++] || labelPara;
  const trTrue = translatedItems[idx++] || labelTrue;

  const catMap = new Map<string, string>();
  uniqueCats.forEach((c) => {
    catMap.set(c, translatedItems[idx++] || c);
  });

  const translatedQuestions: ExtractedFactQuestion[] = baseBundle.questions.map((q) => {
    const qText = translatedItems[idx++] || q.question;
    const aText = translatedItems[idx++] || q.answer;
    return {
      ...q,
      categoryLabel: catMap.get(q.categoryLabel) || q.categoryLabel,
      question: qText,
      answer: aText,
    };
  });

  const header = `# ${trTitle}\n${trScope}\n`;
  const bodyLines = translatedQuestions.map((q) => {
    if (type === 'true_false') {
      return [
        `**${trQ} ${q.number} [${q.categoryLabel}]:** ${q.question}`,
        `**${trA}:** ✔️ ${trTrue}`,
        `**${trOrig}:** "${q.originalSentence}"`,
        `**${trPara}:** ${q.paragraphNumber}\n`,
      ].join('\n');
    }
    return [
      `**${trQ} ${q.number} [${q.categoryLabel}]:** ${q.question}`,
      `**${trA}:** ${q.answer}`,
      `**${trOrig}:** "${q.originalSentence}"`,
      `**${trPara}:** ${q.paragraphNumber}\n`,
    ].join('\n');
  });

  onProgress?.(100, 'اكتمل استخراج الأسئلة باللغة المطلوبة بنجاح!');
  return {
    questions: translatedQuestions,
    totalParagraphs: baseBundle.totalParagraphs,
    totalPagesDetected: baseBundle.totalPagesDetected,
    pagesUsedLabel: baseBundle.pagesUsedLabel,
    formattedText: [header, ...bodyLines].join('\n'),
    outputLangCode: resolvedTargetCode,
    outputIsRTL: targetIsRtl,
    isBilingualArEn: false,
  };
}

/**
 * Renders extracted Q&A bundle to a structured A4 PDF.
 * For Bilingual mode: applies exact student-friendly order & distinct colors:
 * Arabic Question -> space -> English Question -> space -> Arabic Answer -> space -> English Answer
 */
export async function renderQuestionsBundleToPdfBlob(
  bundle: ExtractedQuestionsBundle,
  title: string
): Promise<Blob> {
  if (!bundle.isBilingualArEn) {
    return renderTextToPdfBlob(bundle.formattedText, title);
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 10;
  const printWidthMm = pageWidthMm - marginMm * 2;
  const maxPageContentHeightMm = pageHeightMm - marginMm * 2;

  // Render cards in batches of 3 per A4 container so no question card splits mid-box across pages
  const CARDS_PER_PAGE = 3;
  const chunks: ExtractedFactQuestion[][] = [];
  for (let i = 0; i < bundle.questions.length; i += CARDS_PER_PAGE) {
    chunks.push(bundle.questions.slice(i, i + CARDS_PER_PAGE));
  }

  for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
    const group = chunks[pageIdx];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.padding = '28px 38px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Cairo', Arial, sans-serif";

    const headerBlock =
      pageIdx === 0
        ? `<div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;border-bottom:2px solid #0284c7;padding-bottom:10px;margin-bottom:18px;">
             <div style="font-size:18px;font-weight:800;color:#0f172a;">${escapeHtml(sanitizePureArabicSection(title, false) || 'بنك الأسئلة والأجوبة باللغتين')}</div>
             <div style="font-size:11.5px;color:#475569;margin-top:4px;">سؤال وجواب باللغتين، عربي ثم إنكليزي، عدد الأسئلة ${bundle.questions.length}</div>
           </div>`
        : '';

    const cardsHtml = group
      .map(
        (item) => `
        <div style="border:1.5px solid #cbd5e1;border-radius:14px;padding:16px 18px;margin-bottom:22px;background:#ffffff;">
          <div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;font-size:14px;font-weight:800;color:#0f172a;margin-bottom:12px;">
            س${item.number}:
          </div>

          <div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
            <div style="font-size:11.5px;font-weight:800;color:#1d4ed8;margin-bottom:4px;">السؤال بالعربي:</div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.8;">${escapeHtml(item.questionAr || 'جاري الترجمة')}</div>
          </div>

          <div dir="ltr" lang="en" style="direction:ltr;unicode-bidi:isolate;text-align:left;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 14px;margin-bottom:16px;">
            <div style="font-size:11.5px;font-weight:800;color:#047857;margin-bottom:4px;">Question in English:</div>
            <div style="font-size:12.5px;font-weight:700;color:#064e3b;line-height:1.65;">${escapeHtml(item.questionEn || 'Translating...')}</div>
          </div>

          <div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
            <div style="font-size:11.5px;font-weight:800;color:#0369a1;margin-bottom:4px;">الجواب بالعربي:</div>
            <div style="font-size:12.5px;color:#0f172a;line-height:1.8;">${escapeHtml(item.answerAr || 'جاري الترجمة')}</div>
          </div>

          <div dir="ltr" lang="en" style="direction:ltr;unicode-bidi:isolate;text-align:left;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;">
            <div style="font-size:11.5px;font-weight:800;color:#15803d;margin-bottom:4px;">Answer in English:</div>
            <div style="font-size:12px;color:#14532d;line-height:1.65;">${escapeHtml(item.answerEn || 'Translating...')}</div>
          </div>
        </div>`
      )
      .join('');

    container.innerHTML = `${headerBlock}${cardsHtml}`;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      });

      if (pageIdx > 0) pdf.addPage();
      const naturalImgHeightMm = (canvas.height * printWidthMm) / canvas.width;
      const scaleFit =
        naturalImgHeightMm > maxPageContentHeightMm
          ? maxPageContentHeightMm / naturalImgHeightMm
          : 1;
      const drawWidthMm = printWidthMm * scaleFit;
      const drawHeightMm = naturalImgHeightMm * scaleFit;
      const offsetX = marginMm + (printWidthMm - drawWidthMm) / 2;

      pdf.addImage(canvas, 'JPEG', offsetX, marginMm, drawWidthMm, drawHeightMm, undefined, 'FAST');
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container);
    }
  }

  return pdf.output('blob');
}

/**
 * Builds a Word (.doc) file preserving Bilingual Arabic-then-English formatting with strict language isolation.
 */
export function buildQuestionsWordDocBlob(
  bundle: ExtractedQuestionsBundle,
  title: string
): Blob {
  if (!bundle.isBilingualArEn) {
    return buildWordDocBlob({
      title,
      content: bundle.formattedText,
      targetLang: bundle.outputLangCode || (bundle.outputIsRTL ? 'العربية' : 'English'),
    });
  }

  const cardsHtml = bundle.questions
    .map(
      (item) => `
      <div style="border:1px solid #cbd5e1;padding:14px;margin-bottom:18px;background:#ffffff;">
        <p dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;font-weight:800;font-size:14pt;color:#0f172a;margin:0 0 10px 0;">س${item.number}:</p>

        <div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;background:#eff6ff;border:1px solid #bfdbfe;padding:10px;margin-bottom:10px;text-align:right;">
          <p style="font-weight:700;color:#1d4ed8;margin:0 0 4px 0;">السؤال بالعربي:</p>
          <p style="margin:0;color:#0f172a;">${escapeHtml(item.questionAr || 'جاري الترجمة')}</p>
        </div>

        <div dir="ltr" lang="en" style="direction:ltr;unicode-bidi:isolate;background:#ecfdf5;border:1px solid #a7f3d0;padding:10px;margin-bottom:14px;text-align:left;">
          <p style="font-weight:700;color:#047857;margin:0 0 4px 0;">Question in English:</p>
          <p style="margin:0;color:#064e3b;">${escapeHtml(item.questionEn || 'Translating...')}</p>
        </div>

        <div dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;background:#f0f9ff;border:1px solid #bae6fd;padding:10px;margin-bottom:10px;text-align:right;">
          <p style="font-weight:700;color:#0369a1;margin:0 0 4px 0;">الجواب بالعربي:</p>
          <p style="margin:0;color:#0f172a;">${escapeHtml(item.answerAr || 'جاري الترجمة')}</p>
        </div>

        <div dir="ltr" lang="en" style="direction:ltr;unicode-bidi:isolate;background:#f0fdf4;border:1px solid #bbf7d0;padding:10px;text-align:left;">
          <p style="font-weight:700;color:#15803d;margin:0 0 4px 0;">Answer in English:</p>
          <p style="margin:0;color:#14532d;">${escapeHtml(item.answerEn || 'Translating...')}</p>
        </div>
      </div>`
    )
    .join('');

  const cleanArTitle = sanitizePureArabicSection(title, false) || 'بنك الأسئلة والأجوبة باللغتين';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cleanArTitle)}</title>
<style>
  body { font-family: 'Cairo', 'Arial', sans-serif; color: #0f172a; margin: 24px; line-height: 1.7; }
</style>
</head>
<body>
  <h1 dir="rtl" lang="ar" style="direction:rtl;unicode-bidi:isolate;text-align:right;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:8px;">${escapeHtml(cleanArTitle)}</h1>
  ${cardsHtml}
</body>
</html>`;

  return new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
}

/**
 * Legacy wrapper preserved cleanly for external callers/smoke tests
 */
export function generateQuestionsClientSide(options: {
  sourceText: string;
  topic?: string;
  type: 'multiple_choice' | 'true_false' | 'essay' | 'ministerial';
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isRTL?: boolean;
}): string {
  const res = extractStrictDocumentQuestions({
    sourceText: options.sourceText,
    topic: options.topic,
    type: options.type,
    count: options.count ?? 20,
    isRTL: options.isRTL ?? true,
  });
  return res.formattedText;
}

/**
 * Generate Structured Research Report (Introduction, Body Points, Conclusion, References) 100% Client-Side
 */
export function generateResearchClientSide(options: {
  topic: string;
  points: string;
  sourceContent?: string;
  researchType: string;
  academicLevel: string;
  pagesCount: number;
  isRTL?: boolean;
}): string {
  const {
    topic,
    points,
    sourceContent = '',
    researchType,
    academicLevel,
    pagesCount,
    isRTL = true,
  } = options;

  const cleanTopic = topic.trim() || (isRTL ? 'دراسة تحليلية متكاملة' : 'Comprehensive Analytical Study');
  const bulletPoints = points
    .split('\n')
    .map((p) => p.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean);

  // If user didn't pass bullet points, extract themes from sourceContent or generate subtopics
  const sourceParagraphs = sourceContent
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 25);

  const effectivePoints =
    bulletPoints.length > 0
      ? bulletPoints
      : sourceParagraphs.length > 0
      ? sourceParagraphs.slice(0, 4).map((p) => p.slice(0, 75))
      : isRTL
      ? [
          `الإطار النظري والمفاهيمي لموضوع ${cleanTopic}`,
          `التحليل المنهجي والتطبيقات العملية في ${cleanTopic}`,
          `التحديات الراهنة وسبل التطوير المستقبلي`,
        ]
      : [
          `Conceptual Framework of ${cleanTopic}`,
          `Analytical Methodology and Core Mechanisms`,
          `Challenges, Opportunities, and Future Outlook`,
        ];

  const today = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (isRTL) {
    const bodySections = effectivePoints
      .map((pt, idx) => {
        const matchedContext = sourceParagraphs[idx] ? `\n${sourceParagraphs[idx]}\n` : '';
        const detailDepth = pagesCount >= 10 ? 2 : 1;
        const extraParagraph =
          detailDepth > 1
            ? `\nكما يوضح التحليل المعمق لهذا المحور أن تطبيق المعايير العلمية في "${pt}" يسهم بشكل مباشر في رفع كفاءة المخرجات البحثية وتحقيق المواءمة مع متطلبات المرحلة الحالية.\n`
            : '';
        return `## المحور ${idx + 1}: ${pt}
يتناول هذا المحور دراسة وتحليل "${pt}" بوصفه ركيزة أساسية في سياق موضوع (${cleanTopic}). تشير المعطيات العلمية والمنهجية إلى أهمية فهم الأبعاد التطبيقية والنظرية لهذا الجانب لتحقيق استنتاجات دقيقة وموثوقة.${matchedContext}${extraParagraph}
- **النتيجة التحليلية:** يرتبط محور "${pt}" بتحسين الفهم الشامل للموضوع ودعم القرارات المبنية على الأدلة.
- **النقطة التطبيقية:** ينبغي توثيق المؤشرات المرتبطة بهذا المحور ومتابعتها بصورة دورية.`;
      })
      .join('\n\n');

    return `# ${cleanTopic}

**نوع البحث:** ${researchType} | **المستوى الأكاديمي:** ${academicLevel} | **تاريخ الإعداد:** ${today} | **التقدير الحجمي:** ${pagesCount} صفحات

---

## أولاً: المقدمة
يُعد موضوع **"${cleanTopic}"** من الموضوعات الحيوية التي تستقطب اهتمام الباحثين والدارسين في مستوى (${academicLevel})، نظراً لتأثيره المباشر على تطور المعرفة العلمية والتطبيقات العملية المرتبطة به. تهدف هذه الدراسة المنظمة بصيغة (${researchType}) إلى تسليط الضوء على الجوانب الجوهرية للموضوع عبر تحليل النقاط المحورية التالية: ${effectivePoints.join('، ')}.

وتكمن أهمية هذا البحث في سعيه إلى تقديم رؤية منهجية متماسكة تربط بين التأصيل النظري والمعطيات الواقعية، بما يوفر أساساً واضحاً للنقاش الأكاديمي والوصول إلى توصيات عملية قابلة للتطبيق.

---

## ثانياً: العرض والتحليل العلمي

${bodySections}

---

## ثالثاً: الخاتمة والنتائج
في ختام هذا البحث حول **"${cleanTopic}"**، توصلت الدراسة إلى جملة من الاستنتاجات الرئيسية:
1. أثبتت المحاور التي تمت معالجتها أن الفهم التكاملي لعناصر الموضوع ضروري للوصول إلى نتائج دقيقة.
2. يُعد التركيز على (${effectivePoints[0]}) عاملاً محورياً في بناء إطار علمي متين.
3. توصي الدراسة بمواصلة البحث الميداني وتوظيف الأدوات التحليلية الحديثة لتوسيع نطاق النتائج المستقبلية.

---

## رابعاً: المصادر والمراجع
1. الدراسات الأكاديمية والأوراق العلمية المحكمة حول: ${cleanTopic} (${new Date().getFullYear()}).
2. دليل منهجية البحث العلمي وكتابة التقارير الجامعية لمرحلة (${academicLevel}).
3. البيانات والمستخلصات التحليلية المعتمدة في متن التقرير${sourceContent ? ' (المستند المرجعي المرفق)' : ''}.
`;
  } else {
    const bodySections = effectivePoints
      .map((pt, idx) => {
        const matchedContext = sourceParagraphs[idx] ? `\n${sourceParagraphs[idx]}\n` : '';
        return `## Section ${idx + 1}: ${pt}
This section examines "${pt}" as a foundational pillar within the study of "${cleanTopic}". Analytical evaluation demonstrates how structured investigation of this dimension clarifies cause-and-effect relationships and supports rigorous academic conclusions.${matchedContext}
- **Key Analytical Takeaway:** "${pt}" directly strengthens overall coherence and evidence-based understanding.
- **Practical Implication:** Systematic tracking of measurable indicators reinforces long-term outcomes.`;
      })
      .join('\n\n');

    return `# ${cleanTopic}

**Paper Type:** ${researchType} | **Academic Level:** ${academicLevel} | **Date:** ${today} | **Target Scope:** ${pagesCount} Pages

---

## 1. Introduction
The topic of **"${cleanTopic}"** represents a significant area of inquiry at the (${academicLevel}) level. Prepared as a structured (${researchType}), this report explores the primary dimensions of the subject with particular emphasis on: ${effectivePoints.join('; ')}.

By bridging theoretical foundations with structured analysis, this work provides a clear framework for evaluating core mechanisms and formulating evidence-grounded recommendations.

---

## 2. Main Body & Analysis

${bodySections}

---

## 3. Conclusion & Key Findings
In summary, this investigation of **"${cleanTopic}"** highlights three central conclusions:
1. Integrated analysis across all outlined points produces stronger, more reliable interpretations.
2. Focused examination of "${effectivePoints[0]}" establishes the conceptual anchor for practical application.
3. Future research should expand empirical validation across broader datasets and institutional contexts.

---

## 4. References & Sources
1. Academic Research Compendium on ${cleanTopic} (${new Date().getFullYear()}).
2. Standard Academic Writing & Research Methodology Guidelines (${academicLevel}).
3. Primary Context & Analytical Notes${sourceContent ? ' (Uploaded Reference Document)' : ''}.
`;
  }
}

/**
 * Pure JS Math Expression & Document Problem Solver (no eval, 100% client-side)
 */
function evaluateSafeMath(expr: string): number | null {
  const cleaned = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').trim();
  if (!/^[\d+\-*/().\s*]+$/.test(cleaned)) return null;

  // Tokenize
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '*' && cleaned[i + 1] === '*') {
      tokens.push('^');
      i += 2;
      continue;
    }
    if ('+-*/()^'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/\d|\./.test(ch)) {
      let num = '';
      while (i < cleaned.length && /[\d.]/.test(cleaned[i])) {
        num += cleaned[i++];
      }
      tokens.push(num);
      continue;
    }
    return null;
  }

  let pos = 0;
  const parseExpr = (): number => {
    let val = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  };
  const parseTerm = (): number => {
    let val = parsePower();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parsePower();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      val = op === '*' ? val * right : val / right;
    }
    return val;
  };
  const parsePower = (): number => {
    let val = parseFactor();
    if (pos < tokens.length && tokens[pos] === '^') {
      pos++;
      val = Math.pow(val, parsePower());
    }
    return val;
  };
  const parseFactor = (): number => {
    if (tokens[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (tokens[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (tokens[pos] !== ')') throw new Error('Unmatched parenthesis');
      pos++;
      return val;
    }
    const num = Number(tokens[pos++]);
    if (Number.isNaN(num)) throw new Error('Invalid number');
    return num;
  };

  try {
    const result = parseExpr();
    return pos === tokens.length && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export function solveQuestionClientSide(options: {
  question: string;
  context: string;
  mode?: 'normal' | 'explain_more' | 'alternative_method';
  isRTL?: boolean;
}): string {
  const { question, context, mode = 'normal', isRTL = true } = options;
  const q = question.trim();

  // 1. Check linear equation ax + b = c
  const linearMatch = q.replace(/\s+/g, '').match(/^([+-]?\d*\.?\d*)x([+-]\d+\.?\d*)?=([+-]?\d+\.?\d*)$/i);
  if (linearMatch) {
    const aStr = linearMatch[1];
    const a = aStr === '' || aStr === '+' ? 1 : aStr === '-' ? -1 : Number(aStr);
    const b = linearMatch[2] ? Number(linearMatch[2]) : 0;
    const c = Number(linearMatch[3]);
    if (a !== 0 && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      const xVal = (c - b) / a;
      return isRTL
        ? `### حل المعادلة الخطية خطوة بخطوة:\n1. المعادلة الأصلية: ${q}\n2. ننقل الثابت إلى الطرف الآخر: ${a}x = ${c} - (${b}) = ${c - b}\n3. نقسم الطرفين على معامل x (${a}):\n**x = ${Number(xVal.toFixed(4))}**${
            mode === 'alternative_method' ? `\n\n**طريقة التحقق البديلة:** بالتعويض عن x=${xVal.toFixed(2)} يكون الطرف الأيسر مساوياً للطرف الأيمن (${c}).` : ''
          }`
        : `### Step-by-Step Linear Equation Solution:\n1. Original equation: ${q}\n2. Isolate the x-term: ${a}x = ${c - b}\n3. Divide by ${a}:\n**x = ${Number(xVal.toFixed(4))}**`;
    }
  }

  // 2. Check arithmetic / numeric expression
  const mathExpr = q.replace(/[=?؟]/g, '').trim();
  const mathVal = evaluateSafeMath(mathExpr);
  if (mathVal !== null) {
    return isRTL
      ? `### الحل الحسابي المباشر:\n- **التعبير:** ${mathExpr}\n- **النتيجة النهائية:** **${Number(mathVal.toFixed(6))}**${
          mode === 'explain_more'
            ? '\n\n**شرح الخطوات:** تم تطبيق أولويات العمليات الحسابية (الأقواس، الأسس، الضرب والقسمة من اليسار لليمين، ثم الجمع والطرح).'
            : ''
        }`
      : `### Direct Mathematical Evaluation:\n- **Expression:** ${mathExpr}\n- **Final Result:** **${Number(mathVal.toFixed(6))}**`;
  }

  // 3. Extract matching contextual answers from uploaded document
  const contextText = context.trim();
  if (contextText) {
    const sentences = contextText
      .split(/(?<=[.!?؟\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12);

    const keywords = q
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const scored = sentences
      .map((s) => {
        const lower = s.toLowerCase();
        const hits = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
        return { s, hits };
      })
      .sort((a, b) => b.hits - a.hits);

    const topMatches = scored.slice(0, mode === 'explain_more' ? 5 : 3).map((x) => x.s);

    return isRTL
      ? `### التحليل والحل المستخرج من المستند:\n${
          q ? `**السؤال:** ${q}\n\n` : ''
        }**الخلاصة والأدلة من النص:**\n${topMatches.map((m, i) => `${i + 1}. ${m}`).join('\n')}${
          mode === 'alternative_method'
            ? '\n\n**منهجية بديلة للفهم:** اربط كل نقطة مستخرجة بالفكرة العامة للمستند وقارن المصطلحات الواردة أعلاه.'
            : ''
        }`
      : `### Extracted Analysis & Solution from Document:\n${
          q ? `**Question:** ${q}\n\n` : ''
        }**Key Evidence:**\n${topMatches.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
  }

  throw new Error(
    isRTL
      ? 'يرجى كتابة معادلة حسابية (مثال: 2x + 4 = 12) أو رفع مستند يحتوي على أسئلة لتحليله.'
      : 'Please enter a math equation (e.g. 2x + 4 = 12) or upload a document to analyze.'
  );
}

/**
 * Solve equations or extract contextual document answers in any user-chosen world language.
 */
export async function solveQuestionMultilingualClientSide(options: {
  question: string;
  context: string;
  mode?: 'normal' | 'explain_more' | 'alternative_method';
  outputLanguage?: string;
  isRTL?: boolean;
  onProgress?: (pct: number, label: string) => void;
}): Promise<{ solution: string; outputLangCode: string; outputIsRTL: boolean }> {
  const { question, context, mode = 'normal', outputLanguage, isRTL = true, onProgress } = options;

  const sampleForDetect = `${question} ${context.slice(0, 600)}`.trim();
  const targetCode =
    !outputLanguage || outputLanguage === 'original' || outputLanguage === 'auto'
      ? detectLanguageCode(sampleForDetect)
      : resolveLangCode(outputLanguage);

  const outputIsRTL = isRtlLangCode(targetCode);
  const generateArabicBase = targetCode === 'ar';
  const baseLang = generateArabicBase ? 'ar' : 'en';

  onProgress?.(35, isRTL ? 'جاري تحليل المعادلات والمستند...' : 'Analyzing problem & document...');

  const baseSolution = solveQuestionClientSide({
    question,
    context,
    mode,
    isRTL: generateArabicBase,
  });

  if (targetCode === baseLang) {
    return {
      solution: baseSolution,
      outputLangCode: targetCode,
      outputIsRTL,
    };
  }

  onProgress?.(60, isRTL ? `جاري صياغة الحل باللغة المطلوبة (${targetCode})...` : `Translating solution to ${targetCode}...`);

  const translated = await translateTextClientSide(baseSolution, targetCode, baseLang, (p) => {
    const scaled = 60 + Math.round((p.percent / 100) * 36);
    onProgress?.(scaled, p.status);
  });

  return {
    solution: translated.translatedText,
    outputLangCode: targetCode,
    outputIsRTL,
  };
}

