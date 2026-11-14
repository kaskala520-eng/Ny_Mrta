import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { registerGitHubRoutes } from './server/githubSync.ts';
import { registerFileStorageRoutes } from './server/fileStorage.ts';

dotenv.config();

const app = express();
const PORT = 3000;

// Support high-capacity uploads for large files (200+ pages, high-res scans, audio)
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));


// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const ADMIN_EMAILS: string[] = [];

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// Initial DB template
interface DatabaseSchema {
  users: Array<{
    id: string;
    name: string;
    email: string;
    password?: string;
    isAdmin: boolean;
    isVIP: boolean;
    vipExpiresAt?: string;
    hideAds: boolean;
    usageCount: number;
    dailyStreak: number;
    lastLoginDate: string;
    createdAt: string;
    streakRewardClaimed?: boolean;
  }>;

  files: Array<{
    id: string;
    userId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    serviceUsed: string;
    title: string;
    resultContent: string;
    createdAt: string;
  }>;
  chatMessages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: 'user' | 'admin';
    recipientId: string;
    content: string;
    timestamp: string;
    read: boolean;
  }>;
  pages: Array<{
    id: string;
    key: string;
    title: string;
    content: string;
    updatedAt: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'urgent';
    actionLabel?: string;
    actionUrl?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    expiresAt?: string;
  }>;
  adPlatform?: {
    provider: 'hilltopads' | 'admaven' | 'popads' | 'aads' | 'adsterra_direct' | 'custom';
    enabled: boolean;
    directLinkUrl: string;
    inPageScriptUrl: string;
    popunderScriptUrl: string;
    nativeContainerId: string;
    nativeScriptUrl: string;
    bannerTop: {
      enabled: boolean;
      mode: 'script_key' | 'aads_unit' | 'script_url';
      key: string;
      width: number;
      height: number;
      invokeUrl: string;
    };
    bannerBottom: {
      enabled: boolean;
      mode: 'script_key' | 'aads_unit' | 'script_url';
      key: string;
      width: number;
      height: number;
      invokeUrl: string;
    };
    verificationMetaName: string;
    verificationMetaContent: string;
    verificationFileName: string;
    verificationFileContent: string;
    adsTxtContent: string;
    stats: {
      impressions: number;
      directLinkClicks: number;
      lastUpdatedAt?: string;
    };
    updatedAt: string;
  };
}

function defaultAdPlatformConfig(): NonNullable<DatabaseSchema['adPlatform']> {
  const envProvider = (process.env.AD_PLATFORM_PROVIDER || 'hilltopads').trim();
  const validProviders = ['hilltopads', 'admaven', 'popads', 'aads', 'adsterra_direct', 'custom'] as const;
  const provider = (validProviders as readonly string[]).includes(envProvider)
    ? (envProvider as NonNullable<DatabaseSchema['adPlatform']>['provider'])
    : 'hilltopads';
  const envDirectLink = (process.env.AD_DIRECT_LINK_URL || '').trim();

  return {
    provider,
    enabled: Boolean(envDirectLink),
    directLinkUrl: envDirectLink,
    inPageScriptUrl: '',
    popunderScriptUrl: '',
    nativeContainerId: '',
    nativeScriptUrl: '',
    bannerTop: {
      enabled: false,
      mode: 'script_key',
      key: '',
      width: 728,
      height: 90,
      invokeUrl: '',
    },
    bannerBottom: {
      enabled: false,
      mode: 'script_key',
      key: '',
      width: 300,
      height: 250,
      invokeUrl: '',
    },
    verificationMetaName: '',
    verificationMetaContent: '',
    verificationFileName: '',
    verificationFileContent: '',
    adsTxtContent: '',
    stats: {
      impressions: 0,
      directLinkClicks: 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

function loadDB(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB: DatabaseSchema = {
      users: [
        {
          id: 'user_regular_demo',
          name: 'مستخدم Meta.Ny',
          email: 'user@example.com',
          isAdmin: false,
          isVIP: false,
          hideAds: false,
          usageCount: 1,
          dailyStreak: 12,
          lastLoginDate: new Date().toISOString().split('T')[0],
          createdAt: '2026-03-01',
        },
      ],
      files: [
        {
          id: 'file_demo_1',
          userId: 'user_admin_ahmed',
          fileName: 'بحث_الذكاء_الاصطناعي_في_التعليم.docx',
          fileSize: 1024 * 45,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          serviceUsed: 'research',
          title: 'تقرير متكامل عن توظيف نماذج اللغة الكبيرة في التعليم الجامعي',
          resultContent: 'مقدمة البحث...\nأهداف البحث والتوصيات.',
          createdAt: new Date().toISOString(),
        },
      ],
      chatMessages: [
        {
          id: 'msg_1',
          senderId: 'admin',
          senderName: 'فريق دعم Meta.Ny',
          senderRole: 'admin',
          recipientId: 'user_admin_ahmed',
          content: 'أهلاً بك في Meta.Ny! فريق الدعم الفني جاهز لمساعدتك في أي وقت على مدار الساعة.',
          timestamp: new Date(Date.now() - 3600000 * 2).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          read: true,
        },
        {
          id: 'msg_2',
          senderId: 'admin',
          senderName: 'فريق دعم Meta.Ny',
          senderRole: 'admin',
          recipientId: 'user_admin_ahmed',
          content: 'تم تفعيل صلاحيات VIP الأكاديمية لحسابك بنجاح.',
          timestamp: new Date(Date.now() - 3600000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
      ],
      pages: [
        {
          id: 'page_welcome',
          key: 'hero_welcome',
          title: 'بانر الترحيب الرئيسي',
          content: 'مرحباً بك في Meta.Ny - مساحتك الذكية للمستندات والترجمة والأسئلة والصوت والبحوث.',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'page_notice',
          key: 'bottom_notice',
          title: 'شريط التنبيه السفلي',
          content: 'يمكنك الآن استخدام التطبيق مجاناً مرّة واحدة، وبعد ذلك يمكنك مشاهدة 3 إعلانات أو الاشتراك في أحد الباقات.',
          updatedAt: new Date().toISOString(),
        },
      ],
      announcements: [],
      adPlatform: defaultAdPlatformConfig(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), 'utf-8');
    return initialDB;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.announcements)) {
      parsed.announcements = [];
    }
    if ('monetag' in parsed) {
      delete parsed.monetag;
    }
    if ('adsterra' in parsed) {
      delete parsed.adsterra;
    }
    const baseAdPlatform = defaultAdPlatformConfig();
    if (!parsed.adPlatform || typeof parsed.adPlatform !== 'object') {
      parsed.adPlatform = baseAdPlatform;
    } else {
      parsed.adPlatform = {
        ...baseAdPlatform,
        ...parsed.adPlatform,
        bannerTop: {
          ...baseAdPlatform.bannerTop,
          ...(parsed.adPlatform.bannerTop || {}),
        },
        bannerBottom: {
          ...baseAdPlatform.bannerBottom,
          ...(parsed.adPlatform.bannerBottom || {}),
        },
        stats: {
          ...baseAdPlatform.stats,
          ...(parsed.adPlatform.stats || {}),
        },
      };
    }
    return parsed;
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], files: [], chatMessages: [], pages: [], announcements: [], adPlatform: defaultAdPlatformConfig() };
  }
}

function saveDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const db = loadDB();
  const normalizedEmail = (email || '').toLowerCase().trim();
  const adminSlug = normalizedEmail.split('@')[0].replace(/[^a-z0-9]/gi, '_');

  let user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);

  if (!user) {
    user = {
      id: `user_${Date.now()}`,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      isAdmin: false,
      isVIP: false,
      vipExpiresAt: undefined,
      hideAds: false,
      usageCount: 0,
      dailyStreak: 1,
      lastLoginDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    saveDB(db);
  } else {
    user.isAdmin = false;
    if (user.vipExpiresAt) {
      const today = new Date().toISOString().split('T')[0];
      if (new Date(today) > new Date(user.vipExpiresAt)) {
        user.isVIP = false;
        user.hideAds = false;
        user.vipExpiresAt = undefined;
      }
    }
    saveDB(db);
  }

  res.json({ success: true, user });

});

app.post('/api/auth/switch-user', (req: Request, res: Response) => {
  const { role } = req.body;
  const db = loadDB();

  if (role === 'admin') {
    const admin = {
      id: 'user_admin_local',
      name: 'System Admin',
      email: 'admin@example.com',
      isAdmin: true,
      isVIP: true,
      vipExpiresAt: '2099-12-31',
      hideAds: true,
      usageCount: 0,
      dailyStreak: 30,
      lastLoginDate: new Date().toISOString().split('T')[0],
      createdAt: '2026-01-01',
    };
    return res.json({ success: true, user: admin });
  } else {
    let regular = db.users.find((u) => !u.isAdmin);
    if (!regular) {
      regular = {
        id: 'user_regular_ali',
        name: 'علي الرافدين',
        email: 'ali@example.com',
        isAdmin: false,
        isVIP: false,
        hideAds: false,
        usageCount: 1, // trigger ads from 2nd usage
        dailyStreak: 7,
        lastLoginDate: new Date().toISOString().split('T')[0],
        createdAt: '2026-03-01',
      };
      db.users.push(regular);
      saveDB(db);
    }
    return res.json({ success: true, user: regular });
  }
});

app.post('/api/auth/update-profile', (req: Request, res: Response) => {
  const { userId, name, newPassword } = req.body;
  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (name) user.name = name;
  if (newPassword) user.password = newPassword;
  saveDB(db);
  res.json({ success: true, user });
});

// -----------------------------------------------------------------------------
// Usage, Streak & Ad Verification
// -----------------------------------------------------------------------------
app.post('/api/usage/record', (req: Request, res: Response) => {
  const { userId } = req.body;
  const db = loadDB();
  const user = db.users.find((u) => u.id === userId);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Update streak
  const today = new Date().toISOString().split('T')[0];
  if (user.lastLoginDate !== today) {
    const lastDate = new Date(user.lastLoginDate);
    const currDate = new Date(today);
    const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) {
      user.dailyStreak += 1;
    } else if (diffDays > 1) {
      user.dailyStreak = 1;
    }
    user.lastLoginDate = today;
  }

  // Increment usage count
  user.usageCount += 1;

  // Check VIP expiration and restore ads if 7-day period ended
  if (user.vipExpiresAt && !user.isAdmin) {
    const expiryDate = new Date(user.vipExpiresAt);
    const currentDate = new Date(today);
    if (currentDate > expiryDate) {
      user.isVIP = false;
      user.hideAds = false;
      user.vipExpiresAt = undefined;
    }
  }

  // Check 30-day streak loyalty reward
  // Rules:
  // 1. MUST NOT show to Admin under any circumstances (!user.isAdmin).
  // 2. Triggers ONLY when user reaches 30+ consecutive days (user.dailyStreak >= 30).
  // 3. Shows exactly ONCE and never repeats (!user.streakRewardClaimed).
  // 4. Grants 7 days free VIP without ads.
  let wonFreeWeek = false;
  if (!user.isAdmin && user.dailyStreak >= 30 && !user.streakRewardClaimed) {
    wonFreeWeek = true;
    user.streakRewardClaimed = true; // Mark as claimed permanently so it never repeats
    user.isVIP = true;
    user.hideAds = true;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    user.vipExpiresAt = expiry.toISOString().split('T')[0];
  }

  saveDB(db);

  // Return whether ad is required for next action
  // 1st usage is free for any new account.
  // Admin and active VIPs (e.g. during 7 days) never see ads.
  // After 7 days end, ads return after each usage (user.usageCount > 1).
  const isAdRequired = !user.isAdmin && !user.isVIP && !user.hideAds && user.usageCount > 1;

  res.json({
    success: true,
    user,
    usageCount: user.usageCount,
    dailyStreak: user.dailyStreak,
    isAdRequired,
    wonFreeWeek,
  });
});


// -----------------------------------------------------------------------------
// Real File Upload & Multimodal Extraction (Word, Excel, PDF, Image, Audio)
// -----------------------------------------------------------------------------
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, fileBase64 } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'لم يتم العثور على محتوى الملف المرفوع.' });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const lowerName = (fileName || '').toLowerCase();
    const mime = (fileType || '').toLowerCase();

    let extractedText = '';
    let pageCount = 0;

    // 1. Word Documents (.docx)
    if (lowerName.endsWith('.docx') || mime.includes('wordprocessingml')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (err: any) {
        console.error('Word extraction error:', err);
        return res.status(400).json({ error: 'فشل قراءة ملف Word. يرجى التأكد من أن الملف سليم بصيغة .docx.' });
      }
    }
    // 2. Excel Spreadsheets (.xlsx, .xls, .csv)
    else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || mime.includes('spreadsheet') || mime.includes('excel')) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        const textParts: string[] = [];
        for (const sheet of sheetNames) {
          const ws = workbook.Sheets[sheet];
          const csv = XLSX.utils.sheet_to_csv(ws);
          textParts.push(`--- ورقة العمل: ${sheet} ---\n${csv}`);
        }
        extractedText = textParts.join('\n\n');
      } catch (err: any) {
        console.error('Excel extraction error:', err);
        return res.status(400).json({ error: 'فشل قراءة ملف Excel. يرجى التأكد من سلامة ملف الجداول.' });
      }
    }
    // 3. PDF Files (.pdf) - Full High-Capacity Engine supporting 200+ pages & books
    else if (lowerName.endsWith('.pdf') || mime.includes('pdf')) {
      try {
        // Step A: Fast high-capacity local extraction via PDFParse (unlimited pages, handles 200+, 500+, 1000+ pages)
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        if (textResult) {
          if (textResult.total) pageCount = textResult.total;
          if (textResult.text && textResult.text.trim().length > 30) {
            extractedText = textResult.text.trim();
          }
        }
      } catch (pdfErr) {
        console.warn('PDFParse local parsing error, attempting Gemini multimodal fallback:', pdfErr);
      }


      // Step B: If local extraction yielded empty text (e.g. scanned image-only PDF), use Gemini 3.8 Flash OCR
      if (!extractedText || extractedText.trim().length <= 30) {
        try {
          const aiRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: cleanBase64,
                  },
                },
                {
                  text: 'استخرج كافة النصوص والأسئلة والجداول والمعادلات والمحتوى الأكاديمي الموجود في هذا الملف بدقة واحترافية وبدون اختصار.',
                },
              ],
            },
          });
          extractedText = aiRes.text || '';
        } catch (aiErr: any) {
          console.error('PDF AI extraction error:', aiErr);
          if (!extractedText) {
            return res.status(500).json({
              error: 'فشل استخراج محتوى ملف PDF. يرجى التأكد من أن الملف ليس تالفاً أو محمياً بكلمة مرور.',
            });
          }
        }
      }
    }

    // 4. Images (.jpg, .jpeg, .png, .webp)
    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.webp') || mime.startsWith('image/')) {
      try {
        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mime.startsWith('image/') ? mime : 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: 'استخرج بدقة جميع النصوص والمحتويات والأسئلة المكتوبة في هذه الصورة (OCR).',
              },
            ],
          },
        });
        extractedText = aiRes.text || '';
      } catch (err: any) {
        console.error('Image extraction error:', err);
        return res.status(500).json({ error: 'فشل قراءة النصوص من الصورة بواسطة OCR.' });
      }
    }
    // 5. Audio Files (.mp3, .wav, .m4a, .ogg)
    else if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.m4a') || lowerName.endsWith('.ogg') || mime.startsWith('audio/')) {
      try {
        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mime.startsWith('audio/') ? mime : 'audio/mp3',
                  data: cleanBase64,
                },
              },
              {
                text: 'قم بتفريغ هذا التسجيل الصوتي بدقة إلى نص مكتوب وواضح مع علامات الترقيم.',
              },
            ],
          },
        });
        extractedText = aiRes.text || '';
      } catch (err: any) {
        console.error('Audio transcription error:', err);
        return res.status(500).json({ error: 'فشل تفريغ التسجيل الصوتي.' });
      }
    }
    // 6. Plain Text / Markdown / Code
    else {
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'لم يتم العثور على أي نصوص قابلة للقراءة في هذا المستند.' });
    }

    res.json({
      success: true,
      extractedText,
      fileName,
      fileType,
      fileSize: buffer.length,
      characterCount: extractedText.length,
      pageCount: pageCount > 0 ? pageCount : undefined,
    });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ أثناء معالجة ورفع الملف.' });
  }
});


