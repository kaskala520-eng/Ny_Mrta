import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { translateBatchClientSide, translateTextClientSide } from './clientTranslator';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(safe: string): string {
  return safe
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function getTranslatedFileName(originalName: string, targetLang: string): string {
  const dotIndex = originalName.lastIndexOf('.');
  const ext = dotIndex !== -1 ? originalName.slice(dotIndex) : '';
  const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName;

  let langLabel = 'Arabic';
  const cleanLang = targetLang.toLowerCase().trim();
  if (cleanLang === 'ar' || cleanLang.includes('عربي') || cleanLang.includes('arabic')) langLabel = 'Arabic';
  else if (cleanLang === 'en' || cleanLang.includes('english') || cleanLang.includes('إنجليز')) langLabel = 'English';
  else if (cleanLang === 'ku' || cleanLang.includes('kurd') || cleanLang.includes('كرد')) langLabel = 'Kurdish';
  else if (cleanLang === 'tr' || cleanLang.includes('türk') || cleanLang.includes('ترك')) langLabel = 'Turkish';
  else if (cleanLang === 'fr' || cleanLang.includes('franç') || cleanLang.includes('فرنس')) langLabel = 'French';
  else if (cleanLang === 'de' || cleanLang.includes('deutsch') || cleanLang.includes('ألمان')) langLabel = 'German';
  else if (cleanLang === 'es' || cleanLang.includes('españ') || cleanLang.includes('إسبان')) langLabel = 'Spanish';
  else if (cleanLang === 'fa' || cleanLang.includes('فارس') || cleanLang.includes('persian')) langLabel = 'Persian';
  else langLabel = targetLang.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_') || 'Translated';

  return `${baseName}-${langLabel}${ext}`;
}

export function isPureFormulaOrSymbol(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^[\d\s.,;:!?_+\-=/*^%&|~<>()\[\]{}#$@'"`\\°Ωµα-ωΑ-Ω]+$/.test(t)) return true;
  if (/^[a-zA-Z0-9_\s]{1,10}\s*=\s*[a-zA-Z0-9_\s.+\-*/^()]+$/.test(t)) return true;
  if (/^(sin|cos|tan|cot|sec|csc|log|log10|ln|exp|sqrt|abs|diff|int|plot|linspace)\s*\(.*\)$/i.test(t)) return true;
  if (/^\${1,2}[^$]+\${1,2}$/.test(t)) return true;
  if (/^\d+(\.\d+)?\s*(m\/s|km\/h|kg|g|mg|hz|khz|mhz|ghz|°c|k|ω|ohm|v|mv|kv|a|ma|w|kw|mw|j|kj|n|pa|kpa|bar|mol)$/i.test(t)) return true;
  if (/^([a-zA-Z]|theta|alpha|beta|gamma|lambda|omega|pi|mu|phi|rho|sigma|tau)(\s*[\^_]\s*[a-zA-Z0-9]+)?$/i.test(t)) return true;
  return false;
}

/**
 * Batch translate an array of strings 100% client-side via LibreTranslate -> MyMemory
 */
export async function translateBatchSentences(
  items: string[],
  targetLang: string = 'العربية',
  _unusedKey?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<string[]> {
  return translateBatchClientSide(items, targetLang, onProgress);
}

/**
 * Translate DOCX in-place via JSZip while preserving tables (<w:tbl>), images (<w:drawing>), & styles (<w:pPr>)
 */
export async function translateDocxExact(
  fileBuffer: ArrayBuffer,
  originalFileName: string,
  targetLang: string,
  onStatus?: (status: string) => void
): Promise<{ blob: Blob; fileName: string; translatedCount: number }> {
  onStatus?.('JSZip: فحص وفك ضغط مستند Word الأصلي...');
  const zip = await JSZip.loadAsync(fileBuffer.slice(0));
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('الملف ليس مستند DOCX صالحاً (word/document.xml غير موجود).');
  }

  const docXml = await docXmlFile.async('text');
  const wtRegex = /(<w:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;
  const matches: Array<{ full: string; openTag: string; text: string; closeTag: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = wtRegex.exec(docXml)) !== null) {
    matches.push({
      full: match[0],
      openTag: match[1],
      text: match[2],
      closeTag: match[3],
      index: match.index,
    });
  }

  const textsToTranslate: string[] = [];
  const indexMap: number[] = [];

  for (let i = 0; i < matches.length; i++) {
    const rawText = unescapeXml(matches[i].text);
    if (rawText.trim().length > 0 && !isPureFormulaOrSymbol(rawText)) {
      textsToTranslate.push(rawText);
      indexMap.push(i);
    }
  }

  onStatus?.(`LibreTranslate/MyMemory: ترجمة ${textsToTranslate.length} عنصر نصي مع حفظ الجداول والصور...`);

  const translatedSegments = await translateBatchClientSide(
    textsToTranslate,
    targetLang,
    (proc, tot) => onStatus?.(`ترجمة مستند Word: ${proc} من ${tot} عنصر...`)
  );

  for (let k = 0; k < indexMap.length; k++) {
    const matchIdx = indexMap[k];
    const transText = translatedSegments[k] || textsToTranslate[k];
    matches[matchIdx].text = escapeXml(transText);
  }

  let modifiedDocXml = '';
  let lastIndex = 0;
  for (const m of matches) {
    modifiedDocXml += docXml.slice(lastIndex, m.index);
    modifiedDocXml += `${m.openTag}${m.text}${m.closeTag}`;
    lastIndex = m.index + m.full.length;
  }
  modifiedDocXml += docXml.slice(lastIndex);

  zip.file('word/document.xml', modifiedDocXml);

  const outputBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return {
    blob: outputBlob,
    fileName: getTranslatedFileName(originalFileName, targetLang),
    translatedCount: textsToTranslate.length,
  };
}

