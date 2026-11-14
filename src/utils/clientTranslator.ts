import { isPureFormulaOrSymbol } from './exactDocumentTranslator';

export type ClientTranslationEngine = 'libretranslate' | 'google_gtx' | 'mymemory' | 'mixed';

export interface ClientTranslationProgress {
  percent: number;
  status: string;
  engine?: ClientTranslationEngine;
}

export interface WorldLanguageOption {
  code: string;
  labelAr: string;
  nativeName: string;
  rtl?: boolean;
}

export const WORLD_LANGUAGES: WorldLanguageOption[] = [
  { code: 'ar', labelAr: 'العربية', nativeName: 'العربية', rtl: true },
  { code: 'en', labelAr: 'الإنجليزية', nativeName: 'English' },
  { code: 'fr', labelAr: 'الفرنسية', nativeName: 'Français' },
  { code: 'it', labelAr: 'الإيطالية', nativeName: 'Italiano' },
  { code: 'zh-CN', labelAr: 'الصينية', nativeName: '中文 (简体)' },
  { code: 'de', labelAr: 'الألمانية', nativeName: 'Deutsch' },
  { code: 'ru', labelAr: 'الروسية', nativeName: 'Русский' },
  { code: 'ja', labelAr: 'اليابانية', nativeName: '日本語' },
  { code: 'ko', labelAr: 'الكورية', nativeName: '한국어' },
  { code: 'hi', labelAr: 'الهندية', nativeName: 'हिन्दी' },
  { code: 'el', labelAr: 'اليونانية', nativeName: 'Ελληνικά' },
  { code: 'es', labelAr: 'الإسبانية', nativeName: 'Español' },
  { code: 'pt', labelAr: 'البرتغالية', nativeName: 'Português' },
  { code: 'tr', labelAr: 'التركية', nativeName: 'Türkçe' },
  { code: 'fa', labelAr: 'الفارسية', nativeName: 'فارسی', rtl: true },
  { code: 'ku', labelAr: 'الكردية', nativeName: 'کوردی', rtl: true },
  { code: 'ur', labelAr: 'الأردية', nativeName: 'اردو', rtl: true },
  { code: 'nl', labelAr: 'الهولندية', nativeName: 'Nederlands' },
  { code: 'pl', labelAr: 'البولندية', nativeName: 'Polski' },
  { code: 'sv', labelAr: 'السويدية', nativeName: 'Svenska' },
  { code: 'no', labelAr: 'النرويجية', nativeName: 'Norsk' },
  { code: 'da', labelAr: 'الدنماركية', nativeName: 'Dansk' },
  { code: 'fi', labelAr: 'الفنلندية', nativeName: 'Suomi' },
  { code: 'uk', labelAr: 'الأوكرانية', nativeName: 'Українська' },
  { code: 'cs', labelAr: 'التشيكية', nativeName: 'Čeština' },
  { code: 'ro', labelAr: 'الرومانية', nativeName: 'Română' },
  { code: 'hu', labelAr: 'المجرية', nativeName: 'Magyar' },
  { code: 'id', labelAr: 'الإندونيسية', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', labelAr: 'الملايوية', nativeName: 'Bahasa Melayu' },
  { code: 'th', labelAr: 'التايلاندية', nativeName: 'ไทย' },
  { code: 'vi', labelAr: 'الفيتنامية', nativeName: 'Tiếng Việt' },
  { code: 'bn', labelAr: 'البنغالية', nativeName: 'বাংলা' },
  { code: 'he', labelAr: 'العبرية', nativeName: 'עברית', rtl: true },
  { code: 'sw', labelAr: 'السواحيلية', nativeName: 'Kiswahili' },
  { code: 'az', labelAr: 'الأذربيجانية', nativeName: 'Azərbaycan' },
  { code: 'ka', labelAr: 'الجورجية', nativeName: 'ქართული' },
  { code: 'hy', labelAr: 'الأرمينية', nativeName: 'Հայերեն' },
  { code: 'bg', labelAr: 'البلغارية', nativeName: 'Български' },
  { code: 'sr', labelAr: 'الصربية', nativeName: 'Српски' },
  { code: 'hr', labelAr: 'الكرواتية', nativeName: 'Hrvatski' },
  { code: 'sk', labelAr: 'السلوفاكية', nativeName: 'Slovenčina' },
  { code: 'ca', labelAr: 'الكتالونية', nativeName: 'Català' },
  { code: 'tl', labelAr: 'الفلبينية', nativeName: 'Filipino' },
  { code: 'am', labelAr: 'الأمهرية', nativeName: 'አማርኛ' },
  { code: 'ha', labelAr: 'الهوسا', nativeName: 'Hausa' },
  { code: 'so', labelAr: 'الصومالية', nativeName: 'Soomaali' },
];

const LANG_CODE_MAP: Array<{ match: string[]; code: string }> = [
  { match: ['عربي', 'العربية', 'arabic', 'ar'], code: 'ar' },
  { match: ['english', 'إنجليز', 'انجليز', 'en'], code: 'en' },
  { match: ['français', 'francais', 'french', 'فرنس', 'fr'], code: 'fr' },
  { match: ['italiano', 'italian', 'إيطال', 'ايطال', 'it'], code: 'it' },
  { match: ['中文', 'chinese', 'صين', 'الصينية', 'zh-cn', 'zh'], code: 'zh-CN' },
  { match: ['deutsch', 'german', 'ألمان', 'المان', 'de'], code: 'de' },
  { match: ['русский', 'russian', 'روس', 'الروسية', 'ru'], code: 'ru' },
  { match: ['日本語', 'japanese', 'يابان', 'اليابانية', 'ja'], code: 'ja' },
  { match: ['한국어', 'korean', 'كور', 'الكورية', 'ko'], code: 'ko' },
  { match: ['हिन्दी', 'hindi', 'هند', 'الهندية', 'hi'], code: 'hi' },
  { match: ['ελληνικά', 'greek', 'يونان', 'اليونانية', 'el'], code: 'el' },
  { match: ['español', 'espanol', 'spanish', 'إسبان', 'اسبان', 'es'], code: 'es' },
  { match: ['português', 'portugues', 'portuguese', 'برتغال', 'pt'], code: 'pt' },
  { match: ['türkçe', 'turkce', 'turkish', 'ترك', 'tr'], code: 'tr' },
  { match: ['فارسی', 'persian', 'فارس', 'fa'], code: 'fa' },
  { match: ['کوردی', 'kurd', 'كرد', 'ku'], code: 'ku' },
  { match: ['اردو', 'urdu', 'أرد', 'اردو', 'ur'], code: 'ur' },
  { match: ['nederlands', 'dutch', 'هولند', 'nl'], code: 'nl' },
  { match: ['polski', 'polish', 'بولند', 'pl'], code: 'pl' },
  { match: ['svenska', 'swedish', 'سويد', 'sv'], code: 'sv' },
  { match: ['norsk', 'norwegian', 'نرويج', 'no'], code: 'no' },
  { match: ['dansk', 'danish', 'دنمارك', 'da'], code: 'da' },
  { match: ['suomi', 'finnish', 'فنلند', 'fi'], code: 'fi' },
  { match: ['українська', 'ukrainian', 'أوكران', 'اوكران', 'uk'], code: 'uk' },
  { match: ['čeština', 'czech', 'تشيك', 'cs'], code: 'cs' },
  { match: ['română', 'romanian', 'رومان', 'ro'], code: 'ro' },
  { match: ['magyar', 'hungarian', 'مجر', 'hu'], code: 'hu' },
  { match: ['indonesia', 'indonesian', 'إندونيس', 'اندونيس', 'id'], code: 'id' },
  { match: ['melayu', 'malay', 'ملاي', 'ms'], code: 'ms' },
  { match: ['ไทย', 'thai', 'تايلاند', 'th'], code: 'th' },
  { match: ['tiếng việt', 'vietnamese', 'فيتنام', 'vi'], code: 'vi' },
  { match: ['বাংলা', 'bengali', 'بنغال', 'bn'], code: 'bn' },
  { match: ['עברית', 'hebrew', 'عبر', 'he'], code: 'he' },
  { match: ['kiswahili', 'swahili', 'سواحيل', 'sw'], code: 'sw' },
  { match: ['azərbaycan', 'azerbaijani', 'أذربيجان', 'az'], code: 'az' },
  { match: ['ქართული', 'georgian', 'جورج', 'ka'], code: 'ka' },
  { match: ['հայերեն', 'armenian', 'أرمن', 'hy'], code: 'hy' },
  { match: ['български', 'bulgarian', 'بلغار', 'bg'], code: 'bg' },
  { match: ['српски', 'serbian', 'صرب', 'sr'], code: 'sr' },
  { match: ['hrvatski', 'croatian', 'كروات', 'hr'], code: 'hr' },
  { match: ['slovenčina', 'slovak', 'سلوفاك', 'sk'], code: 'sk' },
  { match: ['català', 'catalan', 'كتالون', 'ca'], code: 'ca' },
  { match: ['filipino', 'tagalog', 'فلبين', 'tl'], code: 'tl' },
  { match: ['አማርኛ', 'amharic', 'أمهري', 'am'], code: 'am' },
  { match: ['hausa', 'هوسا', 'ha'], code: 'ha' },
  { match: ['soomaali', 'somali', 'صومال', 'so'], code: 'so' },
];

export function isRtlLangCode(code: string): boolean {
  const c = (code || '').toLowerCase();
  return c === 'ar' || c === 'fa' || c === 'ku' || c === 'ur' || c === 'he' || c === 'ps' || c === 'sd';
}

export function resolveLangCode(labelOrCode: string): string {
  const clean = (labelOrCode || '').trim().toLowerCase();
  if (!clean || clean === 'auto' || clean.includes('تلقائي')) return 'auto';
  if (clean === 'zh' || clean === 'zh-cn') return 'zh-CN';
  if (clean === 'zh-tw') return 'zh-TW';
  // Exact code match first
  for (const item of LANG_CODE_MAP) {
    if (item.code.toLowerCase() === clean || item.match.some((m) => clean === m)) {
      return item.code;
    }
  }
  // Substring match
  for (const item of LANG_CODE_MAP) {
    if (item.match.some((m) => m.length > 2 && clean.includes(m))) {
      return item.code;
    }
  }
  // Direct ISO 639-1 / BCP-47 fallback (supports ALL world languages via ISO codes)
  if (/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(clean)) {
    return clean;
  }
  return clean.slice(0, 2) || 'en';
}

/**
 * Lightweight Unicode script & keyword detector for client-side source language identification
 * (MyMemory API requires an explicit source code instead of 'auto').
 */
export function detectLanguageCode(text: string): string {
  const sample = (text || '').slice(0, 1200);
  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const hanChars = (sample.match(/[\u4E00-\u9FFF]/g) || []).length;
  const kanaChars = (sample.match(/[\u3040-\u30FF]/g) || []).length;
  const hangulChars = (sample.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const greekChars = (sample.match(/[\u0370-\u03FF]/g) || []).length;
  const devanagariChars = (sample.match(/[\u0900-\u097F]/g) || []).length;
  const bengaliChars = (sample.match(/[\u0980-\u09FF]/g) || []).length;
  const thaiChars = (sample.match(/[\u0E00-\u0E7F]/g) || []).length;
  const hebrewChars = (sample.match(/[\u0590-\u05FF]/g) || []).length;
  const latinChars = (sample.match(/[A-Za-z]/g) || []).length;

  if (kanaChars > 2 || (hanChars > 2 && kanaChars > 0)) return 'ja';
  if (hanChars > 3 && hanChars >= latinChars) return 'zh-CN';
  if (hangulChars > 3) return 'ko';
  if (greekChars > 3) return 'el';
  if (devanagariChars > 3) return 'hi';
  if (bengaliChars > 3) return 'bn';
  if (thaiChars > 3) return 'th';
  if (hebrewChars > 3) return 'he';
  if (cyrillicChars > 3 && cyrillicChars >= latinChars) {
    if (/[іїєґІЇЄҐ]/.test(sample)) return 'uk';
    return 'ru';
  }

  if (arabicChars > latinChars && arabicChars > 2) {
    if (/[ڤڵڕێۆە]/.test(sample)) return 'ku';
    if (/[ٹڈڑںےھ]/.test(sample)) return 'ur';
    if (/[پچژگ]/.test(sample)) return 'fa';
    return 'ar';
  }

  if (/[ğüşöçıĞÜŞÖÇİ]/.test(sample)) return 'tr';
  if (/[ăâđêôơư]/i.test(sample) && /[àáảãạằắẳẵặ]/i.test(sample)) return 'vi';
  if (/[äöüßÄÖÜ]/.test(sample) || /\b(und|der|die|das|ist|nicht|mit|ein|eine)\b/i.test(sample)) return 'de';
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(sample)) return 'pl';
  if (/[ñ¿¡]/.test(sample) || /\b(los|las|para|con|una|por|que|son|del)\b/i.test(sample)) return 'es';
  if (/[ãõ]/i.test(sample) || /\b(não|para|com|uma|dos|das|são)\b/i.test(sample)) return 'pt';
  if (/\b(che|non|per|con|una|sono|della|degli|più|anche|questa)\b/i.test(sample)) return 'it';
  if (/[àâçéèêëîïôùûüÿœ]/i.test(sample) || /\b(les|des|est|avec|pour|dans|une|sont)\b/i.test(sample)) return 'fr';
  if (/\b(het|een|van|voor|met|zijn|niet|deze)\b/i.test(sample)) return 'nl';

  return 'en';
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

/**
 * Split a long string into chunks <= maxLen characters preserving sentence / line boundaries.
 */
function splitIntoChunks(text: string, maxLen: number = 420): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/(\n+)/);
  let current = '';

  for (const part of paragraphs) {
    if (!part) continue;
    if (current.length + part.length <= maxLen) {
      current += part;
      continue;
    }
    if (current.trim()) {
      chunks.push(current);
      current = '';
    }
    if (part.length <= maxLen) {
      current = part;
      continue;
    }
    // Split long paragraph by sentence punctuation (supports Latin, Arabic & CJK)
    const sentences = part.split(/(?<=[.!?؟،;。！？])\s*|(?<=[.!?؟])\s+/);
    for (const s of sentences) {
      if ((current + (current ? ' ' : '') + s).length <= maxLen) {
        current += (current ? ' ' : '') + s;
      } else {
        if (current) chunks.push(current);
        if (s.length <= maxLen) {
          current = s;
        } else {
          // Hard word / character split
          const words = s.includes(' ') ? s.split(/\s+/) : s.match(/.{1,120}/g) || [s];
          let wBuf = '';
          for (const w of words) {
            if ((wBuf + ' ' + w).length <= maxLen) {
              wBuf += (wBuf ? ' ' : '') + w;
            } else {
              if (wBuf) chunks.push(wBuf);
              wBuf = w.slice(0, maxLen);
            }
          }
          current = wBuf;
        }
      }
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

const sessionTranslationCache = new Map<string, string>();
let libreTranslateBlockedForSession = false;

export function clearTranslationCache(): void {
  sessionTranslationCache.clear();
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Attempt LibreTranslate API (https://libretranslate.com/translate)
 */
async function translateViaLibreTranslate(
  text: string,
  sourceCode: string,
  targetCode: string
): Promise<string> {
  const res = await fetchWithTimeout(
    'https://libretranslate.com/translate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceCode || 'auto',
        target: targetCode,
        format: 'text',
      }),
    },
    2500
  );

  if (!res.ok) {
    throw new Error(`LibreTranslate HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data && typeof data.translatedText === 'string' && data.translatedText.trim()) {
    return data.translatedText;
  }
  throw new Error(data?.error || 'LibreTranslate invalid response');
}

/**
 * Public Google Translate GTX client endpoint (no API key, CORS enabled, fast Arabic/world support)
 */
async function translateViaGoogleGtx(
  text: string,
  sourceCode: string,
  targetCode: string
): Promise<string> {
  const sl = !sourceCode || sourceCode === 'auto' ? 'auto' : sourceCode;
  const tl = targetCode === 'zh' ? 'zh-CN' : targetCode;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sl
  )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
  if (!res.ok) {
    throw new Error(`Google GTX HTTP ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const joined = data[0]
      .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('');
    if (joined.trim()) {
      return decodeHtmlEntities(joined);
    }
  }
  throw new Error('Google GTX returned empty translation');
}

/**
 * Fallback to MyMemory Free API (https://api.mymemory.translated.net/get)
 */
async function translateViaMyMemory(
  text: string,
  sourceCode: string,
  targetCode: string
): Promise<string> {
  const resolvedSource =
    !sourceCode || sourceCode === 'auto' ? detectLanguageCode(text) : sourceCode;

  if (resolvedSource === targetCode) {
    return text;
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=${encodeURIComponent(`${resolvedSource}|${targetCode}`)}`;

  const res = await fetchWithTimeout(url, { method: 'GET' }, 9000);
  if (!res.ok) {
    throw new Error(`MyMemory HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data?.responseStatus && Number(data.responseStatus) >= 400) {
    throw new Error(data.responseDetails || `MyMemory error ${data.responseStatus}`);
  }
  const translated = data?.responseData?.translatedText;
  if (typeof translated === 'string' && translated.trim()) {
    const upper = translated.toUpperCase();
    if (
      upper.includes('MYMEMORY WARNING') ||
      upper.includes('PLEASE SELECT TWO DISTINCT LANGUAGES') ||
      upper.includes('QUERY LENGTH LIMIT EXCEEDED') ||
      upper.includes('INVALID LANGUAGE PAIR')
    ) {
      throw new Error(translated);
    }
    return decodeHtmlEntities(translated);
  }
  throw new Error('MyMemory returned empty translation');
}

async function translateSegment(
  segment: string,
  sourceCode: string,
  targetCode: string
): Promise<{ text: string; engine: 'libretranslate' | 'google_gtx' | 'mymemory' }> {
  const trimmed = segment.trim();
  if (!trimmed || isPureFormulaOrSymbol(trimmed)) {
    return { text: segment, engine: 'google_gtx' };
  }

  const effectiveSource =
    sourceCode === 'auto' ? detectLanguageCode(trimmed) : sourceCode;
  if (effectiveSource === targetCode) {
    return { text: segment, engine: 'google_gtx' };
  }

  const cacheKey = `${effectiveSource}|${targetCode}|${trimmed}`;
  const cached = sessionTranslationCache.get(cacheKey);
  if (cached) {
    return { text: cached, engine: 'google_gtx' };
  }

  // Preserve leading/trailing whitespace
  const leading = segment.match(/^\s*/)?.[0] || '';
  const trailing = segment.match(/\s*$/)?.[0] || '';

  // 1. Try LibreTranslate first unless already blocked/requiring key this session
  if (!libreTranslateBlockedForSession) {
    try {
      const ltResult = await translateViaLibreTranslate(
        trimmed,
        sourceCode === 'auto' ? 'auto' : effectiveSource,
        targetCode
      );
      const formatted = `${leading}${ltResult}${trailing}`;
      sessionTranslationCache.set(cacheKey, formatted);
      return { text: formatted, engine: 'libretranslate' };
    } catch {
      libreTranslateBlockedForSession = true;
    }
  }

  // 2. Try Google GTX (with 1 quick retry on transient rate-limit/network glitch)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const gtxResult = await translateViaGoogleGtx(trimmed, effectiveSource, targetCode);
      if (gtxResult.trim() && gtxResult.trim().toLowerCase() !== trimmed.toLowerCase()) {
        const formatted = `${leading}${gtxResult}${trailing}`;
        sessionTranslationCache.set(cacheKey, formatted);
        return { text: formatted, engine: 'google_gtx' };
      }
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  // 3. Automatic Fallback to MyMemory API
  const mmResult = await translateViaMyMemory(trimmed, effectiveSource, targetCode);
  const formatted = `${leading}${mmResult}${trailing}`;
  sessionTranslationCache.set(cacheKey, formatted);
  return { text: formatted, engine: 'mymemory' };
}

/**
 * Translate full multi-paragraph document text 100% client-side with progress callback.
 */
export async function translateTextClientSide(
  text: string,
  targetLangLabel: string,
  sourceLangLabel: string = 'auto',
  onProgress?: (info: ClientTranslationProgress) => void
): Promise<{ translatedText: string; engineUsed: ClientTranslationEngine }> {
  const cleanInput = (text || '').trim();
  if (!cleanInput) {
    throw new Error('يرجى إدخال نص للترجمة أولاً.');
  }

  const targetCode = resolveLangCode(targetLangLabel);
  const sourceCode = resolveLangCode(sourceLangLabel);
  const chunks = splitIntoChunks(cleanInput, 420);

  const enginesUsed = new Set<string>();
  const translatedChunks: string[] = [];

  onProgress?.({
    percent: 5,
    status: `جاري تجهيز ${chunks.length} مقطع للترجمة...`,
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.trim()) {
      translatedChunks.push(chunk);
      continue;
    }

    const res = await translateSegment(chunk, sourceCode, targetCode);
    enginesUsed.add(res.engine);

    translatedChunks.push(res.text);

    const engineLabel =
      res.engine === 'libretranslate'
        ? 'LibreTranslate'
        : res.engine === 'google_gtx'
        ? 'Neural Translate'
        : 'MyMemory';
    const pct = Math.min(98, Math.round(((i + 1) / chunks.length) * 95) + 3);
    onProgress?.({
      percent: pct,
      status: `تمت ترجمة ${i + 1} من ${chunks.length} (${engineLabel})`,
      engine: res.engine,
    });
  }

  const finalEngine: ClientTranslationEngine =
    enginesUsed.size > 1
      ? 'mixed'
      : enginesUsed.has('libretranslate')
      ? 'libretranslate'
      : enginesUsed.has('google_gtx')
      ? 'google_gtx'
      : 'mymemory';

  onProgress?.({
    percent: 100,
    status: 'اكتملت الترجمة بنجاح!',
    engine: finalEngine,
  });

  return {
    translatedText: translatedChunks.join('\n'),
    engineUsed: finalEngine,
  };
}

/**
 * Batch translate an array of strings (for DOCX/XLSX/PPTX nodes & Q&As) client-side with parallel concurrency.
 */
export async function translateBatchClientSide(
  items: string[],
  targetLangLabel: string,
  onProgress?: (processed: number, total: number) => void
): Promise<string[]> {
  if (!items.length) return [];
  const targetCode = resolveLangCode(targetLangLabel);
  const results: string[] = new Array(items.length);
  let completed = 0;
  const CONCURRENCY = 2;

  const translateOne = async (index: number): Promise<void> => {
    const item = items[index];
    if (!item || !item.trim() || isPureFormulaOrSymbol(item)) {
      results[index] = item;
    } else {
      try {
        const subChunks = splitIntoChunks(item, 420);
        const translatedParts: string[] = [];
        for (const sc of subChunks) {
          const r = await translateSegment(sc, 'auto', targetCode);
          translatedParts.push(r.text);
        }
        results[index] = translatedParts.join(' ');
      } catch {
        results[index] = item;
      }
    }
    completed += 1;
    if (completed % 2 === 0 || completed === items.length) {
      onProgress?.(completed, items.length);
    }
  };

  for (let start = 0; start < items.length; start += CONCURRENCY) {
    const sliceIndices: number[] = [];
    for (let j = start; j < Math.min(start + CONCURRENCY, items.length); j++) {
      sliceIndices.push(j);
    }
    await Promise.all(sliceIndices.map((idx) => translateOne(idx)));
  }

  return results;
}

/**
 * Build downloadable TXT or Word (.doc) blobs with proper UTF-8 + RTL/LTR support
 */
export function buildTxtBlob(text: string): Blob {
  return new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
}

export function buildWordDocBlob(options: {
  title: string;
  content: string;
  targetLang?: string;
  sourceText?: string;
  mode?: 'single' | 'dual';
}): Blob {
  const { title, content, targetLang = 'العربية', sourceText, mode = 'single' } = options;
  const isRTL =
    isRtlLangCode(resolveLangCode(targetLang)) || /[\u0600-\u06FF\u0590-\u05FF]/.test(content.slice(0, 200));
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

  const bodyHtml =
    mode === 'dual' && sourceText
      ? `<table style="width:100%;border-collapse:collapse;margin-top:14px;">
          <tr>
            <th style="border:1px solid #cbd5e1;padding:8px;background:#f1f5f9;width:50%;text-align:left;">Original Text</th>
            <th style="border:1px solid #cbd5e1;padding:8px;background:#eff6ff;width:50%;text-align:${align};">Translated (${esc(targetLang)})</th>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:10px;vertical-align:top;direction:ltr;text-align:left;">${esc(sourceText)}</td>
            <td style="border:1px solid #cbd5e1;padding:10px;vertical-align:top;direction:${dir};text-align:${align};">${esc(content)}</td>
          </tr>
        </table>`
      : `<div style="line-height:1.8;font-size:13pt;">${esc(content)}</div>`;

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body { font-family: 'Cairo', 'Arial', sans-serif; direction: ${dir}; text-align: ${align}; color: #0f172a; padding: 24px; }
  h1 { color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; font-size: 18pt; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${bodyHtml}
</body>
</html>`;

  return new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
}