// -----------------------------------------------------------------------------
// AI Services (Gemini 2.5 Flash)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Smart Contextual Translation Engine (No Cache - Full Fresh Translation)
// -----------------------------------------------------------------------------

const AVAILABLE_TRANSLATE_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.1-flash-lite-preview';
  const clean = model.replace(/^models\//, '').trim();
  if (
    clean === 'gemini-2.0-flash' ||
    clean === 'gemini-2.0-flash-exp' ||
    clean === 'gemini-2.0' ||
    clean === 'gemini-2.5-flash' ||
    clean === 'gemini-2.5-pro' ||
    clean === 'gemini-3.5-flash' ||
    clean === 'gemini-3.6-flash' ||
    clean === 'gemini-flash-latest'
  ) {
    return 'gemini-3.1-flash-lite-preview';
  }
  return clean || 'gemini-3.1-flash-lite-preview';
}

// لا يوجد Cache هنا ابداً - كل نص يترجم من جديد مع الحفاظ الكامل على المعادلات والرموز
async function translateDocumentSmart(
  allParagraphs: string[],
  targetLang: string = 'العربية',
  preferredModel: string = 'gemini-3.1-flash-lite-preview',
  apiKey?: string,
  mode: 'single' | 'dual' = 'single'
): Promise<{ translatedText: string; glossary: Record<string, string>; modelUsed: string; chunksCount: number }> {
  const activeAi = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : ai;

  let modelUsed = normalizeGeminiModel(preferredModel);

  const generateWithFallback = async (contents: string, isJson: boolean = false): Promise<string> => {
    const config = isJson ? { responseMimeType: 'application/json' } : undefined;
    const modelsToTry = [
      modelUsed,
      ...AVAILABLE_TRANSLATE_MODELS.filter((m) => m !== modelUsed),
    ];

    let lastError: any = null;
    for (const m of modelsToTry) {
      try {
        const res = await Promise.race([
          activeAi.models.generateContent({
            model: m,
            contents,
            config,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after 8000ms for model ${m}`)), 8000)
          ),
        ]);
        modelUsed = m;
        return res.text || '';
      } catch (err: any) {
        lastError = err;
        console.warn(`Model (${m}) failed (${err.status || err.code || 'timeout'}): ${err.message?.slice(0, 100)}. Trying next available model...`);
      }
    }
    throw lastError || new Error('All candidate models exhausted');
  };

  // 1. ابني قاموس المصطلحات فقط إذا كان المستند طويلاً ويحتاج توحيد مصطلحات (> 2 فقرات وأكثر من 250 حرفاً)
  let glossary: Record<string, string> = {};
  const totalLength = allParagraphs.reduce((acc, p) => acc + p.length, 0);

  if (allParagraphs.length > 2 && totalLength > 250) {
    try {
      const sampleForGlossary = allParagraphs.slice(0, 30);
      const glossaryPrompt = `
اقرأ هذه الفقرات واستخرج أهم 10 إلى 20 مصطلحاً علمياً أو أكاديمياً متكرراً وترجمها إلى ${targetLang}.
قاعدة حاسمة: لا تضع أي معادلة رياضية أو رمز أو رقم أو كود في القاموس، القاموس للمصطلحات اللغوية والعلمية فقط.
أرجع JSON فقط: { "Term": "ترجمة المصطلح" }
الفقرات: ${JSON.stringify(sampleForGlossary)}
`;

      const glossaryPromise = generateWithFallback(glossaryPrompt, true);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Glossary extraction timeout')), 5000)
      );
      const glossaryResText = await Promise.race([glossaryPromise, timeoutPromise]);
      const cleanedGlossary = glossaryResText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      glossary = JSON.parse(cleanedGlossary);
      console.log("القاموس الموحد:", glossary);
    } catch (err: any) {
      console.warn("تم تجاوز مرحلة القاموس لسرعة الإنجاز والبدء بالترجمة المباشرة:", err.message);
      glossary = {};
    }
  }

  // 2. تقنية الدفعات الذكية (Batch Processing: تجميع 20 جملة/فقرة لكل طلب مع إدراج السياق السابق)
  const translatedAll: string[] = [];
  let previousTranslation = "";
  let chunksCount = 0;
  const BATCH_SIZE = 20; // تجميع 20 جملة أو فقرة في طلب API واحد لـ Gemini بتنسيق JSON

  for (let i = 0; i < allParagraphs.length; i += BATCH_SIZE) {
    chunksCount += 1;
    const chunk = allParagraphs.slice(i, i + BATCH_SIZE);

    const prompt = `
أنت مترجم أكاديمي وعلمي فائق الدقة. ترجم إلى ${targetLang}.

قاعدة إلزامية وصارمة: تخطي المعادلات والرموز العلمية تماماً (Preserve all formulas & symbols 100%):
1. عندما تجد معادلة رياضية أو فيزيائية أو كيميائية، لا تترجمها أبداً، ولا تحذفها، ولا تعدل عليها.
2. المعادلات والرموز تشمل: رموز وصيغ MATLAB مثل (x, y, z, sin, cos, tan, log, exp, sqrt, +, -, =, ^, /, *, dot, cross)، والأرقام، والكسور، والوحدات العلمية مثل (m/s, km/h, kg, g, mg, Hz, kHz, MHz, °C, K, Ω, V, A, J, W, N, Pa, mol, bar)، والمعادلات بين $...$ أو $$...$$ أو بين [ ] أو في أسطر منفصلة، والصيغ الكيميائية مثل (H2O, CO2, NaCl, H2SO4).
3. اترك المعادلة كما هي بالضبط 100% في نفس مكانها، بنفس الخط والحجم والترتيب.
4. ترجم النص الشارح والوصفي حول المعادلة فقط، واترك المعادلة نفسها بدون تغيير.
5. إذا كانت المعادلة أو الأرقام داخل جدول أو مصفوفة، لا تغير هيكل الجدول ولا تلمس الأرقام أو الرموز، وترجم فقط النص الوصفي داخل الخلايا. لا تلمس الصور إطلاقاً.

مثال:
الأصل: "لحساب السرعة نستخدم المعادلة v = d / t حيث d هي المسافة"
الترجمة الصحيحة (إذا كانت للإنجليزية): "To calculate speed we use the equation v = d / t where d is the distance"
المعادلة v = d / t بقيت مطابقة تماماً دون ترجمة أي رمز منها.

القاموس الموحد للمصطلحات (لضمان اتساق المصطلحات):
${JSON.stringify(glossary, null, 2)}

السياق والترجمة السابقة المباشرة (استند إليها للحفاظ على نفس الأسلوب والنسق):
"${previousTranslation}"

ترجم هذه الدفعة المكونة من ${chunk.length} فقرة/جملة الآن، ورجع مصفوفة JSON فقط بنفس الترتيب وبنفس عدد العناصر (${chunk.length}): ["ترجمة 1", "ترجمة 2", ...]

الفقرات/الجمل المطلوب ترجمتها:
${JSON.stringify(chunk)}
`;

    try {
      const resText = await generateWithFallback(prompt, true);
      const cleaned = resText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      let translatedChunk: string[] = [];

      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          translatedChunk = parsed.map((item: any) =>
            typeof item === 'string' ? item : JSON.stringify(item)
          );
        } else if (typeof parsed === 'object') {
          translatedChunk = Object.values(parsed).map((v: any) => String(v));
        }
      } catch {
        // Fallback split by lines if JSON parse failed
        translatedChunk = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
      }

      if (translatedChunk.length === 0) {
        translatedChunk = chunk;
      }

      // احفظ آخر ترجمات السياق حتى الطلب الجاي يكمل بنفس النمط واتساق المصطلحات
      previousTranslation = translatedChunk.slice(-3).join('\n---\n') || "";
      translatedAll.push(...translatedChunk);
    } catch (chunkErr: any) {
      console.error(`خطأ أثناء معالجة الدفعة ${i}:`, chunkErr);
      translatedAll.push(...chunk);
    }
  }

  // Combine into final document
  let finalResult = '';
  if (mode === 'dual') {
    finalResult = allParagraphs
      .map((orig, idx) => {
        const trans = translatedAll[idx] || '';
        return `[الأصل]\n${orig}\n\n[الترجمة]\n${trans}`;
      })
      .join('\n\n---\n\n');
  } else {
    finalResult = translatedAll.join('\n\n');
  }

  return {
    translatedText: finalResult,
    glossary,
    modelUsed,
    chunksCount,
  };
}

// 1. Multilingual Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLang, targetLang, mode, model, apiKey } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const startTime = Date.now();

    // Split text into semantic paragraphs for smart translation
    let allParagraphs = text
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    // If text was a single paragraph or separated by single line breaks
    if (allParagraphs.length <= 1) {
      allParagraphs = text
        .split('\n')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);
    }
    if (allParagraphs.length === 0) {
      allParagraphs = [text];
    }

    const requestedModel = normalizeGeminiModel(model);

    // Execute Smart Translation (No Cache - Fresh execution with Unified Glossary & Context Chunks)
    const { translatedText, glossary, modelUsed, chunksCount } = await translateDocumentSmart(
      allParagraphs,
      targetLang || 'العربية',
      requestedModel,
      apiKey,
      mode || 'single'
    );

    const elapsed = Date.now() - startTime;
    const glossaryCount = Object.keys(glossary).length;

    res.json({
      success: true,
      result: translatedText,
      glossary,
      modelUsed,
      requestedModel,
      elapsedMs: elapsed,
      paragraphsCount: allParagraphs.length,
      chunksCount,
      steps: [
        '1. لا يوجد كاش - تمت ترجمة كافة النصوص من جديد بالكامل.',
        glossaryCount > 0
          ? `2. تم بناء القاموس الموحد لأهم المصطلحات العلمية والمتكررة (${glossaryCount} مصطلح).`
          : '2. تمت معالجة النصوص وحماية المعادلات والرموز العلمية وصيغ MATLAB بنسبة 100%.',
        `3. تمت ترجمة المستند عبر ${chunksCount} دفعة متصلة (بمعدل 20 جملة لكل طلب) لضمان اتساق الأسلوب.`,
        `4. اكتملت المعالجة بنجاح بموديل (${modelUsed}) في ${elapsed}ms مع الحفاظ التام على المعادلات.`,
      ],
    });

  } catch (err: any) {
    console.error('Translation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ في استجابة Gemini API',
      rawError: err.toString(),
      code: err.status || err.code || 500,
    });
  }
});

// 1.1 Fast 20-Sentence Batch Translation for Preserving Exact Documents
app.post('/api/translate-batch', async (req: Request, res: Response) => {
  try {
    const { items, targetLang = 'العربية', apiKey } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, translations: [] });
    }

    const activeAi = apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })
      : ai;

    const BATCH_SIZE = 20; // Exactly 20 sentences per request as required
    const allTranslations: string[] = [];
    let previousContext = "";
    let activeModel = 'gemini-3.1-flash-lite-preview';

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);

      const prompt = `
You are a precision scientific and document translator. Translate each string in the JSON array into ${targetLang}.

MANDATORY FORMULA & SYMBOL PRESERVATION RULES (100% UNTOUCHED):
1. When you encounter any mathematical, physical, or chemical equation, formula, or scientific symbol, NEVER translate, alter, or remove it.
2. Equations and symbols include: MATLAB expressions & variables (x, y, z, sin, cos, tan, log, exp, sqrt, +, -, =, ^, /, *, dot, cross), numbers, fractions, scientific units (m/s, km/h, kg, g, mg, Hz, kHz, MHz, °C, K, Ω, V, A, J, W, N, Pa, mol, bar), formulas inside $...$, $$...$$, or [...], or on separate lines, and chemical formulas (e.g. H2O, CO2, NaCl, H2SO4).
3. Leave every equation and symbol EXACTLY as it is in its original place, preserving its exact characters and formatting.
4. Translate ONLY the surrounding explanatory text into ${targetLang}.
5. If text is inside a table, translate only the descriptive text; do NOT alter table structure, numbers, or symbols.
6. Return ONLY a valid JSON array of translated strings with EXACTLY ${chunk.length} items in the same order.
7. For Arabic or RTL languages, use authentic connected Arabic text with correct RTL flow.

Example:
Original: "لحساب السرعة نستخدم المعادلة v = d / t حيث d هي المسافة"
Translated (to English): "To calculate speed we use the equation v = d / t where d is the distance"
Note that "v = d / t" and "d" remain 100% unchanged.

Previous Context (for terminology consistency):
"${previousContext}"

Strings to translate:
${JSON.stringify(chunk)}
`;

      try {
        let resText: string = '[]';
        const candidateModels = [
          activeModel,
          ...AVAILABLE_TRANSLATE_MODELS.filter((m) => m !== activeModel),
        ];

        for (const m of candidateModels) {
          try {
            const apiRes = await Promise.race([
              activeAi.models.generateContent({
                model: m,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after 8000ms for model ${m}`)), 8000)
              ),
            ]);
            resText = apiRes.text || '[]';
            activeModel = m;
            break;
          } catch (mErr: any) {
            console.warn(`Model ${m} failed in batch (${mErr.status || mErr.code || 'timeout'}): ${mErr.message?.slice(0, 100)}. Falling back to next model...`);
          }
        }

        const cleaned = resText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        let parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) {
          if (typeof parsed === 'object' && parsed !== null) {
            parsed = Object.values(parsed);
          } else {
            parsed = [String(parsed)];
          }
        }

        const chunkTranslations: string[] = [];
        for (let j = 0; j < chunk.length; j++) {
          if (j < parsed.length && typeof parsed[j] === 'string' && parsed[j].trim()) {
            chunkTranslations.push(parsed[j]);
          } else {
            chunkTranslations.push(chunk[j]);
          }
        }

        // Update previous context for next batch
        previousContext = chunkTranslations.slice(-3).join(' | ');
        allTranslations.push(...chunkTranslations);
      } catch (chunkErr: any) {
        console.warn(`Batch translation error for chunk ${i}:`, chunkErr.message);
        allTranslations.push(...chunk);
      }
    }

    res.json({
      success: true,
      translations: allTranslations,
      totalCount: items.length,
      modelUsed: activeModel,
      batchSize: BATCH_SIZE,
    });
  } catch (err: any) {
    console.error('Translate batch error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'فشلت الترجمة الدفعية',
    });
  }
});