/**
 * Translate XLSX in-place via JSZip while preserving sheets, formulas, styles & column widths
 */
export async function translateXlsxExact(
  fileBuffer: ArrayBuffer,
  originalFileName: string,
  targetLang: string,
  onStatus?: (status: string) => void
): Promise<{ blob: Blob; fileName: string; translatedCount: number }> {
  onStatus?.('JSZip: فحص مصنف Excel وحفظ التنسيقات والأعمدة...');
  const zip = await JSZip.loadAsync(fileBuffer.slice(0));
  let totalTranslated = 0;

  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (sharedStringsFile) {
    const sstXml = await sharedStringsFile.async('text');
    const tRegex = /(<t(?:\s+[^>]*)?>)([\s\S]*?)(<\/t>)/g;
    const matches: Array<{ full: string; openTag: string; text: string; closeTag: string; index: number }> = [];

    let m: RegExpExecArray | null;
    while ((m = tRegex.exec(sstXml)) !== null) {
      matches.push({
        full: m[0],
        openTag: m[1],
        text: m[2],
        closeTag: m[3],
        index: m.index,
      });
    }

    const textsToTranslate: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < matches.length; i++) {
      const rawText = unescapeXml(matches[i].text);
      if (rawText.trim().length > 0 && !isPureFormulaOrSymbol(rawText)) {
        textsToTranslate.push(rawText);
        indexMap.push(i);
      }
    }

    if (textsToTranslate.length > 0) {
      onStatus?.(`LibreTranslate/MyMemory: ترجمة ${textsToTranslate.length} خلية نصية في Excel...`);
      const translated = await translateBatchClientSide(textsToTranslate, targetLang, (p, t) =>
        onStatus?.(`ترجمة Excel: ${p} من ${t} خلية...`)
      );

      for (let k = 0; k < indexMap.length; k++) {
        const matchIdx = indexMap[k];
        matches[matchIdx].text = escapeXml(translated[k] || textsToTranslate[k]);
      }

      let modifiedSstXml = '';
      let lastIdx = 0;
      for (const item of matches) {
        modifiedSstXml += sstXml.slice(lastIdx, item.index);
        modifiedSstXml += `${item.openTag}${item.text}${item.closeTag}`;
        lastIdx = item.index + item.full.length;
      }
      modifiedSstXml += sstXml.slice(lastIdx);

      zip.file('xl/sharedStrings.xml', modifiedSstXml);
      totalTranslated += textsToTranslate.length;
    }
  }

  const outputBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob: outputBlob,
    fileName: getTranslatedFileName(originalFileName, targetLang),
    translatedCount: totalTranslated,
  };
}

/**
 * Translate PPTX in-place via JSZip while preserving slides, shapes, images & design
 */
