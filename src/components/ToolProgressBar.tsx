import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export type ProgressAccent = 'blue' | 'teal' | 'amber' | 'rose' | 'emerald' | 'purple' | 'sky';

interface ToolProgressBarProps {
  progress: number;
  label?: string;
  accent?: ProgressAccent;
  active?: boolean;
  className?: string;
}

const ACCENT_MAP: Record<ProgressAccent, { bar: string; text: string; bg: string }> = {
  blue: {
    bar: 'bg-blue-600',
    text: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-950/60',
  },
  teal: {
    bar: 'bg-teal-600',
    text: 'text-teal-700 dark:text-teal-300',
    bg: 'bg-teal-100 dark:bg-teal-950/60',
  },
  amber: {
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
  },
  rose: {
    bar: 'bg-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
  },
  emerald: {
    bar: 'bg-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
  },
  purple: {
    bar: 'bg-purple-600',
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-950/60',
  },
  sky: {
    bar: 'bg-sky-600',
    text: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
  },
};

export const ToolProgressBar: React.FC<ToolProgressBarProps> = ({
  progress,
  label,
  accent = 'blue',
  active = false,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  if (!active && clamped === 0) return null;

  const palette = ACCENT_MAP[accent] || ACCENT_MAP.blue;
  const isDone = clamped >= 100 && !active;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full rounded-xl p-3 border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 space-y-2 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <div className={`flex items-center gap-1.5 min-w-0 ${palette.text}`}>
          {isDone ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          )}
          <span className="truncate">{label || (isDone ? '100%' : '...')}</span>
        </div>
        <span className={`font-mono tabular-nums shrink-0 ${isDone ? 'text-emerald-600 dark:text-emerald-400' : palette.text}`}>
          {clamped}%
        </span>
      </div>
      <div className={`w-full h-2 rounded-full overflow-hidden ${palette.bg}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isDone ? 'bg-emerald-600' : palette.bar
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