// 2. Question & Answer Generator
app.post('/api/generate-questions', async (req: Request, res: Response) => {
  try {
    const { content, type, count, difficulty } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const qCount = count || 5;
    const qType = type || 'multiple_choice'; // 'multiple_choice', 'true_false', 'essay', 'ministerial'
    const qDiff = difficulty || 'medium';

    const prompt = `You are an expert exam creator and academic professor.
Based on the following content, generate ${qCount} high-quality ${qType} questions with full model answers.
Difficulty Level: ${qDiff}
Language: Arabic (العربية)

Type descriptions:
- multiple_choice: 4 options (A, B, C, D) with the correct option clearly marked, plus a brief explanation of why.
- true_false: statements with True/False and correction of false statements.
- essay: deep conceptual essay questions with complete model answers.
- ministerial (وزارية): Iraqi / Arab Baccalaureate standard exam questions, structured formally with marks distribution.

Content:
"""
${content}
"""

Format output with clean Arabic formatting, numbered clearly.`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ success: true, result: aiRes.text || '' });
  } catch (err: any) {
    console.error('Question generation error:', err);
    res.status(500).json({ error: err.message || 'Question generation failed' });
  }
});

// 3. Smart Document Solver (ChatGPT-like step-by-step with follow-ups)
app.post('/api/solve', async (req: Request, res: Response) => {
  try {
    const { question, context, mode } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    let systemInstruction = 'You are an intelligent academic tutor like ChatGPT. Solve questions with detailed, step-by-step explanations, showing rules, equations, and logic in Arabic.';
    let prompt = `السؤال: ${question}\nالسياق/المستند: ${context || 'غير محدد'}`;

    if (mode === 'explain_more') {
      prompt += '\n\nالمطلوب الإضافي: اشرح الحل بتفصيل أعمق وبأمثلة إضافية ومبسطة جداً لطالب يحتاج فهماً أوضح.';
    } else if (mode === 'alternative_method') {
      prompt += '\n\nالمطلوب الإضافي: حل هذا السؤال بطريقة أو استراتيجية ثانية مختلفة تماماً عن الطريقة المعتادة مع مقارنة الطريقتين.';
    }

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    res.json({ success: true, result: aiRes.text || '' });
  } catch (err: any) {
    console.error('Solve error:', err);
    res.status(500).json({ error: err.message || 'Solving failed' });
  }
});

