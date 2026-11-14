import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import { isRtlLangCode, resolveLangCode } from './clientTranslator';

export interface ParsedDocumentStructure {
  fileType: 'pdf' | 'docx' | 'image' | 'text' | 'xlsx' | 'pptx';
  pageCount: number;
  hasTables: boolean;
  hasImages: boolean;
  tableCount: number;
  imageCount: number;
  extractedHtml?: string;
  extractedText: string;
  pageSizes?: Array<{ width: number; height: number }>;
  metadata?: Record<string, any>;
}

/**
 * Parse Word documents (.docx) using mammoth
 * Preserves tables, images, formatting, and structural headings
 */
export async function parseWordDocument(arrayBuffer: ArrayBuffer): Promise<ParsedDocumentStructure> {
  try {
    // 1. Convert to HTML preserving inline images and tables
    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: mammoth.images.imgElement((image) => {
          return image.read('base64').then((imageBuffer) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`,
            };
          });
        }),
      }
    );

    // 2. Extract raw text for clean processing
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    const rawHtml = htmlResult.value || '';
    const rawText = textResult.value || '';

    // Count tables and images in structure
    const tableMatches = rawHtml.match(/<table/gi);
    const imageMatches = rawHtml.match(/<img/gi);
    const tableCount = tableMatches ? tableMatches.length : 0;
    const imageCount = imageMatches ? imageMatches.length : 0;

    // Estimate page count (~400 words or 2500 characters per page)
    const wordCount = rawText.split(/\s+/).filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / 400));

    return {
      fileType: 'docx',
      pageCount: estimatedPages,
      hasTables: tableCount > 0,
      hasImages: imageCount > 0,
      tableCount,
      imageCount,
      extractedHtml: rawHtml,
      extractedText: rawText,
      metadata: {
        wordCount,
        warnings: htmlResult.messages,
      },
    };
  } catch (err: any) {
    console.error('Mammoth parsing error:', err);
    throw new Error(`فشل استخراج ملف Word بواسطة mammoth: ${err.message || err.toString()}`);
  }
}

/**
 * Parse PDF documents using pdf-lib
 * Reads original pages, dimensions, and metadata to maintain structure
 */
export async function parsePdfDocument(arrayBuffer: ArrayBuffer): Promise<ParsedDocumentStructure> {
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();
    const pageSizes = pages.map((page) => page.getSize());

    return {
      fileType: 'pdf',
      pageCount,
      hasTables: true,
      hasImages: true,
      tableCount: 0,
      imageCount: 0,
      extractedText: '', // Will be populated with text extractor or OCR
      pageSizes,
      metadata: {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        creator: pdfDoc.getCreator(),
      },
    };
  } catch (err: any) {
    console.error('pdf-lib parsing error:', err);
    throw new Error(`فشل قراءة ملف PDF بواسطة pdf-lib: ${err.message || err.toString()}`);
  }
}

/**
 * Reconstruct document HTML ensuring RTL compatibility for Arabic translations,
 * preserving original table layouts, images, and mathematical equations.
 */
export function reconstructDocumentHtml(
  contentHtmlOrText: string,
  targetLang: string,
  isDualMode: boolean = false,
  originalText?: string
): string {
  const isArabicOrRTL = isRtlLangCode(resolveLangCode(targetLang));

  const dir = isArabicOrRTL ? 'rtl' : 'ltr';
  const textAlign = isArabicOrRTL ? 'right' : 'left';
  const fontFamily = "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Check if content already contains HTML tags (e.g. from mammoth)
  const isHtml = /<[a-z][\s\S]*>/i.test(contentHtmlOrText);

  let formattedContent = '';
  if (isHtml) {
    // Inject styling into tables and images to ensure they match RTL and original layout
    formattedContent = contentHtmlOrText
      .replace(
        /<table/gi,
        '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-slate-300 dark:border-slate-700 text-xs sm:text-sm my-2 shadow-xs"'
      )
      .replace(/<\/table>/gi, '</table></div>')
      .replace(/<th/gi, `<th class="border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-2.5 font-bold text-${textAlign}"`)
      .replace(/<td/gi, `<td class="border border-slate-300 dark:border-slate-700 p-2 text-${textAlign}"`)
      .replace(/<img/gi, '<img class="max-w-full h-auto rounded-xl mx-auto my-3 shadow-md border border-slate-200 dark:border-slate-700"');
  } else {
    // Plain text or markdown - convert into styled semantic blocks
    const lines = contentHtmlOrText.split('\n');
    const parts: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = () => {
      if (tableRows.length > 0) {
        let tHtml = '<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-slate-300 dark:border-slate-700 text-xs sm:text-sm">';
        tableRows.forEach((row, idx) => {
          const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
          if (cells.length > 0) {
            const isHeader = idx === 0;
            const bgClass = isHeader
              ? 'bg-slate-100 dark:bg-slate-800 font-bold'
              : idx % 2 === 0
              ? 'bg-white dark:bg-slate-900'
              : 'bg-slate-50 dark:bg-slate-800/50';
            tHtml += `<tr class="${bgClass}">`;
            cells.forEach((cell) => {
              const tag = isHeader ? 'th' : 'td';
              tHtml += `<${tag} class="border border-slate-300 dark:border-slate-700 p-2 text-${textAlign}">${cell.trim()}</${tag}>`;
            });
            tHtml += '</tr>';
          }
        });
        tHtml += '</table></div>';
        parts.push(tHtml);
        tableRows = [];
      }
      inTable = false;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.replace(/[\|\-\:\s]/g, '').length === 0) continue;
        inTable = true;
        tableRows.push(line);
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (!line) {
        parts.push('<div class="h-2"></div>');
        continue;
      }

      if (line.startsWith('# ')) {
        parts.push(`<h1 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 border-b border-blue-500 pb-1">${line.slice(2)}</h1>`);
      } else if (line.startsWith('## ')) {
        parts.push(`<h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1.5">${line.slice(3)}</h2>`);
      } else if (line.startsWith('### ')) {
        parts.push(`<h3 class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-1">${line.slice(4)}</h3>`);
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        parts.push(`<li class="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-1 pr-2">${line.slice(2)}</li>`);
      } else if (/^\d+[\.\)]\s/.test(line)) {
        parts.push(`<div class="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-1 font-medium">${line}</div>`);
      } else {
        parts.push(`<p class="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-2">${line}</p>`);
      }
    }
    if (inTable) flushTable();
    formattedContent = parts.join('');
  }

  return `
    <div dir="${dir}" style="font-family: ${fontFamily}; text-align: ${textAlign};" class="document-reconstructed">
      ${formattedContent}
    </div>
  `;
}
