import React, { useId } from 'react';
import { Globe } from 'lucide-react';
import { WORLD_LANGUAGES, resolveLangCode } from '../utils/clientTranslator';

export type LanguageSelectorAccent = 'amber' | 'purple' | 'sky' | 'teal' | 'blue';

export interface LanguageSelectorProps {
  value: string;
  onChange: (langCode: string) => void;
  customValue?: string;
  onCustomChange?: (val: string) => void;
  includeOriginalOption?: boolean;
  includeBilingualArEnOption?: boolean;
  label?: string;
  accent?: LanguageSelectorAccent;
  isRTL?: boolean;
  disabled?: boolean;
  testId?: string;
  className?: string;
}

export const BILINGUAL_AR_EN_CODE = 'bilingual_ar_en';
export const BILINGUAL_AR_EN_LABEL = 'سؤال وجواب باللغتين - عربي ثم انكليزي';

const ACCENT_FOCUS: Record<LanguageSelectorAccent, string> = {
  amber: 'focus:border-amber-500 dark:focus:border-amber-400',
  purple: 'focus:border-purple-500 dark:focus:border-purple-400',
  sky: 'focus:border-sky-500 dark:focus:border-sky-400',
  teal: 'focus:border-teal-500 dark:focus:border-teal-400',
  blue: 'focus:border-blue-500 dark:focus:border-blue-400',
};

const ACCENT_ICON: Record<LanguageSelectorAccent, string> = {
  amber: 'text-amber-600 dark:text-amber-400',
  purple: 'text-purple-600 dark:text-purple-400',
  sky: 'text-sky-600 dark:text-sky-400',
  teal: 'text-teal-600 dark:text-teal-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

/**
 * Resolves the active selector value + custom ISO code into a clean language identifier.
 */
export function resolveSelectedOutputLanguage(value: string, customValue?: string): string {
  if (value === BILINGUAL_AR_EN_CODE) {
    return BILINGUAL_AR_EN_CODE;
  }
  if (value === 'custom') {
    const trimmed = (customValue || '').trim();
    return trimmed ? resolveLangCode(trimmed) : 'original';
  }
  return value || 'original';
}

/**
 * Returns a clean, human-readable language display name for metadata labels or order records.
 */
export function formatLanguageDisplayName(codeOrLabel: string | undefined, isRTL: boolean = true): string {
  if (!codeOrLabel || codeOrLabel === 'original' || codeOrLabel === 'auto') {
    return isRTL ? 'تلقائي (لغة النص)' : 'Auto (Source Language)';
  }
  if (codeOrLabel === BILINGUAL_AR_EN_CODE) {
    return BILINGUAL_AR_EN_LABEL;
  }
  const code = resolveLangCode(codeOrLabel);
  const found = WORLD_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  if (found) {
    return isRTL ? `${found.labelAr} (${found.code})` : `${found.nativeName} (${found.code})`;
  }
  return codeOrLabel;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  customValue = '',
  onCustomChange,
  includeOriginalOption = true,
  includeBilingualArEnOption = false,
  label,
  accent = 'blue',
  isRTL = true,
  disabled = false,
  testId,
  className = '',
}) => {
  const selectId = useId();
  const focusClass = ACCENT_FOCUS[accent];
  const iconClass = ACCENT_ICON[accent];

  const resolvedSelectValue =
    value === BILINGUAL_AR_EN_CODE ||
    value === 'custom' ||
    value === 'original' ||
    WORLD_LANGUAGES.some((l) => l.code === value)
      ? value
      : resolveLangCode(value);

  const labelText = label ?? (isRTL ? 'لغة الإخراج المطلوبة' : 'Output Language');

  return (
    <div className={className}>
      <label
        htmlFor={selectId}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
      >
        <Globe className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />
        <span>{labelText}</span>
      </label>

      <select
        id={selectId}
        value={
          resolvedSelectValue === BILINGUAL_AR_EN_CODE ||
          resolvedSelectValue === 'custom' ||
          resolvedSelectValue === 'original' ||
          WORLD_LANGUAGES.some((l) => l.code === resolvedSelectValue)
            ? resolvedSelectValue
            : 'custom'
        }
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid={testId}
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden transition-colors disabled:opacity-60 ${focusClass}`}
      >
        {includeBilingualArEnOption && (
          <option value={BILINGUAL_AR_EN_CODE}>{BILINGUAL_AR_EN_LABEL}</option>
        )}

        {includeOriginalOption && (
          <option value="original">
            {isRTL ? 'نفس لغة النص الأصلية (تلقائي)' : 'Original Text Language (Auto)'}
          </option>
        )}

        {WORLD_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {isRTL ? `${lang.labelAr} (${lang.nativeName})` : `${lang.nativeName} (${lang.code})`}
          </option>
        ))}

        <option value="custom">
          {isRTL ? 'لغة عالمية أخرى (كود ISO مثل sv, pt, ga...)' : 'Other World Language (ISO code)'}
        </option>
      </select>

      {value === 'custom' && onCustomChange && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          disabled={disabled}
          placeholder="pt, nl, pl, th, bn, vi..."
          aria-label={isRTL ? 'أدخل رمز اللغة العالمي ISO' : 'Enter ISO language code'}
          className="mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
        />
      )}
    </div>
  );
};
