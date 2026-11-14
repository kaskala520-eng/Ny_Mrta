import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { WORLD_LANGUAGES, isRtlLangCode, resolveLangCode } from './clientTranslator';

export interface PDFExportOptions {
  title: string;
  content: string;
  originalFileName?: string;
  targetLang?: string;
  sourceText?: string;
  mode?: 'single' | 'dual';
}

/**
 * Generate standard compliant filename e.g. "report-Arabic.pdf"
 */
export function generatePDFFileName(originalFileName?: string, targetLang: string = 'العربية'): string {
  const code = resolveLangCode(targetLang);
  const langMatch = WORLD_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  const langLabel =
    code === 'ar'
      ? 'Arabic'
      : code === 'en'
      ? 'English'
      : code === 'ku'
      ? 'Kurdish'
      : code === 'fr'
      ? 'French'
      : code === 'tr'
      ? 'Turkish'
      : code === 'de'
      ? 'German'
      : code === 'es'
      ? 'Spanish'
      : code === 'fa'
      ? 'Persian'
      : langMatch?.nativeName.replace(/[^a-zA-Z0-9]/g, '') ||
        code.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_').slice(0, 15) ||
        'Translated';

  if (!originalFileName) {
    return `translated-document-${langLabel}.pdf`;
  }

  // Strip file extension (.pdf, .docx, .png, etc.)
  const baseName = originalFileName.replace(/\.[^/.]+$/, '').trim() || 'document';
  // Sanitize for filename safety
  const safeBaseName = baseName.replace(/[\\/:*?"<>|]/g, '_');
  return `${safeBaseName}-${langLabel}.pdf`;
}

/**
 * Parse plain text with potential markdown tables or equations into semantic HTML
 */
function formatContentToHTML(text: string, isRTL: boolean): string {
  if (!text) return '<p>(لا يوجد محتوى)</p>';

  const lines = text.split('\n');
  const htmlParts: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      let tableHtml = '<div style="margin: 14px 0; overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px; margin-bottom: 8px;">';
      tableRows.forEach((row, idx) => {
        const cells = row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (cells.length > 0) {
          const isHeader = idx === 0;
          const bg = isHeader ? '#f1f5f9' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          const weight = isHeader ? '700' : '400';
          tableHtml += `<tr style="background-color: ${bg};">`;
          cells.forEach((cell) => {
            const tag = isHeader ? 'th' : 'td';
            tableHtml += `<${tag} style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: ${isRTL ? 'right' : 'left'}; font-weight: ${weight};">${cell.trim()}</${tag}>`;
          });
          tableHtml += '</tr>';
        }
      });
      tableHtml += '</table></div>';
      htmlParts.push(tableHtml);
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for markdown table row
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator row |---|---|
      if (line.replace(/[\|\-\:\s]/g, '').length === 0) {
        continue;
      }
      inTable = true;
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!line) {
      htmlParts.push('<div style="height: 10px;"></div>');
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      htmlParts.push(`<h1 style="font-size: 18px; font-weight: bold; color: #0f172a; margin: 16px 0 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      htmlParts.push(`<h2 style="font-size: 15px; font-weight: bold; color: #1e293b; margin: 14px 0 6px;">${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      htmlParts.push(`<h3 style="font-size: 13px; font-weight: 600; color: #334155; margin: 12px 0 4px;">${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      htmlParts.push(`<li style="font-size: 12px; line-height: 1.8; color: #1e293b; margin-bottom: 4px; padding-${isRTL ? 'right' : 'left'}: 6px;">${escapeHtml(line.slice(2))}</li>`);
    } else if (/^\d+[\.\)]\s/.test(line)) {
      htmlParts.push(`<div style="font-size: 12px; line-height: 1.8; color: #1e293b; margin-bottom: 4px; font-weight: 500;">${escapeHtml(line)}</div>`);
    } else {
      // Paragraph with line break
      htmlParts.push(`<p style="font-size: 12px; line-height: 1.8; color: #1e293b; margin: 0 0 8px;">${escapeHtml(line)}</p>`);
    }
  }

  if (inTable) {
    flushTable();
  }

  return htmlParts.join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Export translated document as a pixel-perfect, professionally formatted PDF
 */
export async function exportAsPDF(options: PDFExportOptions): Promise<void> {
  const {
    title,
    content,
    originalFileName,
    targetLang = 'العربية',
    sourceText,
    mode = 'single',
  } = options;

  const isRTL = isRtlLangCode(resolveLangCode(targetLang));
  const fileName = generatePDFFileName(originalFileName, targetLang);

  // 1. Create a dedicated off-screen rendering element with precise A4 dimensions (794px width = standard A4 @ 96dpi)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '40px 48px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  container.style.direction = isRTL ? 'rtl' : 'ltr';
  container.style.textAlign = isRTL ? 'right' : 'left';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-1000';

  const exportDate = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Header template
  const headerHtml = `
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; direction: ${isRTL ? 'rtl' : 'ltr'};">
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
          ${escapeHtml(title || 'مستند مترجم')}
        </div>
        <div style="font-size: 11px; color: #64748b; display: flex; gap: 12px; align-items: center;">
          <span><strong>الملف الأصلي:</strong> ${escapeHtml(originalFileName || 'مستند نصي')}</span>
          <span>•</span>
          <span><strong>اللغة المستهدفة:</strong> ${escapeHtml(targetLang)}</span>
          <span>•</span>
          <span><strong>التاريخ:</strong> ${exportDate}</span>
        </div>
      </div>
      <div style="text-align: ${isRTL ? 'left' : 'right'};">
        <div style="font-size: 13px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px;">Meta.Ny AI</div>
        <div style="font-size: 9px; color: #94a3b8;">منصة الترجمة الأكاديمية الذكية</div>
      </div>
    </div>
  `;

  // Dual mode or Single mode content
  let bodyHtml = '';
  if (mode === 'dual' && sourceText) {
    bodyHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; font-weight: bold; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
            النص الأصلي (Source)
          </div>
          <div style="font-size: 11px; line-height: 1.7; color: #334155; white-space: pre-wrap; direction: ltr; text-align: left;">
            ${escapeHtml(sourceText)}
          </div>
        </div>
        <div style="background-color: #ffffff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; font-weight: bold; color: #1d4ed8; margin-bottom: 10px; border-bottom: 1px solid #bfdbfe; padding-bottom: 6px;">
            الترجمة المعتمدة (${escapeHtml(targetLang)})
          </div>
          <div>
            ${formatContentToHTML(content, isRTL)}
          </div>
        </div>
      </div>
    `;
  } else {
    bodyHtml = `
      <div style="min-height: 400px;">
        ${formatContentToHTML(content, isRTL)}
      </div>
    `;
  }

  // Footer template
  const footerHtml = `
    <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; direction: ${isRTL ? 'rtl' : 'ltr'};">
      <div>تمت الترجمة والتنسيق بواسطة محرك Meta.Ny الذكي بدقة أكاديمية عالية</div>
      <div>https://metany.ai</div>
    </div>
  `;

  container.innerHTML = headerHtml + bodyHtml + footerHtml;
  document.body.appendChild(container);

  try {
    // 2. Render container to high-res canvas (scale 2 gives retina 192dpi crisp text)
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    // 3. Construct multi-page A4 PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210; // A4 mm
    const pageHeight = 297; // A4 mm
    const margin = 10;
    const printWidth = pageWidth - margin * 2;
    const printHeight = pageHeight - margin * 2;

    const imgWidth = printWidth;
    const imgHeight = (canvas.height * printWidth) / canvas.width;

    // Calculate how many pages are required
    let heightLeft = imgHeight;
    let position = margin;

    // First page
    pdf.addImage(canvas, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= printHeight;

    // Additional pages if content overflows A4 height
    while (heightLeft > 0) {
      position = position - printHeight;
      pdf.addPage();
      pdf.addImage(canvas, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printHeight;
    }

    // 4. Trigger download with the exact naming: [originalFileName]-[targetLang].pdf
    pdf.save(fileName);
  } finally {
    // Cleanup DOM node
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
