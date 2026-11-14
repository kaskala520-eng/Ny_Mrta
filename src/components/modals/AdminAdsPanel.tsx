import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  Globe,
  Link2,
  MousePointerClick,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AdPlatformConfig, AdProviderId, User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { AD_PLATFORM_STORAGE_KEY, AD_PLATFORM_UPDATED_EVENT, readLocalAdConfig } from '../AdPlatformManager';

interface AdminAdsPanelProps {
  currentUser: User | null;
}

interface ProviderPreset {
  id: AdProviderId;
  name: string;
  signupUrl: string;
  aiStudioModeAr: string;
  aiStudioModeEn: string;
  payoutInfoAr: string;
  payoutInfoEn: string;
  summaryAr: string;
  summaryEn: string;
}

const PROVIDERS: ProviderPreset[] = [
  {
    id: 'hilltopads',
    name: 'HilltopAds',
    signupUrl: 'https://hilltopads.com/signup?ref=publisher',
    aiStudioModeAr: 'Direct Link بدون دومين + سحب أسبوعي',
    aiStudioModeEn: 'Domain-Free Direct Link + Weekly Payout',
    payoutInfoAr: 'USDT (TRC20 / ERC20)، Paxum، Bitcoin، Capitalist · مجانية 100%',
    payoutInfoEn: 'USDT (TRC20 / ERC20), Paxum, Bitcoin, Capitalist · 100% Free',
    summaryAr:
      'أفضل حل فوري لمواقع Google AI Studio: أنشئ Direct Link لحركة السوشيال/التطبيق بدون الحاجة لشراء دومين .com أو رفض نطاقات run.app، وتقبل العراق بالكامل.',
    summaryEn:
      'Best instant option for Google AI Studio apps: create a Direct Link (social/non-website flow) without custom .com domain approval barriers. Accepts Iraq traffic with weekly USDT payouts.',
  },
  {
    id: 'admaven',
    name: 'AdMaven',
    signupUrl: 'https://ad-maven.com/publishers/',
    aiStudioModeAr: 'SmartLink بدون دومين أو التحقق بـ Meta/HTML',
    aiStudioModeEn: 'No-Site SmartLink or Meta/HTML Subdomain Verify',
    payoutInfoAr: 'USDT ERC-20 بحد سحب $0 (TRC-20 $50) · تقبل العراق',
    payoutInfoEn: 'USDT ERC-20 ($0 min) / TRC-20 ($50 min) · Accepts Iraq',
    summaryAr:
      'تدعم روابط SmartLink/Direct Link بدون موقع تقليدي، أو التحقق من النطاق الفرعي عبر وسم Meta أو ملف HTML الجذري (تم دمجهما في الخادم أدناه).',
    summaryEn:
      'Supports Direct/SmartLinks with no traditional domain or subdomain verification via HTML Meta tag / root file (built into this server below).',
  },
  {
    id: 'popads',
    name: 'PopAds',
    signupUrl: 'https://www.popads.net/',
    aiStudioModeAr: 'قبول مرن + وسم التحقق HTML',
    aiStudioModeEn: 'Flexible Approval + HTML Verification',
    payoutInfoAr: 'USDT (TRC20 / ERC20) بحد سحب $5 فقط · تقبل العراق',
    payoutInfoEn: 'USDT (TRC20 / ERC20) from just $5 min · Accepts Iraq',
    summaryAr:
      'من أقدم المنصات قبولاً للنطاقات الفرعية في العراق مع أقل حد سحب ($5 عبر USDT).',
    summaryEn:
      'Very lenient with subdomains in Iraq and low $5 minimum withdrawal via USDT.',
  },
  {
    id: 'adsterra_direct',
    name: 'Adsterra (Direct Link)',
    signupUrl: 'https://publishers.adsterra.com/referral/start',
    aiStudioModeAr: 'Direct Link لحركة غير المواقع فقط',
    aiStudioModeEn: 'Direct Link (Non-Website Traffic Only)',
    payoutInfoAr: 'WebMoney ($5)، USDT، Paxum · مجانية 100%',
    payoutInfoEn: 'WebMoney ($5), USDT, Paxum · 100% Free',
    summaryAr:
      'ملاحظة: إضافة الموقع في Adsterra ترفض نطاقات run.app؛ لكن يمكنك استخدام Direct Link (فئة Social/App) إذا كان لديك رابط مباشر جاهز.',
    summaryEn:
      'Note: Adsterra "Add Website" rejects *.run.app domains, but Direct Links work under Non-Website/Social traffic.',
  },
  {
    id: 'aads',
    name: 'A-ADS (Crypto Iframe)',
    signupUrl: 'https://aads.com/',
    aiStudioModeAr: 'بانر iframe (data-aa) متوافق مع المعاينة',
    aiStudioModeEn: 'Iframe Banner (data-aa) Preview Safe',
    payoutInfoAr: 'بدون KYC · Bitcoin / Lightning (بلا حد أدنى)',
    payoutInfoEn: 'No KYC · Bitcoin / Lightning (no minimum)',
    summaryAr:
      'تعتمد على وسم iframe نظيف يعمل داخل نافذة المعاينة بدون نوافذ منبثقة (تعمل بأفضل شكل مع رابط المشاركة العام أو دومين مخصص).',
    summaryEn:
      'Clean iframe units compatible with embedded frames and no popups (works best with public Shared App URL or custom domain).',
  },
];