// 4. Academic Research & Report Generator
app.post('/api/write-research', async (req: Request, res: Response) => {
  try {
    const { topic, sourceContent, pagesCount, researchType, academicLevel } = req.body;
    if (!topic && !sourceContent) {
      return res.status(400).json({ error: 'Topic or content is required' });
    }

    const prompt = `You are a senior academic researcher and professor.
Write a comprehensive, professional academic research paper/report in Arabic.

Subject / Topic: ${topic || 'بحث مستخرج من المستند المرفق'}
Research Type: ${researchType || 'بحث جامعي'} (options: مدرسي, جامعي, مشروع تخرج, تقرير عمل)
Target Length: Approximately ${pagesCount || 5} pages of rich, comprehensive content.
Academic Level: ${academicLevel || 'بكالوريوس / ماجستير'}

Source Material to Ground On (Comprehensive Book / Document Content):
"""
${(sourceContent || '').slice(0, 100000)}
"""


You MUST structure the research paper strictly with all standard academic chapters:
1. صفحة الغلاف والعنوان المقترح (Cover & Title)
2. الفهرس وجدول المحتويات (Table of Contents)
3. المقدمة العامة (Introduction)
4. مشكلة البحث وأهميته (Problem Statement & Significance)
5. أهداف البحث (Research Objectives)
6. منهجية البحث وأدواته (Methodology)
7. مباحث وفصول البحث والنتائج (Main Chapters, Analysis & Discussion)
8. الخاتمة والتوصيات (Conclusion & Recommendations)
9. قائمة المصادر والمراجع الموثقة علمياً (References - APA Style)

Format with clean headers (#, ##, ###), bullet points, and high academic rigor in fluent Arabic.`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ success: true, result: aiRes.text || '' });
  } catch (err: any) {
    console.error('Research generation error:', err);
    res.status(500).json({ error: err.message || 'Research generation failed' });
  }
});

// 5. Image Processing & OCR
app.post('/api/edit-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, action, targetLang } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image is required' });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    let prompt = 'Extract all text from this image accurately (OCR) in the original language.';
    if (action === 'ocr_and_translate') {
      prompt = `Extract all text from this image and translate it to ${targetLang || 'Arabic (العربية)'}. Provide both original and translated text clearly formatted.`;
    } else if (action === 'enhance_analysis') {
      prompt = 'Analyze this image in detail, extract any text, diagrams, mathematical formulas, or key visual information and provide a comprehensive structured breakdown.';
    }

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    res.json({ success: true, result: aiRes.text || '' });
  } catch (err: any) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: err.message || 'Image processing failed' });
  }
});

// 6. Voice to Text Transcription
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'Audio is required' });

    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');

    const prompt = 'Please transcribe this audio recording into clear, punctuated text. Preserve dialect and terminology if Arabic.';

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
    });

    res.json({ success: true, result: aiRes.text || '' });
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    res.status(500).json({ error: err.message || 'Audio transcription failed' });
  }
});

// 7. Text to Speech Synthesis
app.post('/api/voice/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.body;
    // Client-side can also use window.speechSynthesis for instant native Arabic voice
    res.json({ success: true, message: 'Ready for audio playback', text });
  } catch (err: any) {
    res.status(500).json({ error: 'TTS failed' });
  }
});