export async function translatePptxExact(
  fileBuffer: ArrayBuffer,
  originalFileName: string,
  targetLang: string,
  onStatus?: (status: string) => void
): Promise<{ blob: Blob; fileName: string; translatedCount: number }> {
  onStatus?.('JSZip: فحص شرائح PowerPoint...');
  const zip = await JSZip.loadAsync(fileBuffer.slice(0));
  const slideFiles = zip.file(/^ppt\/slides\/slide\d+\.xml$/);

  if (slideFiles.length === 0) {
    throw new Error('الملف ليس عرض PowerPoint صالحاً أو لا يحتوي على شرائح.');
  }

  let totalTranslated = 0;

  for (let s = 0; s < slideFiles.length; s++) {
    const slideFile = slideFiles[s];
    const slideXml = await slideFile.async('text');
    const atRegex = /(<a:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/a:t>)/g;
    const matches: Array<{ full: string; openTag: string; text: string; closeTag: string; index: number }> = [];

    let m: RegExpExecArray | null;
    while ((m = atRegex.exec(slideXml)) !== null) {
      matches.push({
        full: m[0],
        openTag: m[1],
        text: m[2],
        closeTag: m[3],
        index: m.index,
      });
    }

    const textsToTranslate: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < matches.length; i++) {
      const rawText = unescapeXml(matches[i].text);
      if (rawText.trim().length > 0 && !isPureFormulaOrSymbol(rawText)) {
        textsToTranslate.push(rawText);
        indexMap.push(i);
      }
    }

    if (textsToTranslate.length > 0) {
      onStatus?.(`ترجمة شريحة ${s + 1} من ${slideFiles.length}...`);
      const translated = await translateBatchClientSide(textsToTranslate, targetLang);

      for (let k = 0; k < indexMap.length; k++) {
        const matchIdx = indexMap[k];
        matches[matchIdx].text = escapeXml(translated[k] || textsToTranslate[k]);
      }

      let modifiedSlideXml = '';
      let lastIdx = 0;
      for (const item of matches) {
        modifiedSlideXml += slideXml.slice(lastIdx, item.index);
        modifiedSlideXml += `${item.openTag}${item.text}${item.closeTag}`;
        lastIdx = item.index + item.full.length;
      }
      modifiedSlideXml += slideXml.slice(lastIdx);

      zip.file(slideFile.name, modifiedSlideXml);
      totalTranslated += textsToTranslate.length;
    }
  }

  const outputBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  return {
    blob: outputBlob,
    fileName: getTranslatedFileName(originalFileName, targetLang),
    translatedCount: totalTranslated,
  };
}

/**
 * Translate PDF text and render a genuine translated multi-page PDF Blob via html2canvas + jsPDF
 */
export async function translatePdfExact(
  originalFileName: string,
  targetLang: string,
  sourceExtractedText: string,
  onStatus?: (status: string) => void
): Promise<{ blob: Blob; fileName: string; translatedText: string }> {
  onStatus?.('جاري ترجمة نصوص ملف PDF عبر LibreTranslate / MyMemory...');
  const { translatedText } = await translateTextClientSide(
    sourceExtractedText,
    targetLang,
    'auto',
    (p) => onStatus?.(p.status)
  );

  const isRTL = /عرب|arabic|kurd|كرد|فارس|persian/i.test(targetLang);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '36px 44px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', Arial, sans-serif";
  container.style.direction = isRTL ? 'rtl' : 'ltr';
  container.style.textAlign = isRTL ? 'right' : 'left';
  container.innerHTML = `
    <div style="border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:16px;">
      <div style="font-size:16px;font-weight:800;color:#1e3a8a;">${escapeXml(originalFileName)} (${escapeXml(targetLang)})</div>
    </div>
    <div style="font-size:12px;line-height:1.85;white-space:pre-wrap;">${escapeXml(translatedText)}</div>
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

    const outputBlob = pdf.output('blob');
    return {
      blob: outputBlob,
      fileName: getTranslatedFileName(originalFileName, targetLang),
      translatedText,
    };
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
}

export async function translateExactDocument(
  file: File,
  targetLang: string,
  sourceText?: string,
  onStatus?: (status: string) => void
): Promise<{ blob: Blob; fileName: string; translatedCount?: number; pageCount?: number; fileType: string }> {
  const lowerName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (lowerName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    const res = await translateDocxExact(arrayBuffer, file.name, targetLang, onStatus);
    return { ...res, fileType: 'docx' };
  } else if (lowerName.endsWith('.xlsx') || file.type.includes('spreadsheetml')) {
    const res = await translateXlsxExact(arrayBuffer, file.name, targetLang, onStatus);
    return { ...res, fileType: 'xlsx' };
  } else if (lowerName.endsWith('.pptx') || file.type.includes('presentationml')) {
    const res = await translatePptxExact(arrayBuffer, file.name, targetLang, onStatus);
    return { ...res, fileType: 'pptx' };
  } else if (lowerName.endsWith('.pdf') || file.type.includes('pdf')) {
    const res = await translatePdfExact(file.name, targetLang, sourceText || '', onStatus);
    return { blob: res.blob, fileName: res.fileName, fileType: 'pdf' };
  } else {
    throw new Error(`صيغة الملف (${file.name}) غير مدعومة للترجمة الهيكلية المباشرة.`);
  }
}

export function triggerFileDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