const EMPTY_CONFIG: AdPlatformConfig = {
  provider: 'hilltopads',
  enabled: false,
  directLinkUrl: '',
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

export const AdminAdsPanel: React.FC<AdminAdsPanelProps> = () => {
  const { isRTL } = useLanguage();

  const [config, setConfig] = useState<AdPlatformConfig>(EMPTY_CONFIG);
  const [siteUrl] = useState<string>(
    typeof window !== 'undefined' ? window.location.origin : ''
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [smartPaste, setSmartPaste] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadConfig = useCallback(() => {
    setLoading(true);
    const localCfg = readLocalAdConfig();
    if (localCfg) setConfig(localCfg);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const activeProvider = PROVIDERS.find((p) => p.id === config.provider) || PROVIDERS[0];

  const detectedOrigin =
    typeof window !== 'undefined' ? window.location.origin : siteUrl;
  const isPrivateDevUrl = /ais-dev-/i.test(detectedOrigin);
  const suggestedSharedUrl = isPrivateDevUrl
    ? detectedOrigin.replace(/ais-dev-/i, 'ais-pre-')
    : detectedOrigin;

  const normalizeSrc = (raw: string): string => {
    const clean = raw.trim();
    if (clean.startsWith('//')) return `https:${clean}`;
    return clean;
  };

  const handleSmartParse = () => {
    const input = smartPaste.trim();
    if (!input) return;

    const updated = { ...config };
    let parsedCount = 0;

    const metaTagMatch =
      input.match(/<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      input.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']([^"']+)["'][^>]*>/i);
    if (metaTagMatch) {
      const isNameFirst =
        /<meta[^>]*name=/i.test(metaTagMatch[0]) &&
        metaTagMatch[0].indexOf('name=') < metaTagMatch[0].indexOf('content=');
      updated.verificationMetaName = isNameFirst ? metaTagMatch[1] : metaTagMatch[2];
      updated.verificationMetaContent = isNameFirst ? metaTagMatch[2] : metaTagMatch[1];
      parsedCount++;
    }

    const aadsMatch = input.match(/data-aa=["']?(\d{4,12})["']?/i);
    if (aadsMatch) {
      updated.provider = 'aads';
      updated.bannerTop = {
        ...updated.bannerTop,
        enabled: true,
        mode: 'aads_unit',
        key: aadsMatch[1],
        width: 728,
        height: 90,
      };
      updated.enabled = true;
      parsedCount++;
    }

    const scriptSrcMatch = input.match(/<script[^>]+src=["']([^"']+)["']/i);
    const scriptSrc = scriptSrcMatch ? normalizeSrc(scriptSrcMatch[1]) : '';

    const keyMatch = input.match(/['"]?key['"]?\s*:\s*['"]([a-zA-Z0-9_-]{12,64})['"]/);
    const widthMatch = input.match(/['"]?width['"]?\s*:\s*(\d+)/);
    const heightMatch = input.match(/['"]?height['"]?\s*:\s*(\d+)/);

    if (keyMatch) {
      const w = widthMatch ? Number(widthMatch[1]) : 728;
      const h = heightMatch ? Number(heightMatch[1]) : 90;
      if (w >= 468) {
        updated.bannerTop = {
          enabled: true,
          mode: 'script_key',
          key: keyMatch[1],
          width: w,
          height: h,
          invokeUrl: scriptSrc,
        };
      } else {
        updated.bannerBottom = {
          enabled: true,
          mode: 'script_key',
          key: keyMatch[1],
          width: w,
          height: h,
          invokeUrl: scriptSrc,
        };
      }
      updated.enabled = true;
      parsedCount++;
    }

    const containerMatch = input.match(/<div[^>]+id=["']([^"']+)["']/i);
    if (containerMatch && scriptSrc) {
      updated.nativeContainerId = containerMatch[1];
      updated.nativeScriptUrl = scriptSrc;
      updated.enabled = true;
      parsedCount++;
    }

    const plainUrlMatch = input.match(/^((?:https?:)?\/\/[^\s<>"']+)$/i);
    if (parsedCount === 0 && plainUrlMatch) {
      const url = normalizeSrc(plainUrlMatch[1]);
      if (/\.js(\?|$)/i.test(url)) {
        updated.inPageScriptUrl = url;
      } else {
        updated.directLinkUrl = url;
      }
      updated.enabled = true;
      parsedCount++;
    } else if (parsedCount === 0 && scriptSrc) {
      updated.inPageScriptUrl = scriptSrc;
      updated.enabled = true;
      parsedCount++;
    }

    if (parsedCount === 0) {
      setErrorMsg(
        isRTL
          ? 'لم يتم التعرف على الكود تلقائياً. أدخل الرابط في الحقول أدناه مباشرة.'
          : 'Could not auto-detect snippet format. Enter the URL directly below.'
      );
      return;
    }

    setConfig(updated);
    setSmartPaste('');
    setErrorMsg(null);
    showToast(
      isRTL
        ? 'تم تحليل الكود وتعبئة الحقول تلقائياً — اضغط «حفظ وتفعيل» الآن.'
        : 'Snippet parsed into fields — click Save & Apply now.'
    );
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const nextConfig: AdPlatformConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(AD_PLATFORM_STORAGE_KEY, JSON.stringify(nextConfig));
      setConfig(nextConfig);
      window.dispatchEvent(new Event(AD_PLATFORM_UPDATED_EVENT));
      showToast(
        isRTL
          ? 'تم حفظ إعدادات الإعلانات محلياً وتفعيلها بنجاح'
          : 'Ad settings saved locally and applied'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(suggestedSharedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 overflow-y-auto flex-1 space-y-5">
      {/* Header & Master Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {isRTL
                ? 'منصة الإعلانات المتوافقة مع Google AI Studio'
                : 'Google AI Studio-Compatible Ad Monetization'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL
                ? 'ربط فوري مجاني يعمل بدون الحاجة لدومين .com مخصص، مع دعم العراق وسحب USDT'
                : 'Instant free integration designed for AI Studio apps without a custom .com domain, supporting Iraq & USDT'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              config.enabled
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {config.enabled
              ? isRTL
                ? 'الإعلانات مفعّلة للمستخدمين'
                : 'Ads Enabled for Users'
              : isRTL
              ? 'الإعلانات متوقفة (اضغط للتفعيل)'
              : 'Ads Paused (Click to Enable)'}
          </button>
        </div>
      </div>

      {/* Feedback messages */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* AI Studio URL Diagnosis + Why Direct Link Works */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 dark:text-slate-200 space-y-1">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              {isRTL
                ? 'كيف يتم قبول موقع Google AI Studio بدون رفض؟'
                : 'How to get approved on Google AI Studio without domain rejection:'}
            </p>
            <p className="leading-relaxed">
              {isRTL
                ? '1) لا تستخدم رابط التطوير الخاص (ais-dev) لأنه محمي بتسجيل دخول Google. استخدم رابط المشاركة العام (ais-pre) المجهز بالأسفل. 2) بدلاً من قسم «إضافة موقع» الذي يرفض نطاقات run.app المجانية، استخدم ميزة Direct Link / SmartLink في HilltopAds أو AdMaven (تعمل بدون اشتراط دومين .com)، أو استخدم حقول التحقق المباشر بالخادم أدناه للمنصات التي تقبل النطاقات الفرعية.'
                : '1) Never submit private ais-dev URLs (behind Google auth). Always use the public ais-pre Shared URL below. 2) To avoid *.run.app rejection completely, use Direct Link / SmartLink on HilltopAds or AdMaven (no .com domain required), or configure server-side Meta/HTML verification below for subdomain-friendly networks.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/60">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              {isRTL ? 'رابط المشاركة العام الجاهز للتقديم (Shared App URL):' : 'Public Shared App URL:'}
            </span>
            <code className="text-xs font-mono text-slate-900 dark:text-slate-100 break-all" dir="ltr">
              {suggestedSharedUrl}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? (isRTL ? 'تم النسخ' : 'Copied') : isRTL ? 'نسخ الرابط العام' : 'Copy Public URL'}</span>
          </button>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isRTL ? 'المنصة النشطة حالياً' : 'Active Ad Provider'}
          </span>
          <div className="text-base font-black text-slate-900 dark:text-slate-100 mt-1">
            {activeProvider.name}
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
            {isRTL ? activeProvider.aiStudioModeAr : activeProvider.aiStudioModeEn}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isRTL ? 'مرات ظهور الإعلانات' : 'Ad Impressions'}
            </span>
            <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {config.stats.impressions.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isRTL ? 'نقرات Direct Link / SmartLink' : 'Direct Link Clicks'}
            </span>
            <MousePointerClick className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {config.stats.directLinkClicks.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Platform Selector */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {isRTL ? 'اختر المنصة المتوافقة (مرتبة حسب قبول AI Studio والعراق):' : 'Select AI Studio-Compatible Network:'}
          </h4>
          <a
            href={activeProvider.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            <span>
              {isRTL ? `فتح التسجيل المجاني في ${activeProvider.name}` : `Open Free Signup (${activeProvider.name})`}
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PROVIDERS.map((p) => {
            const selected = config.provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, provider: p.id }))}
                className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
                  selected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </span>
                  {selected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                </div>
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                  {isRTL ? p.aiStudioModeAr : p.aiStudioModeEn}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {isRTL ? p.payoutInfoAr : p.payoutInfoEn}
                </p>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          {isRTL ? activeProvider.summaryAr : activeProvider.summaryEn}
        </p>
      </div>

      {/* Smart Code Auto-Parser */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>
            {isRTL
              ? 'محلل الأكواد الذكي (الصق Direct Link أو وسم Meta للتحقق أو كود البانر)'
              : 'Smart Code Parser (Paste Direct Link, Meta Verification Tag, or Banner Snippet)'}
          </span>
        </div>

        <textarea
          value={smartPaste}
          onChange={(e) => setSmartPaste(e.target.value)}
          rows={3}
          dir="ltr"
          placeholder={
            '<meta name="..." content="..." />\nOR Direct Link: https://...\nOR Banner/Script tag...'
          }
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSmartParse}
            disabled={!smartPaste.trim()}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {isRTL ? 'تحليل وتعبئة الحقول تلقائياً' : 'Parse & Auto-Fill Fields'}
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Section 1: Direct Link / SmartLink & Scripts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isRTL
                ? '1. الرابط المباشر (Direct Link / SmartLink) والسكربتات — يعمل فوراً داخل AI Studio'
                : '1. Direct Link / SmartLink & Scripts — Works Immediately Inside AI Studio'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL
                ? 'رابط Direct Link / SmartLink (لا يتطلب موافقة دومين — يظهر في المساحات الإعلانية ونافذة الإعلانات)'
                : 'Direct Link / SmartLink URL (No Domain Required — Shown in Ad Slots & 3-Ad Modal)'}
            </label>
            <input
              type="url"
              dir="ltr"
              value={config.directLinkUrl}
              onChange={(e) => setConfig((p) => ({ ...p, directLinkUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'رابط سكربت In-Page Push / Social Bar (اختياري)' : 'In-Page Push / Social Script URL (Optional)'}
              </label>
              <input
                type="url"
                dir="ltr"
                value={config.inPageScriptUrl}
                onChange={(e) => setConfig((p) => ({ ...p, inPageScriptUrl: e.target.value }))}
                placeholder="https://.../inpage.js"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'رابط سكربت Popunder (اختياري)' : 'Popunder Script URL (Optional)'}
              </label>
              <input
                type="url"
                dir="ltr"
                value={config.popunderScriptUrl}
                onChange={(e) => setConfig((p) => ({ ...p, popunderScriptUrl: e.target.value }))}
                placeholder="https://.../pop.js"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Server-Side AI Studio Verification (Meta Tag + Root File + ads.txt) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>
              {isRTL
                ? '2. أدوات التحقق من ملكية الموقع بالخادم (لمنصات AdMaven / PopAds / أي شبكة تطلب Meta أو ملف HTML)'
                : '2. Server-Side Site Verification (Meta Tag, Root HTML/TXT File & ads.txt)'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'اسم وسم التحقق (Meta Name)' : 'Verification Meta Name'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={config.verificationMetaName}
                onChange={(e) => setConfig((p) => ({ ...p, verificationMetaName: e.target.value }))}
                placeholder="hilltopads-site-verification"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'قيمة وسم التحقق (Meta Content)' : 'Verification Meta Content'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={config.verificationMetaContent}
                onChange={(e) => setConfig((p) => ({ ...p, verificationMetaContent: e.target.value }))}
                placeholder="abc123def456..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'اسم ملف التحقق الجذري (.html أو .txt)' : 'Root Verification File Name (.html or .txt)'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={config.verificationFileName}
                onChange={(e) => setConfig((p) => ({ ...p, verificationFileName: e.target.value }))}
                placeholder="verify_12345.html"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'محتوى ملف التحقق الجذري' : 'Verification File Content'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={config.verificationFileContent}
                onChange={(e) => setConfig((p) => ({ ...p, verificationFileContent: e.target.value }))}
                placeholder="verification-token-content"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'محتوى ملف /ads.txt (اختياري)' : '/ads.txt Content (Optional)'}
            </label>
            <textarea
              dir="ltr"
              rows={2}
              value={config.adsTxtContent}
              onChange={(e) => setConfig((p) => ({ ...p, adsTxtContent: e.target.value }))}
              placeholder="domain.com, publisher-id, DIRECT"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Section 3: Optional Banner Slots (Top / Bottom / Native) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
            <FileCode2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>
              {isRTL ? '3. وحدات البانر و Native Banner (اختياري)' : '3. Display & Native Banner Slots (Optional)'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {isRTL ? 'البانر العلوي' : 'Top Banner Slot'}
                </span>
                <input
                  type="checkbox"
                  checked={config.bannerTop.enabled}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, bannerTop: { ...p.bannerTop, enabled: e.target.checked } }))
                  }
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
              <select
                value={config.bannerTop.mode}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    bannerTop: { ...p.bannerTop, mode: e.target.value as AdPlatformConfig['bannerTop']['mode'] },
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="script_key">{isRTL ? 'مفتاح البانر + Invoke Script' : 'Key + Invoke Script'}</option>
                <option value="script_url">{isRTL ? 'رابط سكربت البانر المباشر' : 'Direct Banner Script URL'}</option>
                <option value="aads_unit">{isRTL ? 'رقم وحدة A-ADS (data-aa)' : 'A-ADS Unit ID (data-aa)'}</option>
              </select>
              <input
                type="text"
                dir="ltr"
                value={config.bannerTop.key}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, bannerTop: { ...p.bannerTop, key: e.target.value } }))
                }
                placeholder={config.bannerTop.mode === 'aads_unit' ? 'A-ADS Unit ID (e.g. 2345678)' : 'Banner Key (optional)'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
              <input
                type="url"
                dir="ltr"
                value={config.bannerTop.invokeUrl}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, bannerTop: { ...p.bannerTop, invokeUrl: e.target.value } }))
                }
                placeholder="https://.../invoke.js"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {isRTL ? 'البانر السفلي' : 'Bottom Banner Slot'}
                </span>
                <input
                  type="checkbox"
                  checked={config.bannerBottom.enabled}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, bannerBottom: { ...p.bannerBottom, enabled: e.target.checked } }))
                  }
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
              <select
                value={config.bannerBottom.mode}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    bannerBottom: { ...p.bannerBottom, mode: e.target.value as AdPlatformConfig['bannerBottom']['mode'] },
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="script_key">{isRTL ? 'مفتاح البانر + Invoke Script' : 'Key + Invoke Script'}</option>
                <option value="script_url">{isRTL ? 'رابط سكربت البانر المباشر' : 'Direct Banner Script URL'}</option>
                <option value="aads_unit">{isRTL ? 'رقم وحدة A-ADS (data-aa)' : 'A-ADS Unit ID (data-aa)'}</option>
              </select>
              <input
                type="text"
                dir="ltr"
                value={config.bannerBottom.key}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, bannerBottom: { ...p.bannerBottom, key: e.target.value } }))
                }
                placeholder={config.bannerBottom.mode === 'aads_unit' ? 'A-ADS Unit ID (e.g. 2345679)' : 'Banner Key (optional)'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
              <input
                type="url"
                dir="ltr"
                value={config.bannerBottom.invokeUrl}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, bannerBottom: { ...p.bannerBottom, invokeUrl: e.target.value } }))
                }
                placeholder="https://.../invoke.js"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'معرّف حاوية Native Banner (اختياري)' : 'Native Banner Container ID (Optional)'}
              </label>
              <input
                type="text"
                dir="ltr"
                value={config.nativeContainerId}
                onChange={(e) => setConfig((p) => ({ ...p, nativeContainerId: e.target.value }))}
                placeholder="container-abc123"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'رابط سكربت Native Banner (اختياري)' : 'Native Banner Script URL (Optional)'}
              </label>
              <input
                type="url"
                dir="ltr"
                value={config.nativeScriptUrl}
                onChange={(e) => setConfig((p) => ({ ...p, nativeScriptUrl: e.target.value }))}
                placeholder="https://.../invoke.js"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : isRTL ? 'حفظ وتفعيل الربط' : 'Save & Apply Integration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