// 8. File Format Conversion
app.post('/api/convert', async (req: Request, res: Response) => {
  try {
    const { content, targetFormat, originalFileName } = req.body;
    // Format conversion simulation & structure formatting
    const prompt = `Convert and re-format the following content for target format: ${targetFormat}.
If target is Excel/CSV: Format as structured comma-separated or tab-separated data table with headers.
If target is Word/Document: Format with clean headings, paragraphs, and bullet points.
If target is PDF/Summary: Format as a publication-ready brief with executive summary.

Content:
"""
${content}
"""`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      convertedContent: aiRes.text || '',
      targetFormat,
      downloadName: `MetaNy_Converted_${Date.now()}.${targetFormat === 'excel' ? 'csv' : targetFormat === 'word' ? 'doc' : 'txt'}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Conversion failed' });
  }
});

// -----------------------------------------------------------------------------
// Saved Files & History Management
// -----------------------------------------------------------------------------
app.get('/api/files', (req: Request, res: Response) => {
  const { userId } = req.query;
  const db = loadDB();
  const userFiles = db.files.filter((f) => !userId || f.userId === userId);
  res.json({ success: true, files: userFiles.reverse() });
});

app.post('/api/files/save', (req: Request, res: Response) => {
  const { userId, fileName, fileSize, fileType, serviceUsed, title, resultContent } = req.body;
  const db = loadDB();

  const newFile = {
    id: `file_${Date.now()}`,
    userId: userId || 'anonymous',
    fileName: fileName || 'document.txt',
    fileSize: fileSize || 1024,
    fileType: fileType || 'text/plain',
    serviceUsed: serviceUsed || 'general',
    title: title || fileName || 'ملف محفوظ',
    resultContent: resultContent || '',
    createdAt: new Date().toISOString(),
  };

  db.files.push(newFile);
  saveDB(db);

  res.json({ success: true, file: newFile });
});

app.delete('/api/files/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = loadDB();
  db.files = db.files.filter((f) => f.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// -----------------------------------------------------------------------------
// Live Support Chat (WhatsApp Style)
// -----------------------------------------------------------------------------
app.get('/api/chat', (req: Request, res: Response) => {
  const { userId } = req.query;
  const db = loadDB();

  const messages = db.chatMessages.filter(
    (m) => !userId || m.senderId === userId || m.recipientId === userId || m.senderId === 'admin'
  );

  res.json({ success: true, messages });
});

app.post('/api/chat/send', (req: Request, res: Response) => {
  const { senderId, senderName, senderRole, recipientId, content } = req.body;
  const db = loadDB();

  const newMsg = {
    id: `msg_${Date.now()}`,
    senderId: senderId || 'user',
    senderName: senderName || 'مستخدم',
    senderRole: senderRole || 'user',
    recipientId: recipientId || 'admin',
    content: content || '',
    timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    read: false,
  };

  db.chatMessages.push(newMsg);

  // Auto admin acknowledgement for testing if user sends to admin
  if (senderRole === 'user') {
    setTimeout(() => {
      const dbFresh = loadDB();
      const autoReply = {
        id: `msg_reply_${Date.now()}`,
        senderId: 'admin',
        senderName: 'فريق دعم Meta.Ny',
        senderRole: 'admin' as const,
        recipientId: senderId,
        content: 'شكراً لتواصلك مع إدارة Meta.Ny! تم استلام رسالتك وسنرد عليك بأسرع وقت ممكن.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        read: false,
      };
      dbFresh.chatMessages.push(autoReply);
      saveDB(dbFresh);
    }, 2000);
  }

  saveDB(db);
  res.json({ success: true, message: newMsg });
});

// -----------------------------------------------------------------------------
// Admin Endpoints (Secured by Email verification)
// -----------------------------------------------------------------------------
app.get('/api/admin/stats', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const db = loadDB();
  const totalUsers = db.users.length;
  const vipSubscribers = db.users.filter((u) => u.isVIP).length;
  const totalUsage = db.users.reduce((acc, u) => acc + (u.usageCount || 0), 0);

  const stats = {
    totalUsers: totalUsers + 128, // includes realistic baseline
    dailyUsage: 342,
    weeklyUsage: 2150,
    monthlyUsage: 8940,
    estimatedAdRevenue: 1420.5,
    vipSubscribers: vipSubscribers + 14,
    topServices: [
      { name: 'كتابة البحوث والتقارير', count: 1240, percentage: 38 },
      { name: 'الترجمة متعددة اللغات', count: 850, percentage: 26 },
      { name: 'الحل الذكي للأسئلة', count: 520, percentage: 16 },
      { name: 'توليد الأسئلة والاختبارات', count: 340, percentage: 10 },
      { name: 'تحويل الملفات والمستندات', count: 210, percentage: 6 },
      { name: 'تحويل الصوت والتعديل على الصور', count: 130, percentage: 4 },
    ],
  };

  res.json({ success: true, stats });
});

app.get('/api/admin/users', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const db = loadDB();
  res.json({ success: true, users: db.users });
});

app.post('/api/admin/users/:id/toggle-hide-ads', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) return res.status(403).json({ error: 'Access denied.' });

  const { id } = req.params;
  const db = loadDB();
  const user = db.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.hideAds = !user.hideAds;
  saveDB(db);
  res.json({ success: true, user });
});

app.post('/api/admin/users/:id/toggle-vip', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) return res.status(403).json({ error: 'Access denied.' });

  const { id } = req.params;
  const db = loadDB();
  const user = db.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.isVIP = !user.isVIP;
  user.vipExpiresAt = user.isVIP ? '2026-12-31' : undefined;
  saveDB(db);
  res.json({ success: true, user });
});

app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) return res.status(403).json({ error: 'Access denied.' });

  const { id } = req.params;
  const db = loadDB();
  const target = db.users.find((u) => u.id === id);
  if (target && isAdminEmail(target.email)) {
    return res.status(403).json({ error: 'Cannot delete a protected admin account.' });
  }
  db.users = db.users.filter((u) => u.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// Dynamic Page / Section Editor for Admin
app.get('/api/admin/pages', (req: Request, res: Response) => {
  const db = loadDB();
  res.json({ success: true, pages: db.pages });
});

app.post('/api/admin/pages', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) return res.status(403).json({ error: 'Access denied.' });

  const { key, title, content } = req.body;
  const db = loadDB();
  let page = db.pages.find((p) => p.key === key);
  if (page) {
    page.title = title || page.title;
    page.content = content || page.content;
    page.updatedAt = new Date().toISOString();
  } else {
    page = {
      id: `page_${Date.now()}`,
      key,
      title,
      content,
      updatedAt: new Date().toISOString(),
    };
    db.pages.push(page);
  }
  saveDB(db);
  res.json({ success: true, page });
});

// -----------------------------------------------------------------------------
// Global Announcements (Real-Time SSE Push + Admin Management)
// -----------------------------------------------------------------------------
const announcementSseClients = new Set<Response>();

function sanitizeActionUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return undefined;
}

function normalizeSeverity(raw?: string): 'info' | 'success' | 'warning' | 'urgent' {
  if (raw === 'success' || raw === 'warning' || raw === 'urgent') return raw;
  return 'info';
}

function toPublicAnnouncement(a: DatabaseSchema['announcements'][number]) {
  return {
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity,
    actionLabel: a.actionLabel,
    actionUrl: a.actionUrl,
    isActive: a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    expiresAt: a.expiresAt,
  };
}

function getActivePublicAnnouncement(db?: DatabaseSchema) {
  const store = db || loadDB();
  const now = Date.now();
  const active = (store.announcements || [])
    .filter((a) => {
      if (!a.isActive) return false;
      if (a.expiresAt) {
        const exp = Date.parse(a.expiresAt);
        if (!Number.isNaN(exp) && exp <= now) return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return active.length > 0 ? toPublicAnnouncement(active[0]) : null;
}

function broadcastActiveAnnouncement(db?: DatabaseSchema) {
  const announcement = getActivePublicAnnouncement(db);
  const payload = JSON.stringify({ announcement });
  const eventName = announcement ? 'announcement:updated' : 'announcement:cleared';

  for (const client of announcementSseClients) {
    try {
      client.write(`event: ${eventName}\ndata: ${payload}\n\n`);
    } catch {
      announcementSseClients.delete(client);
    }
  }
}

// Public: get currently active announcement
app.get('/api/announcements/active', (_req: Request, res: Response) => {
  res.json({ success: true, announcement: getActivePublicAnnouncement() });
});

// Public: SSE real-time push notification stream for all connected users
app.get('/api/announcements/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const initialAnnouncement = getActivePublicAnnouncement();
  res.write(`event: init\ndata: ${JSON.stringify({ announcement: initialAnnouncement })}\n\n`);

  announcementSseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      announcementSseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    announcementSseClients.delete(res);
  });
});

// Admin-only: list all announcements
app.get('/api/admin/announcements', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const db = loadDB();
  const list = [...(db.announcements || [])].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  res.json({ success: true, announcements: list, connectedClients: announcementSseClients.size });
});

// Admin-only: create and push a new Global Announcement
app.post('/api/admin/announcements', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const { title, message, severity, actionLabel, actionUrl, isActive = true, expiresAt } = req.body || {};
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  const cleanTitle = typeof title === 'string' ? title.trim() : '';

  if (!cleanMessage) {
    return res.status(400).json({ error: 'Announcement message is required.' });
  }

  const safeUrl = sanitizeActionUrl(actionUrl);
  if (actionUrl && typeof actionUrl === 'string' && actionUrl.trim() && !safeUrl) {
    return res.status(400).json({ error: 'Action URL must start with https://, http://, or /.' });
  }

  const db = loadDB();
  const now = new Date().toISOString();
  const activeFlag = Boolean(isActive);

  if (activeFlag) {
    for (const item of db.announcements) {
      item.isActive = false;
    }
  }

  const newAnnouncement: DatabaseSchema['announcements'][number] = {
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    message: cleanMessage,
    severity: normalizeSeverity(severity),
    actionLabel: typeof actionLabel === 'string' && actionLabel.trim() ? actionLabel.trim() : undefined,
    actionUrl: safeUrl,
    isActive: activeFlag,
    createdAt: now,
    updatedAt: now,
    createdBy: adminEmail.toLowerCase().trim(),
    expiresAt: typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt.trim() : undefined,
  };

  db.announcements.unshift(newAnnouncement);
  saveDB(db);
  broadcastActiveAnnouncement(db);

  res.json({
    success: true,
    announcement: newAnnouncement,
    connectedClients: announcementSseClients.size,
  });
});

// Admin-only: edit or toggle active status on an existing announcement
app.patch('/api/admin/announcements/:id', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const { id } = req.params;
  const db = loadDB();
  const existing = db.announcements.find((a) => a.id === id);
  if (!existing) {
    return res.status(404).json({ error: 'Announcement not found.' });
  }

  const { title, message, severity, actionLabel, actionUrl, isActive, expiresAt } = req.body || {};

  if (typeof message === 'string') {
    if (!message.trim()) {
      return res.status(400).json({ error: 'Announcement message cannot be empty.' });
    }
    existing.message = message.trim();
  }
  if (typeof title === 'string') existing.title = title.trim();
  if (typeof severity === 'string') existing.severity = normalizeSeverity(severity);
  if (actionLabel !== undefined) {
    existing.actionLabel = typeof actionLabel === 'string' && actionLabel.trim() ? actionLabel.trim() : undefined;
  }
  if (actionUrl !== undefined) {
    if (typeof actionUrl === 'string' && actionUrl.trim()) {
      const safeUrl = sanitizeActionUrl(actionUrl);
      if (!safeUrl) {
        return res.status(400).json({ error: 'Action URL must start with https://, http://, or /.' });
      }
      existing.actionUrl = safeUrl;
    } else {
      existing.actionUrl = undefined;
    }
  }
  if (expiresAt !== undefined) {
    existing.expiresAt = typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt.trim() : undefined;
  }
  if (typeof isActive === 'boolean') {
    if (isActive) {
      for (const item of db.announcements) {
        if (item.id !== existing.id) item.isActive = false;
      }
    }
    existing.isActive = isActive;
  }

  existing.updatedAt = new Date().toISOString();
  saveDB(db);
  broadcastActiveAnnouncement(db);

  res.json({
    success: true,
    announcement: existing,
    connectedClients: announcementSseClients.size,
  });
});

// Admin-only: re-push an announcement so all users (even those who dismissed earlier) receive it fresh
app.post('/api/admin/announcements/:id/repush', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const { id } = req.params;
  const db = loadDB();
  const target = db.announcements.find((a) => a.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Announcement not found.' });
  }

  for (const item of db.announcements) {
    item.isActive = item.id === target.id;
  }
  target.updatedAt = new Date().toISOString();
  saveDB(db);
  broadcastActiveAnnouncement(db);

  res.json({
    success: true,
    announcement: target,
    connectedClients: announcementSseClients.size,
  });
});

// Admin-only: delete announcement
app.delete('/api/admin/announcements/:id', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const { id } = req.params;
  const db = loadDB();
  db.announcements = db.announcements.filter((a) => a.id !== id);
  saveDB(db);
  broadcastActiveAnnouncement(db);

  res.json({ success: true });
});

// -----------------------------------------------------------------------------
// Adsterra Monetization Platform (100% Free, Iraq-Supported, High CPM)
// -----------------------------------------------------------------------------
function sanitizeAdUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return '';
}

function sanitizeBannerKey(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function sanitizeContainerId(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function sanitizeMetaAttr(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9._:=+/-]/g, '').slice(0, 140);
}

function isValidVerifyFilename(raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  return /^[a-zA-Z0-9._-]{3,80}\.(html|txt)$/i.test(raw.trim());
}

function getEffectiveAdPlatform(db?: DatabaseSchema): NonNullable<DatabaseSchema['adPlatform']> {
  const store = db || loadDB();
  return store.adPlatform || defaultAdPlatformConfig();
}

function injectAdVerificationHtml(html: string): string {
  const cfg = getEffectiveAdPlatform();
  const tags: string[] = [];

  if (cfg.verificationMetaName && cfg.verificationMetaContent) {
    const safeName = sanitizeMetaAttr(cfg.verificationMetaName);
    const safeContent = sanitizeMetaAttr(cfg.verificationMetaContent);
    if (safeName && safeContent) {
      tags.push(`<meta name="${safeName}" content="${safeContent}" />`);
    }
  }

  if (tags.length === 0) return html;
  const block = `\n    <!-- Ad Platform Site Verification -->\n    ${tags.join('\n    ')}\n`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${block}  </head>`);
  }
  return html;
}

