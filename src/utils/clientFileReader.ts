import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Configure PDF.js to use the locally bundled Vite worker (100% client-side, works offline)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface ClientReadResult {
  fileType: 'pdf' | 'docx' | 'doc' | 'xlsx' | 'csv' | 'pptx' | 'txt' | 'image' | 'audio' | 'unknown';
  extractedText: string;
  extractedHtml?: string;
  pageCount: number;
  characterCount: number;
  wordCount: number;
  tableCount: number;
  imageCount: number;
  sheets?: Array<{ name: string; rows: string[][] }>;
  imageDataUrl?: string;
  audioDurationSeconds?: number;
}

export function validateFileSize(file: File, isRTL: boolean = true): void {
  if (!file) {
    throw new Error(isRTL ? 'لم يتم اختيار أي ملف.' : 'No file selected.');
  }
  if (file.size === 0) {
    throw new Error(isRTL ? 'الملف المختار فارغ (0 بايت).' : 'The selected file is empty (0 bytes).');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      isRTL
        ? `حجم الملف (${sizeMb} MB) يتجاوز الحد الأقصى المسموح به وهو 20 ميجابايت (20MB). يرجى اختيار ملف أصغر.`
        : `File size (${sizeMb} MB) exceeds the 20MB maximum limit. Please choose a smaller file.`
    );
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getFileExtension(file: File): string {
  const parts = file.name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

/**
 * Read PDF pages and extract text completely client-side via PDF.js (pdfjs-dist)
 */
async function readPdfClientSide(
  arrayBuffer: ArrayBuffer,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<ClientReadResult> {
  onProgress?.(10, isRTL ? 'جاري فتح ملف PDF عبر PDF.js...' : 'Opening PDF with PDF.js...');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer.slice(0)),
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages || 1;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let currentLine = '';

    for (const item of textContent.items as Array<any>) {
      const str = typeof item.str === 'string' ? item.str : '';
      const transform = item.transform;
      const y = Array.isArray(transform) ? transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine += (currentLine && str && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
      }
      if (y !== null) lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    const pageStr = lines.join('\n').trim();
    if (pageStr) {
      pageTexts.push(totalPages > 1 ? `--- صفحة ${pageNum} / Page ${pageNum} ---\n${pageStr}` : pageStr);
    }

    const pct = 15 + Math.round((pageNum / totalPages) * 80);
    onProgress?.(
      pct,
      isRTL ? `استخراج صفحة ${pageNum} من ${totalPages}...` : `Extracting page ${pageNum} of ${totalPages}...`
    );
  }

  const combinedText = pageTexts.join('\n\n').trim();
  const finalText =
    combinedText ||
    (isRTL
      ? '(تنبيه: ملف PDF يحتوي على صور ممسوحة ضوئياً بدون طبقة نصية، يمكنك تحويله إلى صور أو كتابة النص يدوياً.)'
      : '(Note: This PDF appears to contain scanned images without selectable text. You can convert pages to images or paste text manually.)');

  const wordCount = combinedText ? combinedText.split(/\s+/).filter(Boolean).length : 0;
  onProgress?.(100, isRTL ? 'اكتملت قراءة ملف PDF' : 'PDF extraction complete');

  return {
    fileType: 'pdf',
    extractedText: finalText,
    pageCount: totalPages,
    characterCount: finalText.length,
    wordCount,
    tableCount: 0,
    imageCount: 0,
  };
}

/**
 * Render PDF pages to PNG data URLs via PDF.js + HTML5 Canvas (100% Client-Side)
 */
export async function renderPdfPagesToImages(
  arrayBuffer: ArrayBuffer,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  maxPages: number = 25,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<Array<{ pageNumber: number; dataUrl: string; blob: Blob }>> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer.slice(0)),
  });
  const pdf = await loadingTask.promise;
  const totalPages = Math.min(pdf.numPages || 1, maxPages);
  const results: Array<{ pageNumber: number; dataUrl: string; blob: Blob }> = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(isRTL ? 'تعذر تهيئة Canvas لعرض صفحة PDF.' : 'Failed to initialize canvas for PDF rendering.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL(format, 0.92);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode page image'))),
        format,
        0.92
      );
    });

    results.push({ pageNumber: i, dataUrl, blob });
    const pct = Math.round((i / totalPages) * 100);
    onProgress?.(pct, isRTL ? `تحويل صفحة ${i} من ${totalPages} إلى صورة...` : `Rendering page ${i} of ${totalPages}...`);
  }

  return results;
}