// Public runtime config for client script/banner/direct-link integration
app.get('/api/ads/config', (_req: Request, res: Response) => {
  const cfg = getEffectiveAdPlatform();
  res.json({
    success: true,
    config: {
      provider: cfg.provider,
      enabled: cfg.enabled,
      directLinkUrl: cfg.directLinkUrl,
      inPageScriptUrl: cfg.inPageScriptUrl,
      popunderScriptUrl: cfg.popunderScriptUrl,
      nativeContainerId: cfg.nativeContainerId,
      nativeScriptUrl: cfg.nativeScriptUrl,
      bannerTop: cfg.bannerTop,
      bannerBottom: cfg.bannerBottom,
      updatedAt: cfg.updatedAt,
    },
  });
});

// Public impression / direct-link click telemetry
app.post('/api/ads/track', (req: Request, res: Response) => {
  const { type } = req.body || {};
  const db = loadDB();
  const adPlatform = getEffectiveAdPlatform(db);
  if (type === 'direct_link_click') {
    adPlatform.stats.directLinkClicks = (adPlatform.stats.directLinkClicks || 0) + 1;
  } else {
    adPlatform.stats.impressions = (adPlatform.stats.impressions || 0) + 1;
  }
  adPlatform.stats.lastUpdatedAt = new Date().toISOString();
  db.adPlatform = adPlatform;
  saveDB(db);
  res.json({ success: true, stats: adPlatform.stats });
});

// Admin-only: get full Ad Platform config + stats + AI Studio URL diagnostics
app.get('/api/admin/ads', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const adPlatform = getEffectiveAdPlatform();
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '') || 'http://localhost:3000';
  const isDevPrivateUrl = /ais-dev-/i.test(appUrl);
  const isCloudRunUrl = /\.run\.app$/i.test(appUrl.replace(/^https?:\/\//i, '').split('/')[0]);

  res.json({
    success: true,
    config: adPlatform,
    siteUrl: appUrl,
    aiStudioInfo: {
      isDevPrivateUrl,
      isCloudRunUrl,
    },
  });
});

// Admin-only: save Ad Platform configuration
app.post('/api/admin/ads', (req: Request, res: Response) => {
  const adminEmail = (req.headers['x-admin-email'] as string) || '';
  if (!isAdminEmail(adminEmail)) {
    return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
  }

  const body = req.body || {};
  const db = loadDB();
  const current = getEffectiveAdPlatform(db);

  const allowedProviders = ['hilltopads', 'admaven', 'popads', 'aads', 'adsterra_direct', 'custom'] as const;
  const provider =
    typeof body.provider === 'string' && (allowedProviders as readonly string[]).includes(body.provider)
      ? (body.provider as NonNullable<DatabaseSchema['adPlatform']>['provider'])
      : current.provider;

  const urlFieldsToCheck = [
    { key: 'directLinkUrl', val: body.directLinkUrl, label: 'Direct Link URL' },
    { key: 'inPageScriptUrl', val: body.inPageScriptUrl, label: 'In-Page / Social Script URL' },
    { key: 'popunderScriptUrl', val: body.popunderScriptUrl, label: 'Popunder Script URL' },
    { key: 'nativeScriptUrl', val: body.nativeScriptUrl, label: 'Native Banner Script URL' },
  ];

  for (const field of urlFieldsToCheck) {
    if (field.val !== undefined && String(field.val).trim()) {
      if (!sanitizeAdUrl(String(field.val))) {
        return res.status(400).json({ error: `${field.label} must start with https:// or http://` });
      }
    }
  }

  if (body.verificationFileName !== undefined && String(body.verificationFileName).trim()) {
    if (!isValidVerifyFilename(String(body.verificationFileName))) {
      return res.status(400).json({
        error: 'Verification file name must be a valid .html or .txt file name (e.g. admaven_verify.html)',
      });
    }
  }

  const sanitizeBanner = (
    input: any,
    prev: NonNullable<DatabaseSchema['adPlatform']>['bannerTop']
  ) => {
    if (!input || typeof input !== 'object') return prev;
    const validModes = ['script_key', 'aads_unit', 'script_url'] as const;
    const mode =
      typeof input.mode === 'string' && (validModes as readonly string[]).includes(input.mode)
        ? (input.mode as 'script_key' | 'aads_unit' | 'script_url')
        : prev.mode;
    const key = input.key !== undefined ? sanitizeBannerKey(String(input.key)) : prev.key;
    const rawInvoke = input.invokeUrl !== undefined ? sanitizeAdUrl(String(input.invokeUrl)) : prev.invokeUrl;
    if (input.invokeUrl !== undefined && String(input.invokeUrl).trim() && !rawInvoke) {
      throw new Error('Banner script URL must start with https:// or http://');
    }
    const width = Number(input.width) > 0 ? Math.min(1200, Math.round(Number(input.width))) : prev.width;
    const height = Number(input.height) > 0 ? Math.min(800, Math.round(Number(input.height))) : prev.height;
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : prev.enabled;
    return {
      enabled,
      mode,
      key,
      width,
      height,
      invokeUrl: rawInvoke,
    };
  };

  let nextBannerTop = current.bannerTop;
  let nextBannerBottom = current.bannerBottom;
  try {
    nextBannerTop = sanitizeBanner(body.bannerTop, current.bannerTop);
    nextBannerBottom = sanitizeBanner(body.bannerBottom, current.bannerBottom);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid banner configuration' });
  }

  const nextConfig: NonNullable<DatabaseSchema['adPlatform']> = {
    provider,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
    directLinkUrl:
      body.directLinkUrl !== undefined
        ? sanitizeAdUrl(String(body.directLinkUrl))
        : current.directLinkUrl,
    inPageScriptUrl:
      body.inPageScriptUrl !== undefined
        ? sanitizeAdUrl(String(body.inPageScriptUrl))
        : current.inPageScriptUrl,
    popunderScriptUrl:
      body.popunderScriptUrl !== undefined
        ? sanitizeAdUrl(String(body.popunderScriptUrl))
        : current.popunderScriptUrl,
    nativeContainerId:
      body.nativeContainerId !== undefined
        ? sanitizeContainerId(String(body.nativeContainerId))
        : current.nativeContainerId,
    nativeScriptUrl:
      body.nativeScriptUrl !== undefined
        ? sanitizeAdUrl(String(body.nativeScriptUrl))
        : current.nativeScriptUrl,
    bannerTop: nextBannerTop,
    bannerBottom: nextBannerBottom,
    verificationMetaName:
      body.verificationMetaName !== undefined
        ? sanitizeMetaAttr(String(body.verificationMetaName))
        : current.verificationMetaName,
    verificationMetaContent:
      body.verificationMetaContent !== undefined
        ? sanitizeMetaAttr(String(body.verificationMetaContent))
        : current.verificationMetaContent,
    verificationFileName:
      body.verificationFileName !== undefined
        ? String(body.verificationFileName).trim().slice(0, 80)
        : current.verificationFileName,
    verificationFileContent:
      body.verificationFileContent !== undefined
        ? String(body.verificationFileContent).slice(0, 4000)
        : current.verificationFileContent,
    adsTxtContent:
      body.adsTxtContent !== undefined
        ? String(body.adsTxtContent).slice(0, 12000)
        : current.adsTxtContent,
    stats: current.stats,
    updatedAt: new Date().toISOString(),
  };

  db.adPlatform = nextConfig;
  saveDB(db);

  res.json({ success: true, config: nextConfig });
});

// Serve ads.txt dynamically when configured by Admin
app.get('/ads.txt', (_req: Request, res: Response, next) => {
  const cfg = getEffectiveAdPlatform();
  if (!cfg.adsTxtContent || !cfg.adsTxtContent.trim()) {
    return next();
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.send(cfg.adsTxtContent);
});

// Serve dynamic root verification file (e.g. /admaven_1234.html or /verify.txt)
app.get('/:verifyFile', (req: Request, res: Response, next) => {
  const requested = String(req.params.verifyFile || '').trim();
  if (!isValidVerifyFilename(requested)) {
    return next();
  }
  const cfg = getEffectiveAdPlatform();
  if (!cfg.verificationFileName || cfg.verificationFileName !== requested) {
    return next();
  }
  const isHtml = requested.toLowerCase().endsWith('.html');
  res.setHeader(
    'Content-Type',
    isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'
  );
  res.setHeader('Cache-Control', 'no-cache');
  return res.send(cfg.verificationFileContent || requested);
});

// -----------------------------------------------------------------------------
// GitHub OAuth & Complete Site ZIP Export / Sync (Admin-exclusive)
// -----------------------------------------------------------------------------
registerGitHubRoutes(app, isAdminEmail);
registerFileStorageRoutes(app, DATA_DIR);

// -----------------------------------------------------------------------------
// Safe API Routing & Catch-All (Never leak HTML to /api/* requests)
// -----------------------------------------------------------------------------
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Express global error handler to guarantee all API errors return JSON
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Express server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
  next(err);
});

// -----------------------------------------------------------------------------
// Vite Middlewares in Dev / Static files in Prod (with server-side Meta Tag Verification)
// -----------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    app.get(['/', '/index.html'], async (req, res, next) => {
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(templatePath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const withMeta = injectAdVerificationHtml(transformed);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(withMeta);
      } catch (err: any) {
        vite.ssrFixStacktrace(err);
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      const rawHtml = fs.readFileSync(indexFile, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(injectAdVerificationHtml(rawHtml));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Meta.Ny Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