/**
 * Read Word (.docx) using mammoth.js (100% Client-Side)
 */
async function readDocxClientSide(
  arrayBuffer: ArrayBuffer,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<ClientReadResult> {
  onProgress?.(25, isRTL ? 'جاري قراءة مستند Word عبر mammoth.js...' : 'Reading Word document via mammoth.js...');
  const cloned = arrayBuffer.slice(0);
  const [htmlRes, textRes] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer: cloned.slice(0) }),
    mammoth.extractRawText({ arrayBuffer: cloned.slice(0) }),
  ]);

  const rawText = (textRes.value || '').trim();
  const rawHtml = htmlRes.value || '';
  const tableCount = (rawHtml.match(/<table/gi) || []).length;
  const imageCount = (rawHtml.match(/<img/gi) || []).length;
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 380));

  onProgress?.(100, isRTL ? 'اكتملت قراءة مستند Word' : 'Word extraction complete');
  return {
    fileType: 'docx',
    extractedText: rawText,
    extractedHtml: rawHtml,
    pageCount: estimatedPages,
    characterCount: rawText.length,
    wordCount,
    tableCount,
    imageCount,
  };
}

/**
 * Read Excel / CSV (.xlsx, .xls, .csv) using SheetJS (xlsx)
 */
async function readSpreadsheetClientSide(
  arrayBuffer: ArrayBuffer,
  ext: string,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<ClientReadResult> {
  onProgress?.(25, isRTL ? 'جاري قراءة الجداول عبر SheetJS...' : 'Reading spreadsheet via SheetJS...');
  const workbook = XLSX.read(new Uint8Array(arrayBuffer.slice(0)), { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  const sheets: Array<{ name: string; rows: string[][] }> = [];
  const textBlocks: string[] = [];

  sheetNames.forEach((name, idx) => {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const stringRows: string[][] = rows
      .map((r) => (Array.isArray(r) ? r.map((cell) => String(cell ?? '').trim()) : []))
      .filter((r) => r.some((cell) => cell.length > 0));

    sheets.push({ name, rows: stringRows });

    if (stringRows.length > 0) {
      const mdLines: string[] = [];
      if (sheetNames.length > 1) {
        mdLines.push(`## ${name}`);
      }
      const maxCols = Math.max(...stringRows.map((r) => r.length), 1);
      stringRows.slice(0, 500).forEach((row, rIdx) => {
        const padded = Array.from({ length: maxCols }, (_, c) => (row[c] || '').replace(/\|/g, '/'));
        mdLines.push(`| ${padded.join(' | ')} |`);
        if (rIdx === 0) {
          mdLines.push(`| ${padded.map(() => '---').join(' | ')} |`);
        }
      });
      textBlocks.push(mdLines.join('\n'));
    }

    onProgress?.(
      30 + Math.round(((idx + 1) / Math.max(1, sheetNames.length)) * 65),
      isRTL ? `تحليل ورقة العمل: ${name}` : `Parsing sheet: ${name}`
    );
  });

  const extractedText = textBlocks.join('\n\n').trim();
  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  onProgress?.(100, isRTL ? 'اكتملت قراءة جدول البيانات' : 'Spreadsheet extraction complete');

  return {
    fileType: ext === 'csv' ? 'csv' : 'xlsx',
    extractedText,
    pageCount: Math.max(1, sheetNames.length),
    characterCount: extractedText.length,
    wordCount,
    tableCount: sheetNames.length,
    imageCount: 0,
    sheets,
  };
}

/**
 * Read PowerPoint (.pptx) using JSZip
 */
async function readPptxClientSide(
  arrayBuffer: ArrayBuffer,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<ClientReadResult> {
  onProgress?.(20, isRTL ? 'جاري قراءة شرائح العرض التقديمي PPTX...' : 'Reading PowerPoint slides...');
  const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
  const slideFiles = zip
    .file(/^ppt\/slides\/slide\d+\.xml$/)
    .sort((a, b) => {
      const numA = parseInt(a.name.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const numB = parseInt(b.name.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error(isRTL ? 'ملف PPTX لا يحتوي على شرائح نصية صالحة.' : 'PPTX archive contains no readable slides.');
  }

  const slideTexts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await slideFiles[i].async('text');
    const paragraphs = xml.split(/<\/a:p>/g);
    const lines: string[] = [];
    for (const para of paragraphs) {
      const matches = Array.from(para.matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/g)).map((m) =>
        decodeXmlEntities(m[1])
      );
      const line = matches.join('').trim();
      if (line) lines.push(line);
    }
    if (lines.length > 0) {
      slideTexts.push(`### ${isRTL ? `الشريحة ${i + 1}` : `Slide ${i + 1}`}\n${lines.join('\n')}`);
    }
    onProgress?.(
      25 + Math.round(((i + 1) / slideFiles.length) * 70),
      isRTL ? `استخراج الشريحة ${i + 1} من ${slideFiles.length}...` : `Extracting slide ${i + 1} of ${slideFiles.length}...`
    );
  }

  const extractedText = slideTexts.join('\n\n').trim();
  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  onProgress?.(100, isRTL ? 'اكتملت قراءة العرض التقديمي' : 'PowerPoint extraction complete');

  return {
    fileType: 'pptx',
    extractedText,
    pageCount: slideFiles.length,
    characterCount: extractedText.length,
    wordCount,
    tableCount: 0,
    imageCount: 0,
  };
}

/**
 * Universal 100% Client-Side File Reader (PDF, DOCX, XLSX/CSV, PPTX, TXT, Image, Audio)
 */
export async function readFileClientSide(
  file: File,
  onProgress?: (percent: number, message: string) => void,
  isRTL: boolean = true
): Promise<ClientReadResult> {
  validateFileSize(file, isRTL);
  const ext = getFileExtension(file);
  const mime = (file.type || '').toLowerCase();

  onProgress?.(5, isRTL ? `جاري فحص الملف: ${file.name}...` : `Inspecting file: ${file.name}...`);

  try {
    // 1. PDF
    if (ext === 'pdf' || mime === 'application/pdf') {
      const buffer = await file.arrayBuffer();
      return await readPdfClientSide(buffer, onProgress, isRTL);
    }

    // 2. Word (.docx)
    if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const buffer = await file.arrayBuffer();
      return await readDocxClientSide(buffer, onProgress, isRTL);
    }

    // 3. Legacy .doc (HTML-saved Word docs or plain text inside .doc)
    if (ext === 'doc' || mime === 'application/msword') {
      onProgress?.(40, isRTL ? 'قراءة ملف Word (.doc)...' : 'Reading Word (.doc) file...');
      const text = await file.text();
      const cleaned = /<[a-z][\s\S]*>/i.test(text)
        ? text
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
        : text.replace(/[^\x20-\x7E\u0600-\u06FF\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
      onProgress?.(100, isRTL ? 'تمت قراءة الملف' : 'File read complete');
      return {
        fileType: 'doc',
        extractedText: cleaned || (isRTL ? 'مستند Word جاهز للتحويل والمعالجة.' : 'Word document ready for processing.'),
        pageCount: Math.max(1, Math.ceil((cleaned.split(/\s+/).length || 1) / 380)),
        characterCount: cleaned.length,
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
        tableCount: 0,
        imageCount: 0,
      };
    }

    // 4. Spreadsheets (.xlsx, .xls, .csv)
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || mime.includes('spreadsheet') || mime === 'text/csv') {
      const buffer = await file.arrayBuffer();
      return await readSpreadsheetClientSide(buffer, ext, onProgress, isRTL);
    }

    // 5. PowerPoint (.pptx)
    if (ext === 'pptx' || mime.includes('presentationml')) {
      const buffer = await file.arrayBuffer();
      return await readPptxClientSide(buffer, onProgress, isRTL);
    }

    // 6. Plain Text & Markup (.txt, .md, .json, .html, .xml)
    if (
      ['txt', 'md', 'json', 'log', 'html', 'htm', 'xml', 'srt', 'vtt'].includes(ext) ||
      mime.startsWith('text/')
    ) {
      onProgress?.(50, isRTL ? 'قراءة النص الكامل للملف...' : 'Reading text contents...');
      const text = (await file.text()).trim();
      onProgress?.(100, isRTL ? 'اكتملت قراءة الملف النصي' : 'Text file loaded');
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      return {
        fileType: 'txt',
        extractedText: text,
        pageCount: Math.max(1, Math.ceil(words / 400)),
        characterCount: text.length,
        wordCount: words,
        tableCount: 0,
        imageCount: 0,
      };
    }

    // 7. Images
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      onProgress?.(50, isRTL ? 'جاري تحميل ومعاينة الصورة...' : 'Loading image...');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(isRTL ? 'فشل قراءة الصورة.' : 'Failed to read image.'));
        reader.readAsDataURL(file);
      });
      onProgress?.(100, isRTL ? 'تم تحميل الصورة بنجاح' : 'Image loaded');
      const note = isRTL
        ? `تم رفع الصورة: ${file.name} (${(file.size / 1024).toFixed(1)} KB). يمكنك استخدام أداة تحويل الصيغ أو تعديل الصور.`
        : `Image uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Ready for conversion or enhancement.`;
      return {
        fileType: 'image',
        extractedText: note,
        pageCount: 1,
        characterCount: note.length,
        wordCount: note.split(/\s+/).length,
        tableCount: 0,
        imageCount: 1,
        imageDataUrl: dataUrl,
      };
    }

    // 8. Audio
    if (['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac'].includes(ext) || mime.startsWith('audio/')) {
      onProgress?.(60, isRTL ? 'جاري فحص الملف الصوتي...' : 'Inspecting audio file...');
      let duration = 0;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const buf = await file.arrayBuffer();
          const decoded = await ctx.decodeAudioData(buf.slice(0));
          duration = decoded.duration || 0;
          await ctx.close();
        }
      } catch {
        // Fallback if codec decoding isn't exposed directly; HTML audio handles playback
      }
      onProgress?.(100, isRTL ? 'الملف الصوتي جاهز' : 'Audio file ready');
      const note = isRTL
        ? `ملف صوتي جاهز: ${file.name}${duration ? ` (المدة: ${duration.toFixed(1)} ثانية)` : ''}. افتح أداة الصوت لتشغيله وتفريغه.`
        : `Audio ready: ${file.name}${duration ? ` (Duration: ${duration.toFixed(1)}s)` : ''}. Open Voice Tool to transcribe.`;
      return {
        fileType: 'audio',
        extractedText: note,
        pageCount: 1,
        characterCount: note.length,
        wordCount: note.split(/\s+/).length,
        tableCount: 0,
        imageCount: 0,
        audioDurationSeconds: duration,
      };
    }

    throw new Error(
      isRTL
        ? `صيغة الملف (.${ext || 'غير معروف'}) غير مدعومة حالياً. الصيغ المدعومة: PDF, DOCX, XLSX, CSV, PPTX, TXT, الصور والصوت.`
        : `Unsupported file format (.${ext || 'unknown'}). Supported: PDF, DOCX, XLSX, CSV, PPTX, TXT, Images & Audio.`
    );
  } catch (err: any) {
    throw new Error(
      err?.message ||
        (isRTL
          ? 'فشل تحليل وقراءة الملف داخل المتصفح. تأكد من أن الملف غير تالف أو مشفر.'
          : 'Failed to parse file in browser. Please ensure the file is valid and not password-protected.')
    );
  }
}
